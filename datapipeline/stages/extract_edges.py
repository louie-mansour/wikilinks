"""Reads links_export.csv; output: data/edges.tsv (source_title, target_title), deduplicated."""

from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    build_stage_manifest,
    is_output_current,
    write_stage_manifest,
)

MANIFEST_NAME = ".extract-edges-manifest.json"
DEFAULT_INPUT = "links_export.csv"
DEFAULT_OUTPUT = "edges.tsv"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class ExtractStats:
    rows_read: int = 0
    edges_written: int = 0
    duplicates_skipped: int = 0
    self_loops_skipped: int = 0
    empty_skipped: int = 0
    depth_filtered: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "rows_read": self.rows_read,
            "edges_written": self.edges_written,
            "duplicates_skipped": self.duplicates_skipped,
            "self_loops_skipped": self.self_loops_skipped,
            "empty_skipped": self.empty_skipped,
            "depth_filtered": self.depth_filtered,
        }


def edge_hash(source: str, target: str) -> bytes:
    # 64-bit digest keeps the seen-set small (~500 MB–1 GB at ~29M edges).
    # Collision would drop a distinct edge; negligible at this scale.
    payload = f"{source}\0{target}".encode()
    return hashlib.blake2b(payload, digest_size=8).digest()


def extract_edges(
    inp: Path, out: Path, seen: set[bytes], max_depth: int | None = None
) -> ExtractStats:
    stats = ExtractStats()
    tmp = out.with_suffix(out.suffix + ".tmp")

    with inp.open(newline="", encoding="utf-8") as in_file, tmp.open(
        "w", newline="", encoding="utf-8"
    ) as out_file:
        reader = csv.DictReader(in_file)
        if reader.fieldnames is None:
            raise SystemExit(f"extract_edges: empty or headerless CSV: {inp}")

        required = {"source_title", "target_title"}
        missing = required - set(reader.fieldnames)
        if missing:
            raise SystemExit(
                f"extract_edges: missing columns {sorted(missing)} in {inp}"
            )

        writer = csv.writer(out_file, delimiter="\t", lineterminator="\n")
        writer.writerow(["source_title", "target_title"])

        for row in reader:
            stats.rows_read += 1
            source = (row.get("source_title") or "").strip()
            target = (row.get("target_title") or "").strip()

            if not source or not target:
                stats.empty_skipped += 1
                continue
            if source == target:
                stats.self_loops_skipped += 1
                continue

            if max_depth is not None:
                raw_depth = (row.get("depth") or "").strip()
                try:
                    if int(raw_depth) > max_depth:
                        stats.depth_filtered += 1
                        continue
                except ValueError:
                    pass

            key = edge_hash(source, target)
            if key in seen:
                stats.duplicates_skipped += 1
                continue

            seen.add(key)
            writer.writerow([source, target])
            stats.edges_written += 1

            if stats.rows_read % PROGRESS_INTERVAL == 0:
                print(
                    f"extract_edges: {stats.rows_read:,} rows read, "
                    f"{stats.edges_written:,} edges written"
                )

    tmp.replace(out)
    return stats


def run(inp: Path, out: Path, *, force: bool = False, max_depth: int | None = None) -> None:
    inp = inp.resolve()
    out = out.resolve()
    out_dir = out.parent

    if not inp.is_file():
        raise SystemExit(f"extract_edges: input not found: {inp}")

    out_dir.mkdir(parents=True, exist_ok=True)

    if not force and is_output_current(out, [inp], out_dir, MANIFEST_NAME):
        size = out.stat().st_size
        print(f"extract_edges: skip {out} (up to date, {size:,} bytes)")
        return

    depth_msg = f" (max depth={max_depth})" if max_depth is not None else ""
    print(f"extract_edges: {inp} -> {out}{depth_msg}")
    seen: set[bytes] = set()
    stats = extract_edges(inp, out, seen, max_depth=max_depth)

    manifest_stats = stats.as_dict()
    if max_depth is not None:
        manifest_stats["max_depth"] = max_depth

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_stage_manifest(output=out, inputs=[inp], stats=manifest_stats),
    )

    size = out.stat().st_size
    depth_filtered_msg = (
        f", {stats.depth_filtered:,} depth-filtered" if max_depth is not None else ""
    )
    print(
        f"extract_edges: done -> {out} ({size:,} bytes, "
        f"{stats.edges_written:,} edges, "
        f"{stats.duplicates_skipped:,} duplicates skipped, "
        f"{stats.self_loops_skipped:,} self-loops skipped, "
        f"{stats.empty_skipped:,} empty skipped"
        f"{depth_filtered_msg})"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Extract deduplicated edge pairs from links_export.csv."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=raw_dir / DEFAULT_INPUT,
        help=f"Input CSV (default: raw/{DEFAULT_INPUT})",
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
    parser.add_argument(
        "--max-depth",
        dest="max_depth",
        type=int,
        default=None,
        help=(
            "Drop links with HTML nesting depth > MAX_DEPTH. "
            "depth=1–2 is main body/section text; depth=3+ is navboxes/accordions. "
            "Omit to keep all links (default)."
        ),
    )
    args = parser.parse_args(argv)

    try:
        run(args.inp, args.out, force=args.force, max_depth=args.max_depth)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"extract_edges: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
