"""Reads page.sql(.gz); outputs: entities.tsv (dense id -> title), wiki_page_ids.tsv (dense id -> page_id).

Only namespace-0, non-redirect pages get a dense id (see datasource.md "Known
limitations" for the redirect-resolution follow-up). Line i of entities.tsv and
wiki_page_ids.tsv both describe dense id i.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.page_sql import iter_pages
from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    are_outputs_current,
    build_multi_output_manifest,
    write_stage_manifest,
)

MANIFEST_NAME = ".build-title-index-manifest.json"
DEFAULT_INPUT = "enwiki-latest-page.sql.gz"
ENTITIES_OUTPUT = "entities.tsv"
PAGE_IDS_OUTPUT = "wiki_page_ids.tsv"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class TitleIndexStats:
    pages_read: int = 0
    ns0_total: int = 0
    redirects_skipped: int = 0
    entities_written: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "pages_read": self.pages_read,
            "ns0_total": self.ns0_total,
            "redirects_skipped": self.redirects_skipped,
            "entities_written": self.entities_written,
        }


def build_title_index(inp: Path, entities_out: Path, page_ids_out: Path) -> TitleIndexStats:
    stats = TitleIndexStats()
    entities_tmp = entities_out.with_suffix(entities_out.suffix + ".tmp")
    page_ids_tmp = page_ids_out.with_suffix(page_ids_out.suffix + ".tmp")

    with entities_tmp.open("w", encoding="utf-8") as entities_file, page_ids_tmp.open(
        "w", encoding="utf-8"
    ) as page_ids_file:
        for page_id, namespace, title, is_redirect in iter_pages(inp):
            stats.pages_read += 1
            if namespace == 0:
                stats.ns0_total += 1
                if is_redirect:
                    stats.redirects_skipped += 1
                else:
                    entities_file.write(f"{title}\n")
                    page_ids_file.write(f"{page_id}\n")
                    stats.entities_written += 1

            if stats.pages_read % PROGRESS_INTERVAL == 0:
                print(
                    f"build_title_index: {stats.pages_read:,} pages read, "
                    f"{stats.entities_written:,} entities written"
                )

    entities_tmp.replace(entities_out)
    page_ids_tmp.replace(page_ids_out)
    return stats


def run(inp: Path, out_dir: Path, *, force: bool = False) -> None:
    inp = inp.resolve()
    out_dir = out_dir.resolve()
    entities_out = out_dir / ENTITIES_OUTPUT
    page_ids_out = out_dir / PAGE_IDS_OUTPUT
    outputs = [entities_out, page_ids_out]

    if not inp.is_file():
        raise SystemExit(f"build_title_index: input not found: {inp}")

    out_dir.mkdir(parents=True, exist_ok=True)

    if not force and are_outputs_current(outputs, [inp], out_dir, MANIFEST_NAME):
        sizes = ", ".join(f"{p.name} ({p.stat().st_size:,} bytes)" for p in outputs)
        print(f"build_title_index: skip {out_dir} (up to date, {sizes})")
        return

    print(f"build_title_index: {inp} -> {entities_out}, {page_ids_out}")
    stats = build_title_index(inp, entities_out, page_ids_out)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_multi_output_manifest(outputs=outputs, inputs=[inp], stats=stats.as_dict()),
    )

    sizes = ", ".join(f"{p.name} ({p.stat().st_size:,} bytes)" for p in outputs)
    print(
        f"build_title_index: done -> {out_dir} ({sizes}, "
        f"{stats.entities_written:,} entities, "
        f"{stats.redirects_skipped:,} redirects skipped, "
        f"{stats.ns0_total:,} ns0 total, {stats.pages_read:,} pages read)"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Build entities.tsv + wiki_page_ids.tsv from a Wikipedia page.sql dump."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=raw_dir / DEFAULT_INPUT,
        help=f"Input page.sql(.gz) dump (default: raw/{DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=data_dir,
        help="Output directory for entities.tsv + wiki_page_ids.tsv (default: data/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.inp, args.out_dir, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"build_title_index: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
