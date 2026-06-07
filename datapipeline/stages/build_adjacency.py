"""Reads edges_int.tsv; outputs: adj_fwd.* + adj_rev.* (CSR binaries for Rust mmap)."""

from __future__ import annotations

import argparse
import array
import csv
import sys
from dataclasses import dataclass
from pathlib import Path

from datapipeline.lib.csr import (
    count_nonzero_rows,
    prefix_offsets,
    write_u32_array,
)
from datapipeline.lib.paths import default_data_dir
from datapipeline.lib.stage_cache import (
    are_outputs_current,
    build_multi_output_manifest,
    write_stage_manifest,
)

MANIFEST_NAME = ".build-adjacency-manifest.json"
DEFAULT_INPUT = "edges_int.tsv"
DEFAULT_ENTITIES = "entities.tsv"
FWD_OFFSETS = "adj_fwd.offsets.bin"
FWD_NEIGHBORS = "adj_fwd.neighbors.bin"
REV_OFFSETS = "adj_rev.offsets.bin"
REV_NEIGHBORS = "adj_rev.neighbors.bin"
PROGRESS_INTERVAL = 1_000_000


@dataclass
class AdjacencyStats:
    entity_count: int = 0
    edge_count: int = 0
    fwd_nonzero_rows: int = 0
    rev_nonzero_rows: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "entity_count": self.entity_count,
            "edge_count": self.edge_count,
            "fwd_nonzero_rows": self.fwd_nonzero_rows,
            "rev_nonzero_rows": self.rev_nonzero_rows,
        }


def count_entities(entities_path: Path) -> int:
    count = 0
    with entities_path.open(encoding="utf-8") as in_file:
        for line in in_file:
            if line.strip():
                count += 1
    return count


def count_degrees(
    inp: Path, entity_count: int
) -> tuple[array.array, array.array, int]:
    out_degree = array.array("I", [0]) * entity_count
    in_degree = array.array("I", [0]) * entity_count
    edge_count = 0
    max_node_id = 0

    with inp.open(newline="", encoding="utf-8") as in_file:
        reader = csv.DictReader(in_file, delimiter="\t")
        if reader.fieldnames is None:
            raise SystemExit(f"build_adjacency: empty or headerless TSV: {inp}")

        required = {"src_id", "dst_id"}
        missing = required - set(reader.fieldnames)
        if missing:
            raise SystemExit(
                f"build_adjacency: missing columns {sorted(missing)} in {inp}"
            )

        for row in reader:
            edge_count += 1
            src_id = int(row["src_id"])
            dst_id = int(row["dst_id"])

            if src_id < 0 or dst_id < 0:
                raise SystemExit(
                    f"build_adjacency: negative node id in {inp} "
                    f"(src_id={src_id}, dst_id={dst_id})"
                )
            if src_id >= entity_count or dst_id >= entity_count:
                raise SystemExit(
                    f"build_adjacency: node id out of range in {inp} "
                    f"(src_id={src_id}, dst_id={dst_id}, entity_count={entity_count})"
                )

            out_degree[src_id] += 1
            in_degree[dst_id] += 1
            max_node_id = max(max_node_id, src_id, dst_id)

            if edge_count % PROGRESS_INTERVAL == 0:
                print(f"build_adjacency: counted {edge_count:,} edges")

    if edge_count == 0:
        raise SystemExit(f"build_adjacency: no edges found in {inp}")

    print(
        f"build_adjacency: {edge_count:,} edges, "
        f"max node id {max_node_id:,} (entity_count {entity_count:,})"
    )
    return out_degree, in_degree, edge_count


def scatter_edges(
    inp: Path,
    entity_count: int,
    fwd_write: array.array,
    rev_write: array.array,
    fwd_neighbors: array.array,
    rev_neighbors: array.array,
) -> None:
    edges_read = 0

    with inp.open(newline="", encoding="utf-8") as in_file:
        reader = csv.DictReader(in_file, delimiter="\t")
        if reader.fieldnames is None:
            raise SystemExit(f"build_adjacency: empty or headerless TSV: {inp}")

        for row in reader:
            edges_read += 1
            src_id = int(row["src_id"])
            dst_id = int(row["dst_id"])

            fwd_pos = fwd_write[src_id]
            fwd_neighbors[fwd_pos] = dst_id
            fwd_write[src_id] = fwd_pos + 1

            rev_pos = rev_write[dst_id]
            rev_neighbors[rev_pos] = src_id
            rev_write[dst_id] = rev_pos + 1

            if edges_read % PROGRESS_INTERVAL == 0:
                print(f"build_adjacency: scattered {edges_read:,} edges")


def write_csr_bundle(
    out_dir: Path,
    fwd_offsets: array.array,
    fwd_neighbors: array.array,
    rev_offsets: array.array,
    rev_neighbors: array.array,
) -> list[Path]:
    outputs = [
        out_dir / FWD_OFFSETS,
        out_dir / FWD_NEIGHBORS,
        out_dir / REV_OFFSETS,
        out_dir / REV_NEIGHBORS,
    ]

    write_u32_array(outputs[0], fwd_offsets)
    write_u32_array(outputs[1], fwd_neighbors)
    write_u32_array(outputs[2], rev_offsets)
    write_u32_array(outputs[3], rev_neighbors)
    return outputs


def build_adjacency(inp: Path, entities_path: Path, out_dir: Path) -> AdjacencyStats:
    stats = AdjacencyStats()

    print("build_adjacency: counting entities")
    stats.entity_count = count_entities(entities_path)
    if stats.entity_count == 0:
        raise SystemExit(f"build_adjacency: no entities found in {entities_path}")
    print(f"build_adjacency: {stats.entity_count:,} entities")

    print("build_adjacency: pass 1 — counting degrees")
    out_degree, in_degree, stats.edge_count = count_degrees(inp, stats.entity_count)

    fwd_offsets = prefix_offsets(out_degree)
    rev_offsets = prefix_offsets(in_degree)

    if fwd_offsets[-1] != stats.edge_count or rev_offsets[-1] != stats.edge_count:
        raise SystemExit(
            "build_adjacency: degree totals do not match edge count "
            f"({fwd_offsets[-1]:,}, {rev_offsets[-1]:,}, {stats.edge_count:,})"
        )

    stats.fwd_nonzero_rows = count_nonzero_rows(fwd_offsets)
    stats.rev_nonzero_rows = count_nonzero_rows(rev_offsets)
    print(
        f"build_adjacency: forward rows with out-degree > 0: "
        f"{stats.fwd_nonzero_rows:,}; reverse rows with in-degree > 0: "
        f"{stats.rev_nonzero_rows:,}"
    )

    print("build_adjacency: pass 2 — allocating neighbor arrays")
    fwd_neighbors = array.array("I", [0]) * stats.edge_count
    rev_neighbors = array.array("I", [0]) * stats.edge_count
    fwd_write = array.array(
        "I", (fwd_offsets[i] for i in range(stats.entity_count))
    )
    rev_write = array.array(
        "I", (rev_offsets[i] for i in range(stats.entity_count))
    )

    print("build_adjacency: pass 3 — scattering edges")
    scatter_edges(
        inp,
        stats.entity_count,
        fwd_write,
        rev_write,
        fwd_neighbors,
        rev_neighbors,
    )

    print("build_adjacency: writing CSR binaries")
    write_csr_bundle(out_dir, fwd_offsets, fwd_neighbors, rev_offsets, rev_neighbors)
    return stats


def default_outputs(out_dir: Path) -> list[Path]:
    return [
        out_dir / FWD_OFFSETS,
        out_dir / FWD_NEIGHBORS,
        out_dir / REV_OFFSETS,
        out_dir / REV_NEIGHBORS,
    ]


def run(
    inp: Path,
    entities_path: Path,
    out_dir: Path,
    *,
    force: bool = False,
) -> None:
    inp = inp.resolve()
    entities_path = entities_path.resolve()
    out_dir = out_dir.resolve()
    outputs = default_outputs(out_dir)
    inputs = [inp, entities_path]

    if not inp.is_file():
        raise SystemExit(f"build_adjacency: input not found: {inp}")
    if not entities_path.is_file():
        raise SystemExit(f"build_adjacency: entities not found: {entities_path}")

    out_dir.mkdir(parents=True, exist_ok=True)

    if not force and are_outputs_current(outputs, inputs, out_dir, MANIFEST_NAME):
        sizes = ", ".join(f"{path.name} ({path.stat().st_size:,} bytes)" for path in outputs)
        print(f"build_adjacency: skip {out_dir} (up to date, {sizes})")
        return

    print(f"build_adjacency: {inp} + {entities_path} -> {out_dir}")
    stats = build_adjacency(inp, entities_path, out_dir)

    write_stage_manifest(
        out_dir,
        MANIFEST_NAME,
        build_multi_output_manifest(
            outputs=outputs,
            inputs=inputs,
            stats=stats.as_dict(),
        ),
    )

    sizes = ", ".join(f"{path.name} ({path.stat().st_size:,} bytes)" for path in outputs)
    print(
        f"build_adjacency: done -> {out_dir} "
        f"({stats.edge_count:,} edges, {stats.entity_count:,} entities, {sizes})"
    )


def main(argv: list[str] | None = None) -> None:
    data_dir = default_data_dir()

    parser = argparse.ArgumentParser(
        description="Build forward and reverse CSR adjacency from integer edges."
    )
    parser.add_argument(
        "--in",
        dest="inp",
        type=Path,
        default=data_dir / DEFAULT_INPUT,
        help=f"Input integer edge TSV (default: data/{DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--entities",
        type=Path,
        default=data_dir / DEFAULT_ENTITIES,
        help=f"Entity lookup file (default: data/{DEFAULT_ENTITIES})",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=data_dir,
        help="Output directory for CSR binaries (default: data/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.inp, args.entities, args.out_dir, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"build_adjacency: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
