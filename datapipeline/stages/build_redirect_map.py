"""Reads redirect_titles.tsv + redirect.sql(.gz); writes redirect_map.tsv.

redirect_titles.tsv: built by build_title_index — one line per ns-0 redirect page:
    {page_id}\t{redirect_page_title}

redirect.sql(.gz): MediaWiki redirect table — maps each redirect page_id to its
    target title:
    (rd_from, rd_namespace, rd_title, rd_interwiki, rd_fragment)

Output redirect_map.tsv: two tab-separated columns, no header:
    {redirect_title}\t{canonical_title}

Chains (A→B→C where B is also a redirect) are resolved to their final target in a
single in-memory post-pass (max 2 hops; cycles are skipped). Only ns-0 targets are
kept. The canonical_title is NOT validated against entities.tsv here — extract_wiki_edges
handles the final title_to_dense lookup and will drop any that are still unresolvable.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.page_sql import iter_redirects
from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    build_stage_manifest,
    is_output_current,
    write_stage_manifest,
)

MANIFEST_NAME = ".build-redirect-map-manifest.json"
DEFAULT_REDIRECT_TITLES = "redirect_titles.tsv"
DEFAULT_REDIRECT_SQL = "enwiki-latest-redirect.sql.gz"
DEFAULT_OUTPUT = "redirect_map.tsv"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class RedirectMapStats:
    redirects_read: int = 0
    ns0_kept: int = 0
    chains_resolved: int = 0
    entries_written: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "redirects_read": self.redirects_read,
            "ns0_kept": self.ns0_kept,
            "chains_resolved": self.chains_resolved,
            "entries_written": self.entries_written,
        }


def _load_redirect_titles(path: Path) -> dict[int, str]:
    """Return {page_id: redirect_page_title} for all ns-0 redirect pages."""
    page_id_to_title: dict[int, str] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            tab = line.index("\t")
            page_id_to_title[int(line[:tab])] = line[tab + 1 :]
    return page_id_to_title


def build_redirect_map(
    redirect_titles_path: Path,
    redirect_sql_path: Path,
    out: Path,
) -> RedirectMapStats:
    stats = RedirectMapStats()
    tmp = out.with_suffix(out.suffix + ".tmp")

    print("build_redirect_map: loading redirect page titles")
    page_id_to_title = _load_redirect_titles(redirect_titles_path)
    print(f"build_redirect_map: {len(page_id_to_title):,} redirect pages loaded")

    # raw_map: redirect_title -> target_title (one hop, unvalidated)
    raw_map: dict[str, str] = {}

    for rd_from, rd_namespaces, rd_titles in iter_redirects(redirect_sql_path):
        stats.redirects_read += len(rd_from)
        for i in range(len(rd_from)):
            if rd_namespaces[i] != 0:
                continue
            redirect_page_id = int(rd_from[i])
            redirect_title = page_id_to_title.get(redirect_page_id)
            if redirect_title is None:
                continue
            raw_map[redirect_title] = rd_titles[i]
            stats.ns0_kept += 1

        if stats.redirects_read % PROGRESS_INTERVAL == 0:
            print(f"build_redirect_map: {stats.redirects_read:,} redirect rows read")

    print(f"build_redirect_map: {stats.ns0_kept:,} ns-0 redirect entries, resolving chains")

    # Resolve one level of chaining: if target is itself a redirect, follow it once.
    resolved: dict[str, str] = {}
    for src, tgt in raw_map.items():
        final = raw_map.get(tgt, tgt)
        if final != tgt:
            stats.chains_resolved += 1
        resolved[src] = final

    print(f"build_redirect_map: {stats.chains_resolved:,} chains resolved")

    with tmp.open("w", encoding="utf-8") as out_file:
        for redirect_title, canonical_title in resolved.items():
            out_file.write(f"{redirect_title}\t{canonical_title}\n")
            stats.entries_written += 1

    tmp.replace(out)
    return stats


def run(
    redirect_titles_path: Path,
    redirect_sql_path: Path,
    out: Path,
    *,
    force: bool = False,
) -> None:
    redirect_titles_path = redirect_titles_path.resolve()
    redirect_sql_path = redirect_sql_path.resolve()
    out = out.resolve()
    out_dir = out.parent

    for label, path in (
        ("redirect titles", redirect_titles_path),
        ("redirect sql", redirect_sql_path),
    ):
        if not path.is_file():
            raise SystemExit(f"build_redirect_map: {label} not found: {path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    inputs = [redirect_titles_path, redirect_sql_path]
    if not force and is_output_current(out, inputs, out_dir, MANIFEST_NAME):
        size = out.stat().st_size
        print(f"build_redirect_map: skip {out} (up to date, {size:,} bytes)")
        return

    print(f"build_redirect_map: {redirect_titles_path} + {redirect_sql_path} -> {out}")
    stats = build_redirect_map(redirect_titles_path, redirect_sql_path, out)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_stage_manifest(output=out, inputs=inputs, stats=stats.as_dict()),
    )

    size = out.stat().st_size
    print(
        f"build_redirect_map: done -> {out} ({size:,} bytes, "
        f"{stats.entries_written:,} entries, "
        f"{stats.chains_resolved:,} chains resolved, "
        f"{stats.ns0_kept:,} ns0 kept, {stats.redirects_read:,} rows read)"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Build redirect_map.tsv from redirect_titles.tsv + redirect.sql dump."
    )
    parser.add_argument(
        "--redirect-titles",
        type=Path,
        default=data_dir / DEFAULT_REDIRECT_TITLES,
        help=f"Input redirect_titles.tsv (default: data/{DEFAULT_REDIRECT_TITLES})",
    )
    parser.add_argument(
        "--redirect-sql",
        type=Path,
        default=raw_dir / DEFAULT_REDIRECT_SQL,
        help=f"Input redirect.sql(.gz) dump (default: raw/{DEFAULT_REDIRECT_SQL})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=data_dir / DEFAULT_OUTPUT,
        help=f"Output TSV (default: data/{DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.redirect_titles, args.redirect_sql, args.out, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"build_redirect_map: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
