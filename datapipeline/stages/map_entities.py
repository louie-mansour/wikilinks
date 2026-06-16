"""Reads ent.wikipedia_link_en; output: data/entities.tsv (one title per line, 0-indexed id)."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.lib.stage_cache import (
    build_stage_manifest,
    is_output_current,
    write_stage_manifest,
)

MANIFEST_NAME = ".map-entities-manifest.json"
DEFAULT_INPUT = "ent.wikipedia_link_en"
DEFAULT_OUTPUT = "entities.tsv"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class MapEntitiesStats:
    lines_read: int = 0
    entities_written: int = 0
    empty_skipped: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "lines_read": self.lines_read,
            "entities_written": self.entities_written,
            "empty_skipped": self.empty_skipped,
        }


def map_entities(inp: Path, out: Path) -> MapEntitiesStats:
    stats = MapEntitiesStats()
    tmp = out.with_suffix(out.suffix + ".tmp")

    with inp.open(encoding="utf-8") as in_file, tmp.open("w", encoding="utf-8") as out_file:
        for line in in_file:
            stats.lines_read += 1
            title = line.rstrip("\n\r")
            if not title.strip():
                stats.empty_skipped += 1
                continue
            out_file.write(f"{title}\n")
            stats.entities_written += 1

            if stats.lines_read % PROGRESS_INTERVAL == 0:
                print(
                    f"map_entities: {stats.lines_read:,} lines read, "
                    f"{stats.entities_written:,} entities written"
                )

    tmp.replace(out)
    return stats


def run(inp: Path, out: Path, *, force: bool = False) -> None:
    inp = inp.resolve()
    out = out.resolve()
    out_dir = out.parent

    if not inp.is_file():
        raise SystemExit(f"map_entities: input not found: {inp}")

    out_dir.mkdir(parents=True, exist_ok=True)

    if not force and is_output_current(out, [inp], out_dir, MANIFEST_NAME):
        size = out.stat().st_size
        print(f"map_entities: skip {out} (up to date, {size:,} bytes)")
        return

    print(f"map_entities: {inp} -> {out}")
    stats = map_entities(inp, out)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_stage_manifest(output=out, inputs=[inp], stats=stats.as_dict()),
    )

    size = out.stat().st_size
    print(
        f"map_entities: done -> {out} ({size:,} bytes, "
        f"{stats.entities_written:,} entities, "
        f"{stats.empty_skipped:,} empty skipped)"
    )


def main(argv: list[str] | None = None) -> None:
    raw_dir = default_raw_dir()
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Copy KONECT entity titles into entities.tsv."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=raw_dir / DEFAULT_INPUT,
        help=f"Input entity file (default: raw/{DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=data_dir / DEFAULT_OUTPUT,
        help=f"Output entities file (default: data/{DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.inp, args.out, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"map_entities: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
