"""Reads linktarget.sql(.gz) + pagelinks.sql(.gz) + entities.tsv + wiki_page_ids.tsv;
writes data/edges_int.tsv (src_id, dst_id), 0-indexed dense ids.

Redirects are not resolved (see datapipeline/decisions/datasource.md "Known
limitations / follow-ups"): pagelinks whose target resolves to a redirect page
are dropped, same as red links (target not in entities.tsv).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from datapipeline.lib.page_sql import iter_linktargets, iter_pagelinks
from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    build_stage_manifest,
    input_fingerprint,
    is_output_current,
    write_stage_manifest,
)

MANIFEST_NAME = ".extract-wiki-edges-manifest.json"
DEFAULT_LINKTARGET = "enwiki-latest-linktarget.sql.gz"
DEFAULT_PAGELINKS = "enwiki-latest-pagelinks.sql.gz"
DEFAULT_ENTITIES = "entities.tsv"
DEFAULT_PAGE_IDS = "wiki_page_ids.tsv"
DEFAULT_OUTPUT = "edges_int.tsv"

_LT_CACHE_NPY = ".lt_id_to_dense_cache.npy"
_LT_CACHE_JSON = ".lt_id_to_dense_cache.json"


@dataclass
class WikiEdgesStats:
    links_read: int = 0
    ns0_links: int = 0
    unresolved_skipped: int = 0
    self_loops_skipped: int = 0
    edges_written: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "links_read": self.links_read,
            "ns0_links": self.ns0_links,
            "unresolved_skipped": self.unresolved_skipped,
            "self_loops_skipped": self.self_loops_skipped,
            "edges_written": self.edges_written,
        }


def _lt_cache_valid(
    out_dir: Path,
    linktarget_path: Path,
    entities_path: Path,
    redirect_map_path: Path | None,
) -> bool:
    cache = out_dir / _LT_CACHE_NPY
    meta = out_dir / _LT_CACHE_JSON
    if not cache.exists() or not meta.exists():
        return False
    try:
        recorded = json.loads(meta.read_text(encoding="utf-8"))
    except Exception:
        return False
    if recorded.get("linktarget") != input_fingerprint(linktarget_path):
        return False
    if recorded.get("entities") != input_fingerprint(entities_path):
        return False
    recorded_redir = recorded.get("redirect_map")
    current_redir = input_fingerprint(redirect_map_path) if redirect_map_path else None
    return recorded_redir == current_redir


def _save_lt_cache(
    out_dir: Path,
    table: np.ndarray,
    linktarget_path: Path,
    entities_path: Path,
    redirect_map_path: Path | None,
) -> None:
    # Use a .npy suffix on the temp path so numpy does not append a second .npy extension.
    tmp = out_dir / ".lt_id_to_dense_cache.tmp.npy"
    np.save(str(tmp), table)
    tmp.rename(out_dir / _LT_CACHE_NPY)
    meta = {
        "linktarget": input_fingerprint(linktarget_path),
        "entities": input_fingerprint(entities_path),
        "redirect_map": input_fingerprint(redirect_map_path) if redirect_map_path else None,
    }
    (out_dir / _LT_CACHE_JSON).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"extract_wiki_edges: lt_id_to_dense cached -> {out_dir / _LT_CACHE_NPY}")


def load_title_to_dense(entities_path: Path) -> dict[str, int]:
    title_to_dense: dict[str, int] = {}
    with entities_path.open(encoding="utf-8") as in_file:
        for dense_id, line in enumerate(in_file):
            title_to_dense[line.rstrip("\n")] = dense_id
    return title_to_dense


def load_page_id_to_dense(page_ids_path: Path) -> np.ndarray:
    page_ids = pd.read_csv(page_ids_path, header=None, dtype=np.int64)[0].to_numpy()
    table = np.full(int(page_ids.max()) + 1, -1, dtype=np.int32)
    table[page_ids] = np.arange(len(page_ids), dtype=np.int32)
    return table


def load_redirect_map(redirect_map_path: Path) -> dict[str, str]:
    """Return {redirect_title: canonical_title} from redirect_map.tsv."""
    redirect_map: dict[str, str] = {}
    with redirect_map_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            tab = line.index("\t")
            redirect_map[line[:tab]] = line[tab + 1 :]
    return redirect_map


def build_lt_id_to_dense(
    linktarget_path: Path,
    title_to_dense: dict[str, int],
    redirect_map: dict[str, str] | None = None,
) -> np.ndarray:
    id_chunks: list[np.ndarray] = []
    dense_chunks: list[np.ndarray] = []
    max_lt_id = 0

    for lt_ids, lt_namespaces, lt_titles in iter_linktargets(linktarget_path):
        dense = np.full(len(lt_ids), -1, dtype=np.int32)
        for i in range(len(lt_ids)):
            if lt_namespaces[i] == 0:
                dense_id = title_to_dense.get(lt_titles[i], -1)
                if dense_id == -1 and redirect_map is not None:
                    canonical = redirect_map.get(lt_titles[i])
                    if canonical is not None:
                        dense_id = title_to_dense.get(canonical, -1)
                dense[i] = dense_id
        id_chunks.append(lt_ids)
        dense_chunks.append(dense)
        max_lt_id = max(max_lt_id, int(lt_ids.max()))
        print(f"extract_wiki_edges: linktarget rows indexed (max lt_id so far {max_lt_id:,})")

    table = np.full(max_lt_id + 1, -1, dtype=np.int32)
    for lt_ids, dense in zip(id_chunks, dense_chunks):
        table[lt_ids] = dense
    return table


def extract_wiki_edges(
    linktarget_path: Path,
    pagelinks_path: Path,
    entities_path: Path,
    page_ids_path: Path,
    out: Path,
    *,
    redirect_map_path: Path | None = None,
    force: bool = False,
) -> WikiEdgesStats:
    stats = WikiEdgesStats()
    tmp = out.with_suffix(out.suffix + ".tmp")
    out_dir = out.parent

    print("extract_wiki_edges: loading entity title index")
    title_to_dense = load_title_to_dense(entities_path)
    print(f"extract_wiki_edges: {len(title_to_dense):,} entity titles")

    print("extract_wiki_edges: loading page id index")
    page_id_to_dense = load_page_id_to_dense(page_ids_path)

    if not force and _lt_cache_valid(out_dir, linktarget_path, entities_path, redirect_map_path):
        print("extract_wiki_edges: loading lt_id_to_dense from cache (skipping linktarget pass)")
        lt_id_to_dense = np.load(str(out_dir / _LT_CACHE_NPY))
        print(f"extract_wiki_edges: {len(lt_id_to_dense):,} linktarget ids loaded from cache")
    else:
        redirect_map: dict[str, str] | None = None
        if redirect_map_path is not None and redirect_map_path.is_file():
            print(f"extract_wiki_edges: loading redirect map from {redirect_map_path}")
            redirect_map = load_redirect_map(redirect_map_path)
            print(f"extract_wiki_edges: {len(redirect_map):,} redirect entries loaded")
        print("extract_wiki_edges: building linktarget -> dense index")
        lt_id_to_dense = build_lt_id_to_dense(linktarget_path, title_to_dense, redirect_map)
        print(f"extract_wiki_edges: {len(lt_id_to_dense):,} linktarget ids indexed")
        _save_lt_cache(out_dir, lt_id_to_dense, linktarget_path, entities_path, redirect_map_path)

    max_page_id = page_id_to_dense.shape[0] - 1
    max_lt_id = lt_id_to_dense.shape[0] - 1

    src_chunks: list[np.ndarray] = []
    dst_chunks: list[np.ndarray] = []

    for pl_from, pl_target_id, pl_from_namespace in iter_pagelinks(pagelinks_path):
        stats.links_read += len(pl_from)

        ns0 = pl_from_namespace == 0
        stats.ns0_links += int(ns0.sum())
        pl_from = pl_from[ns0]
        pl_target_id = pl_target_id[ns0]

        src = np.full(len(pl_from), -1, dtype=np.int32)
        from_in_range = pl_from <= max_page_id
        src[from_in_range] = page_id_to_dense[pl_from[from_in_range]]

        dst = np.full(len(pl_target_id), -1, dtype=np.int32)
        target_in_range = pl_target_id <= max_lt_id
        dst[target_in_range] = lt_id_to_dense[pl_target_id[target_in_range]]

        resolved = (src >= 0) & (dst >= 0)
        stats.unresolved_skipped += int(len(resolved) - int(resolved.sum()))
        src, dst = src[resolved], dst[resolved]

        keep = src != dst
        stats.self_loops_skipped += int(len(keep) - int(keep.sum()))
        src, dst = src[keep], dst[keep]

        src_chunks.append(src.astype(np.uint32))
        dst_chunks.append(dst.astype(np.uint32))

        print(f"extract_wiki_edges: {stats.links_read:,} pagelinks rows read")

    if src_chunks:
        all_src = np.concatenate(src_chunks)
        all_dst = np.concatenate(dst_chunks)
    else:
        all_src = np.empty(0, dtype=np.uint32)
        all_dst = np.empty(0, dtype=np.uint32)
    del src_chunks, dst_chunks

    stats.edges_written = len(all_src)

    pd.DataFrame({"src_id": all_src, "dst_id": all_dst}).to_csv(tmp, sep="\t", index=False)
    tmp.replace(out)
    return stats


def run(
    linktarget_path: Path,
    pagelinks_path: Path,
    entities_path: Path,
    page_ids_path: Path,
    out: Path,
    *,
    redirect_map_path: Path | None = None,
    force: bool = False,
) -> None:
    linktarget_path = linktarget_path.resolve()
    pagelinks_path = pagelinks_path.resolve()
    entities_path = entities_path.resolve()
    page_ids_path = page_ids_path.resolve()
    out = out.resolve()
    if redirect_map_path is not None:
        redirect_map_path = redirect_map_path.resolve()
    out_dir = out.parent

    for label, path in (
        ("linktarget", linktarget_path),
        ("pagelinks", pagelinks_path),
        ("entities", entities_path),
        ("page ids", page_ids_path),
    ):
        if not path.is_file():
            raise SystemExit(f"extract_wiki_edges: {label} not found: {path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    inputs = [linktarget_path, pagelinks_path, entities_path, page_ids_path]
    if redirect_map_path is not None and redirect_map_path.is_file():
        inputs.append(redirect_map_path)

    if not force and is_output_current(out, inputs, out_dir, MANIFEST_NAME):
        size = out.stat().st_size
        print(f"extract_wiki_edges: skip {out} (up to date, {size:,} bytes)")
        return

    print(
        f"extract_wiki_edges: {linktarget_path} + {pagelinks_path} "
        f"+ {entities_path} + {page_ids_path} -> {out}"
    )
    stats = extract_wiki_edges(
        linktarget_path,
        pagelinks_path,
        entities_path,
        page_ids_path,
        out,
        redirect_map_path=redirect_map_path,
        force=force,
    )

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_stage_manifest(output=out, inputs=inputs, stats=stats.as_dict()),
    )

    size = out.stat().st_size
    print(
        f"extract_wiki_edges: done -> {out} ({size:,} bytes, "
        f"{stats.edges_written:,} edges, {stats.links_read:,} pagelinks read, "
        f"{stats.ns0_links:,} ns0 links, "
        f"{stats.unresolved_skipped:,} unresolved skipped, "
        f"{stats.self_loops_skipped:,} self-loops skipped)"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Build edges_int.tsv from Wikipedia linktarget.sql + pagelinks.sql dumps."
    )
    parser.add_argument(
        "--linktarget",
        type=Path,
        default=raw_dir / DEFAULT_LINKTARGET,
        help=f"Input linktarget.sql(.gz) dump (default: raw/{DEFAULT_LINKTARGET})",
    )
    parser.add_argument(
        "--pagelinks",
        type=Path,
        default=raw_dir / DEFAULT_PAGELINKS,
        help=f"Input pagelinks.sql(.gz) dump (default: raw/{DEFAULT_PAGELINKS})",
    )
    parser.add_argument(
        "--entities",
        type=Path,
        default=data_dir / DEFAULT_ENTITIES,
        help=f"Entity titles, dense id -> title (default: data/{DEFAULT_ENTITIES})",
    )
    parser.add_argument(
        "--page-ids",
        type=Path,
        default=data_dir / DEFAULT_PAGE_IDS,
        help=f"Dense id -> Wikipedia page_id (default: data/{DEFAULT_PAGE_IDS})",
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
        run(
            args.linktarget,
            args.pagelinks,
            args.entities,
            args.page_ids,
            args.out,
            force=args.force,
        )
    except SystemExit:
        raise
    except Exception as exc:
        print(f"extract_wiki_edges: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
