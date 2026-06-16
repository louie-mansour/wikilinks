"""Reads out.wikipedia_link_en; output: data/edges_int.tsv (src_id, dst_id), deduplicated."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    build_stage_manifest,
    is_output_current,
    write_stage_manifest,
)

MANIFEST_NAME = ".edges-to-int-manifest.json"
DEFAULT_INPUT = "out.wikipedia_link_en"
DEFAULT_ENTITIES = "entities.tsv"
DEFAULT_OUTPUT = "edges_int.tsv"
CHUNK_ROWS = 20_000_000


@dataclass
class EdgesToIntStats:
    rows_read: int = 0
    edges_written: int = 0
    duplicates_skipped: int = 0
    self_loops_skipped: int = 0
    invalid_skipped: int = 0
    comment_skipped: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "rows_read": self.rows_read,
            "edges_written": self.edges_written,
            "duplicates_skipped": self.duplicates_skipped,
            "self_loops_skipped": self.self_loops_skipped,
            "invalid_skipped": self.invalid_skipped,
            "comment_skipped": self.comment_skipped,
        }


def count_entity_lines(entities: Path) -> int:
    count = 0
    with entities.open(encoding="utf-8") as in_file:
        for line in in_file:
            if line.strip():
                count += 1
    return count


def count_leading_comment_lines(inp: Path) -> int:
    """Count KONECT '%' header lines at the top of an out.* edge file."""
    count = 0
    with inp.open("rb") as in_file:
        for raw_line in in_file:
            if raw_line.lstrip().startswith(b"%"):
                count += 1
            else:
                break
    return count


def edges_to_int(inp: Path, out: Path, *, entity_count: int) -> EdgesToIntStats:
    stats = EdgesToIntStats()
    tmp = out.with_suffix(out.suffix + ".tmp")
    stats.comment_skipped = count_leading_comment_lines(inp)

    reader = pd.read_csv(
        inp,
        sep=r"\s+",
        header=None,
        names=["src", "dst"],
        dtype=np.int64,
        skiprows=stats.comment_skipped,
        chunksize=CHUNK_ROWS,
    )

    key_chunks: list[np.ndarray] = []
    for chunk in reader:
        stats.rows_read += len(chunk)
        src = chunk["src"].to_numpy()
        dst = chunk["dst"].to_numpy()

        valid = (src >= 1) & (src <= entity_count) & (dst >= 1) & (dst <= entity_count)
        stats.invalid_skipped += int(len(valid) - int(valid.sum()))
        src, dst = src[valid], dst[valid]

        keep = src != dst
        stats.self_loops_skipped += int(len(keep) - int(keep.sum()))
        src, dst = src[keep], dst[keep]

        key = (src.astype(np.uint64) - 1) * entity_count + (dst.astype(np.uint64) - 1)
        key_chunks.append(key)

        print(f"edges_to_int: {stats.rows_read:,} rows read")

    if key_chunks:
        all_keys = np.concatenate(key_chunks)
    else:
        all_keys = np.empty(0, dtype=np.uint64)
    del key_chunks

    _, first_index = np.unique(all_keys, return_index=True)
    order = np.sort(first_index)
    ordered_keys = all_keys[order]
    stats.duplicates_skipped = len(all_keys) - len(ordered_keys)
    del all_keys, first_index, order

    src_ids = (ordered_keys // entity_count).astype(np.uint32)
    dst_ids = (ordered_keys % entity_count).astype(np.uint32)
    stats.edges_written = len(ordered_keys)
    del ordered_keys

    pd.DataFrame({"src_id": src_ids, "dst_id": dst_ids}).to_csv(
        tmp, sep="\t", index=False
    )

    tmp.replace(out)
    return stats


def run(
    inp: Path,
    entities: Path,
    out: Path,
    *,
    force: bool = False,
) -> None:
    inp = inp.resolve()
    entities = entities.resolve()
    out = out.resolve()
    out_dir = out.parent

    if not inp.is_file():
        raise SystemExit(f"edges_to_int: input not found: {inp}")
    if not entities.is_file():
        raise SystemExit(f"edges_to_int: entities not found: {entities}")

    out_dir.mkdir(parents=True, exist_ok=True)

    inputs = [inp, entities]
    if not force and is_output_current(out, inputs, out_dir, MANIFEST_NAME):
        size = out.stat().st_size
        print(f"edges_to_int: skip {out} (up to date, {size:,} bytes)")
        return

    entity_count = count_entity_lines(entities)
    if entity_count == 0:
        raise SystemExit(f"edges_to_int: no entities in {entities}")

    print(
        f"edges_to_int: {inp} + {entities} ({entity_count:,} entities) -> {out}"
    )
    stats = edges_to_int(inp, out, entity_count=entity_count)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_stage_manifest(output=out, inputs=inputs, stats=stats.as_dict()),
    )

    size = out.stat().st_size
    print(
        f"edges_to_int: done -> {out} ({size:,} bytes, "
        f"{stats.edges_written:,} edges, "
        f"{stats.duplicates_skipped:,} duplicates skipped, "
        f"{stats.self_loops_skipped:,} self-loops skipped, "
        f"{stats.invalid_skipped:,} invalid skipped)"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Convert KONECT integer edge list to edges_int.tsv."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=raw_dir / DEFAULT_INPUT,
        help=f"Input edge file (default: raw/{DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--entities",
        type=Path,
        default=data_dir / DEFAULT_ENTITIES,
        help=f"Entity lookup file (default: data/{DEFAULT_ENTITIES})",
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
        run(args.inp, args.entities, args.out, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"edges_to_int: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
