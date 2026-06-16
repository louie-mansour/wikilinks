from __future__ import annotations

import csv
import os
import tempfile
import unittest
from pathlib import Path

from datapipeline.lib.stage_cache import read_stage_manifest
from datapipeline.stages import extract_edges

FIXTURE = Path(__file__).parent / "fixtures" / "links_export_sample.csv"


class ExtractEdgesTest(unittest.TestCase):
    def test_extract_dedupes_filters_and_writes_tsv(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "edges.tsv"
            stats = extract_edges.extract_edges(FIXTURE, out, set())

            self.assertEqual(stats.rows_read, 6)
            self.assertEqual(stats.edges_written, 3)
            self.assertEqual(stats.duplicates_skipped, 1)
            self.assertEqual(stats.self_loops_skipped, 1)
            self.assertEqual(stats.empty_skipped, 1)
            self.assertEqual(stats.depth_filtered, 0)

            with out.open(newline="", encoding="utf-8") as f:
                rows = list(csv.reader(f, delimiter="\t"))

            self.assertEqual(rows[0], ["source_title", "target_title"])
            self.assertEqual(
                rows[1:],
                [
                    ["Article_A", "Article_B"],
                    ["Article_D", "Article_E"],
                    ["Article_A", "Article_F"],
                ],
            )

    def test_max_depth_filters_navbox_links(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "edges.tsv"
            stats = extract_edges.extract_edges(FIXTURE, out, set(), max_depth=2)

            self.assertEqual(stats.rows_read, 6)
            self.assertEqual(stats.edges_written, 2)
            self.assertEqual(stats.depth_filtered, 1)

            with out.open(newline="", encoding="utf-8") as f:
                rows = list(csv.reader(f, delimiter="\t"))

            self.assertEqual(rows[0], ["source_title", "target_title"])
            self.assertEqual(
                rows[1:],
                [
                    ["Article_A", "Article_B"],
                    ["Article_D", "Article_E"],
                ],
            )

    def test_skip_when_output_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out = tmp_path / "edges.tsv"
            extract_edges.run(FIXTURE, out, force=True)

            size_before = out.stat().st_size
            extract_edges.run(FIXTURE, out, force=False)
            self.assertEqual(out.stat().st_size, size_before)

    def test_reruns_when_input_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            inp = tmp_path / "links_export.csv"
            out = tmp_path / "edges.tsv"
            inp.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")

            extract_edges.run(inp, out, force=True)
            built_at = read_stage_manifest(
                tmp_path, extract_edges.MANIFEST_NAME
            )["built_at"]

            os.utime(inp, None)
            extract_edges.run(inp, out, force=False)
            manifest = read_stage_manifest(tmp_path, extract_edges.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)

    def test_force_reruns_even_when_output_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out = tmp_path / "edges.tsv"
            extract_edges.run(FIXTURE, out, force=True)
            built_at = read_stage_manifest(
                tmp_path, extract_edges.MANIFEST_NAME
            )["built_at"]

            extract_edges.run(FIXTURE, out, force=True)
            manifest = read_stage_manifest(tmp_path, extract_edges.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)


if __name__ == "__main__":
    unittest.main()
