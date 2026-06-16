"""Reads edges_int.tsv; writes the graph bundle (adj_fwd.* + adj_rev.*).

Contract: datapipeline/decisions/adjacency-csr.md
"""

from __future__ import annotations

import argparse
import array
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from datapipeline.lib.csr import write_u32_array
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
CHUNK_ROWS = 20_000_000


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


def read_edges(inp: Path, entity_count: int) -> tuple[np.ndarray, np.ndarray]:
    """Read src_id/dst_id columns as uint32 arrays, validating node id ranges."""
    reader = pd.read_csv(inp, sep="\t", dtype=np.int64, chunksize=CHUNK_ROWS)

    src_chunks: list[np.ndarray] = []
    dst_chunks: list[np.ndarray] = []
    total = 0

    for chunk in reader:
        missing = {"src_id", "dst_id"} - set(chunk.columns)
        if missing:
            raise SystemExit(
                f"build_adjacency: missing columns {sorted(missing)} in {inp}"
            )

        src = chunk["src_id"].to_numpy()
        dst = chunk["dst_id"].to_numpy()

        bad = (src < 0) | (dst < 0) | (src >= entity_count) | (dst >= entity_count)
        if bad.any():
            i = int(np.argmax(bad))
            raise SystemExit(
                f"build_adjacency: node id out of range in {inp} "
                f"(src_id={src[i]}, dst_id={dst[i]}, entity_count={entity_count})"
            )

        src_chunks.append(src.astype(np.uint32))
        dst_chunks.append(dst.astype(np.uint32))
        total += len(chunk)
        print(f"build_adjacency: read {total:,} edges")

    if not src_chunks:
        raise SystemExit(f"build_adjacency: no edges found in {inp}")

    return np.concatenate(src_chunks), np.concatenate(dst_chunks)


def to_u32_array(values: np.ndarray) -> array.array:
    """Convert a numpy array to array.array('I') for csr.write_u32_array."""
    arr = array.array("I")
    arr.frombytes(values.astype(np.uint32, copy=False).tobytes())
    return arr


def write_csr_bundle(
    out_dir: Path,
    fwd_offsets: np.ndarray,
    fwd_neighbors: np.ndarray,
    rev_offsets: np.ndarray,
    rev_neighbors: np.ndarray,
) -> list[Path]:
    outputs = [
        out_dir / FWD_OFFSETS,
        out_dir / FWD_NEIGHBORS,
        out_dir / REV_OFFSETS,
        out_dir / REV_NEIGHBORS,
    ]

    write_u32_array(outputs[0], to_u32_array(fwd_offsets))
    write_u32_array(outputs[1], to_u32_array(fwd_neighbors))
    write_u32_array(outputs[2], to_u32_array(rev_offsets))
    write_u32_array(outputs[3], to_u32_array(rev_neighbors))
    return outputs


def build_adjacency(inp: Path, entities_path: Path, out_dir: Path) -> AdjacencyStats:
    stats = AdjacencyStats()

    print("build_adjacency: counting entities")
    stats.entity_count = count_entities(entities_path)
    if stats.entity_count == 0:
        raise SystemExit(f"build_adjacency: no entities found in {entities_path}")
    print(f"build_adjacency: {stats.entity_count:,} entities")

    print("build_adjacency: reading edges")
    src_ids, dst_ids = read_edges(inp, stats.entity_count)
    stats.edge_count = len(src_ids)
    print(
        f"build_adjacency: {stats.edge_count:,} edges "
        f"(entity_count {stats.entity_count:,})"
    )

    print("build_adjacency: computing degrees")
    out_degree = np.bincount(src_ids, minlength=stats.entity_count)
    in_degree = np.bincount(dst_ids, minlength=stats.entity_count)

    fwd_offsets = np.concatenate(([0], np.cumsum(out_degree))).astype(np.uint32)
    rev_offsets = np.concatenate(([0], np.cumsum(in_degree))).astype(np.uint32)

    if (
        int(fwd_offsets[-1]) != stats.edge_count
        or int(rev_offsets[-1]) != stats.edge_count
    ):
        raise SystemExit(
            "build_adjacency: degree totals do not match edge count "
            f"({int(fwd_offsets[-1]):,}, {int(rev_offsets[-1]):,}, "
            f"{stats.edge_count:,})"
        )

    stats.fwd_nonzero_rows = int(np.count_nonzero(out_degree))
    stats.rev_nonzero_rows = int(np.count_nonzero(in_degree))
    print(
        f"build_adjacency: forward rows with out-degree > 0: "
        f"{stats.fwd_nonzero_rows:,}; reverse rows with in-degree > 0: "
        f"{stats.rev_nonzero_rows:,}"
    )

    print("build_adjacency: ordering neighbors")
    fwd_neighbors = dst_ids[np.argsort(src_ids, kind="stable")]
    rev_neighbors = src_ids[np.argsort(dst_ids, kind="stable")]

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
