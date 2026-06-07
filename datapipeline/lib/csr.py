"""CSR helpers: prefix offsets, little-endian u32 arrays for adjacency binaries.

Contract: datapipeline/decisions/adjacency-csr.md
"""

from __future__ import annotations

import array
import sys
from pathlib import Path


def prefix_offsets(degree: array.array) -> array.array:
    """Turn per-node degrees into CSR offsets (length len(degree) + 1)."""
    offsets = array.array("I", [0])
    total = 0
    for value in degree:
        total += value
        offsets.append(total)
    return offsets


def count_nonzero_rows(offsets: array.array) -> int:
    """Count nodes with at least one neighbor."""
    return sum(
        1
        for i in range(len(offsets) - 1)
        if offsets[i] != offsets[i + 1]
    )


def neighbors_slice(
    offsets: array.array, neighbors: array.array, node_id: int
) -> list[int]:
    """Return neighbors for node_id (test helper)."""
    start = offsets[node_id]
    end = offsets[node_id + 1]
    return list(neighbors[start:end])


def write_u32_array(path: Path, values: array.array) -> None:
    """Write u32 values as little-endian bytes, atomically via a .tmp sibling."""
    if values.typecode != "I":
        raise ValueError(f"expected u32 array, got typecode {values.typecode!r}")

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.parent.mkdir(parents=True, exist_ok=True)
    data = values.tobytes()
    if sys.byteorder != "little":
        swapped = array.array("I", values)
        swapped.byteswap()
        data = swapped.tobytes()

    tmp.write_bytes(data)
    tmp.replace(path)


def read_u32_array(path: Path) -> array.array:
    """Read a little-endian u32 array written by write_u32_array."""
    data = path.read_bytes()
    if len(data) % 4 != 0:
        raise ValueError(f"u32 file size not a multiple of 4: {path}")

    values = array.array("I")
    values.frombytes(data)
    if sys.byteorder != "little":
        values.byteswap()
    return values
