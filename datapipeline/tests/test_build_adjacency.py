from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from datapipeline.lib.csr import neighbors_slice, read_u32_array
from datapipeline.lib.stage_cache import read_stage_manifest
from datapipeline.stages import build_adjacency

FIXTURE = Path(__file__).parent / "fixtures" / "edges_int_sample.tsv"
ENTITIES_FIXTURE = Path(__file__).parent / "fixtures" / "entities_sample.tsv"


class BuildAdjacencyTest(unittest.TestCase):
    def test_build_adjacency_writes_csr_binaries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "data"

            stats = build_adjacency.build_adjacency(
                FIXTURE, ENTITIES_FIXTURE, out_dir
            )

            self.assertEqual(stats.entity_count, 5)
            self.assertEqual(stats.edge_count, 4)
            self.assertEqual(stats.fwd_nonzero_rows, 3)
            self.assertEqual(stats.rev_nonzero_rows, 3)

            fwd_offsets = read_u32_array(out_dir / build_adjacency.FWD_OFFSETS)
            fwd_neighbors = read_u32_array(out_dir / build_adjacency.FWD_NEIGHBORS)
            rev_offsets = read_u32_array(out_dir / build_adjacency.REV_OFFSETS)
            rev_neighbors = read_u32_array(out_dir / build_adjacency.REV_NEIGHBORS)

            self.assertEqual(fwd_offsets.tolist(), [0, 2, 2, 3, 4, 4])
            self.assertEqual(fwd_neighbors.tolist(), [1, 1, 3, 4])
            self.assertEqual(rev_offsets.tolist(), [0, 0, 2, 2, 3, 4])
            self.assertEqual(rev_neighbors.tolist(), [0, 0, 2, 3])

            self.assertEqual(neighbors_slice(fwd_offsets, fwd_neighbors, 0), [1, 1])
            self.assertEqual(neighbors_slice(fwd_offsets, fwd_neighbors, 1), [])
            self.assertEqual(neighbors_slice(fwd_offsets, fwd_neighbors, 2), [3])
            self.assertEqual(neighbors_slice(rev_offsets, rev_neighbors, 1), [0, 0])
            self.assertEqual(neighbors_slice(rev_offsets, rev_neighbors, 4), [3])

    def test_skip_when_outputs_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "data"

            build_adjacency.run(FIXTURE, ENTITIES_FIXTURE, out_dir, force=True)

            sizes_before = [
                (out_dir / name).stat().st_size
                for name in (
                    build_adjacency.FWD_OFFSETS,
                    build_adjacency.FWD_NEIGHBORS,
                    build_adjacency.REV_OFFSETS,
                    build_adjacency.REV_NEIGHBORS,
                )
            ]
            build_adjacency.run(FIXTURE, ENTITIES_FIXTURE, out_dir, force=False)

            sizes_after = [
                (out_dir / name).stat().st_size
                for name in (
                    build_adjacency.FWD_OFFSETS,
                    build_adjacency.FWD_NEIGHBORS,
                    build_adjacency.REV_OFFSETS,
                    build_adjacency.REV_NEIGHBORS,
                )
            ]
            self.assertEqual(sizes_before, sizes_after)

    def test_reruns_when_input_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            inp = tmp_path / "edges_int.tsv"
            out_dir = tmp_path / "data"
            inp.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")

            build_adjacency.run(inp, ENTITIES_FIXTURE, out_dir, force=True)
            built_at = read_stage_manifest(
                out_dir, build_adjacency.MANIFEST_NAME
            )["built_at"]

            os.utime(inp, None)
            build_adjacency.run(inp, ENTITIES_FIXTURE, out_dir, force=False)
            manifest = read_stage_manifest(out_dir, build_adjacency.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)

    def test_force_reruns_even_when_outputs_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_dir = tmp_path / "data"

            build_adjacency.run(FIXTURE, ENTITIES_FIXTURE, out_dir, force=True)
            built_at = read_stage_manifest(
                out_dir, build_adjacency.MANIFEST_NAME
            )["built_at"]

            build_adjacency.run(FIXTURE, ENTITIES_FIXTURE, out_dir, force=True)
            manifest = read_stage_manifest(out_dir, build_adjacency.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)


if __name__ == "__main__":
    unittest.main()
