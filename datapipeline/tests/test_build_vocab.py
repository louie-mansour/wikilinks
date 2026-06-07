from __future__ import annotations

import csv
import os
import tempfile
import unittest
from pathlib import Path

from datapipeline.lib.stage_cache import read_stage_manifest
from datapipeline.stages import build_vocab

FIXTURE = Path(__file__).parent / "fixtures" / "edges_sample.tsv"


class BuildVocabTest(unittest.TestCase):
    def test_build_vocab_writes_entities_and_int_edges(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            entities = tmp_path / "entities.tsv"
            edges_int = tmp_path / "edges_int.tsv"

            stats = build_vocab.build_vocab(FIXTURE, entities, edges_int)

            self.assertEqual(stats.edges_read, 4)
            self.assertEqual(stats.entities_count, 5)
            self.assertEqual(stats.edges_written, 4)

            self.assertEqual(
                entities.read_text(encoding="utf-8").splitlines(),
                [
                    "Article_A",
                    "Article_B",
                    "Article_C",
                    "Article_D",
                    "Article_E",
                ],
            )

            with edges_int.open(newline="", encoding="utf-8") as f:
                rows = list(csv.reader(f, delimiter="\t"))

            self.assertEqual(rows[0], ["src_id", "dst_id"])
            self.assertEqual(
                rows[1:],
                [
                    ["0", "1"],
                    ["0", "1"],
                    ["2", "3"],
                    ["3", "4"],
                ],
            )

    def test_skip_when_outputs_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            entities = tmp_path / "entities.tsv"
            edges_int = tmp_path / "edges_int.tsv"

            build_vocab.run(FIXTURE, entities, edges_int, force=True)

            entities_size_before = entities.stat().st_size
            edges_size_before = edges_int.stat().st_size
            build_vocab.run(FIXTURE, entities, edges_int, force=False)

            self.assertEqual(entities.stat().st_size, entities_size_before)
            self.assertEqual(edges_int.stat().st_size, edges_size_before)

    def test_reruns_when_input_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            inp = tmp_path / "edges.tsv"
            entities = tmp_path / "entities.tsv"
            edges_int = tmp_path / "edges_int.tsv"
            inp.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")

            build_vocab.run(inp, entities, edges_int, force=True)
            built_at = read_stage_manifest(
                tmp_path, build_vocab.MANIFEST_NAME
            )["built_at"]

            os.utime(inp, None)
            build_vocab.run(inp, entities, edges_int, force=False)
            manifest = read_stage_manifest(tmp_path, build_vocab.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)

    def test_force_reruns_even_when_outputs_current(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            entities = tmp_path / "entities.tsv"
            edges_int = tmp_path / "edges_int.tsv"

            build_vocab.run(FIXTURE, entities, edges_int, force=True)
            built_at = read_stage_manifest(
                tmp_path, build_vocab.MANIFEST_NAME
            )["built_at"]

            build_vocab.run(FIXTURE, entities, edges_int, force=True)
            manifest = read_stage_manifest(tmp_path, build_vocab.MANIFEST_NAME)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertNotEqual(manifest["built_at"], built_at)


if __name__ == "__main__":
    unittest.main()
