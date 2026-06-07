"""Reads edges.tsv; outputs: entities.tsv (id→title), edges_int.tsv (src_id, dst_id)."""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.paths import default_data_dir
from datapipeline.lib.stage_cache import (
    are_outputs_current,
    build_multi_output_manifest,
    write_stage_manifest,
)

MANIFEST_NAME = ".build-vocab-manifest.json"
DEFAULT_INPUT = "edges.tsv"
DEFAULT_ENTITIES = "entities.tsv"
DEFAULT_OUTPUT = "edges_int.tsv"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class VocabStats:
    edges_read: int = 0
    entities_count: int = 0
    edges_written: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "edges_read": self.edges_read,
            "entities_count": self.entities_count,
            "edges_written": self.edges_written,
        }


class Vocabulary:
    def __init__(self) -> None:
        self._title_to_id: dict[str, int] = {}
        self._titles: list[str] = []

    def intern(self, title: str) -> int:
        existing = self._title_to_id.get(title)
        if existing is not None:
            return existing

        node_id = len(self._titles)
        self._title_to_id[title] = node_id
        self._titles.append(title)
        return node_id

    @property
    def titles(self) -> list[str]:
        return self._titles

    @property
    def title_to_id(self) -> dict[str, int]:
        return self._title_to_id

    def __len__(self) -> int:
        return len(self._titles)


def build_vocabulary(inp: Path) -> Vocabulary:
    vocab = Vocabulary()

    with inp.open(newline="", encoding="utf-8") as in_file:
        reader = csv.DictReader(in_file, delimiter="\t")
        if reader.fieldnames is None:
            raise SystemExit(f"build_vocab: empty or headerless TSV: {inp}")

        required = {"source_title", "target_title"}
        missing = required - set(reader.fieldnames)
        if missing:
            raise SystemExit(
                f"build_vocab: missing columns {sorted(missing)} in {inp}"
            )

        for row in reader:
            source = (row.get("source_title") or "").strip()
            target = (row.get("target_title") or "").strip()
            vocab.intern(source)
            vocab.intern(target)

    return vocab


def write_entities(entities_path: Path, vocab: Vocabulary) -> None:
    tmp = entities_path.with_suffix(entities_path.suffix + ".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as out_file:
        for title in vocab.titles:
            out_file.write(f"{title}\n")
    tmp.replace(entities_path)


def write_int_edges(inp: Path, out: Path, vocab: Vocabulary) -> VocabStats:
    stats = VocabStats()
    tmp = out.with_suffix(out.suffix + ".tmp")

    with inp.open(newline="", encoding="utf-8") as in_file, tmp.open(
        "w", newline="", encoding="utf-8"
    ) as out_file:
        reader = csv.DictReader(in_file, delimiter="\t")
        if reader.fieldnames is None:
            raise SystemExit(f"build_vocab: empty or headerless TSV: {inp}")

        writer = csv.writer(out_file, delimiter="\t", lineterminator="\n")
        writer.writerow(["src_id", "dst_id"])

        for row in reader:
            stats.edges_read += 1
            source = (row.get("source_title") or "").strip()
            target = (row.get("target_title") or "").strip()
            writer.writerow(
                [vocab.title_to_id[source], vocab.title_to_id[target]]
            )
            stats.edges_written += 1

            if stats.edges_read % PROGRESS_INTERVAL == 0:
                print(
                    f"build_vocab: {stats.edges_read:,} edges read, "
                    f"{stats.edges_written:,} int edges written"
                )

    tmp.replace(out)
    stats.entities_count = len(vocab)
    return stats


def build_vocab(inp: Path, entities_path: Path, out: Path) -> VocabStats:
    print("build_vocab: pass 1 — building vocabulary")
    vocab = build_vocabulary(inp)
    print(f"build_vocab: {len(vocab):,} entities")

    write_entities(entities_path, vocab)

    print("build_vocab: pass 2 — writing integer edges")
    return write_int_edges(inp, out, vocab)


def run(
    inp: Path,
    entities_path: Path,
    out: Path,
    *,
    force: bool = False,
) -> None:
    inp = inp.resolve()
    entities_path = entities_path.resolve()
    out = out.resolve()
    out_dir = out.parent

    if not inp.is_file():
        raise SystemExit(f"build_vocab: input not found: {inp}")

    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = [entities_path, out]

    if not force and are_outputs_current(outputs, [inp], out_dir, MANIFEST_NAME):
        entities_size = entities_path.stat().st_size
        edges_size = out.stat().st_size
        print(
            f"build_vocab: skip {entities_path} and {out} "
            f"(up to date, {entities_size:,} + {edges_size:,} bytes)"
        )
        return

    print(f"build_vocab: {inp} -> {entities_path}, {out}")
    stats = build_vocab(inp, entities_path, out)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_multi_output_manifest(
            outputs=outputs,
            inputs=[inp],
            stats=stats.as_dict(),
        ),
    )

    entities_size = entities_path.stat().st_size
    edges_size = out.stat().st_size
    print(
        f"build_vocab: done -> {entities_path} ({entities_size:,} bytes, "
        f"{stats.entities_count:,} entities), "
        f"{out} ({edges_size:,} bytes, {stats.edges_written:,} edges)"
    )


def main(argv: list[str] | None = None) -> None:
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Intern article titles to integer IDs and write compressed edges."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=data_dir / DEFAULT_INPUT,
        help=f"Input TSV (default: data/{DEFAULT_INPUT})",
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
        help=f"Integer edge TSV (default: data/{DEFAULT_OUTPUT})",
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
        print(f"build_vocab: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
