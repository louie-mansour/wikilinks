from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from datapipeline.lib.manifest import read_manifest
from datapipeline.lib.stage_cache import read_stage_manifest
from datapipeline.stages import edges_to_int, fetch, map_entities

OUT_FIXTURE = Path(__file__).parent / "fixtures" / "konect_out_sample"
ENT_FIXTURE = Path(__file__).parent / "fixtures" / "konect_ent_sample"


class MapEntitiesTest(unittest.TestCase):
    def test_copies_entity_titles(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "entities.tsv"
            stats = map_entities.map_entities(ENT_FIXTURE, out)

            self.assertEqual(stats.lines_read, 5)
            self.assertEqual(stats.entities_written, 5)

            with out.open(encoding="utf-8") as f:
                titles = [line.rstrip("\n") for line in f]

            self.assertEqual(
                titles,
                ["Article_A", "Article_B", "Article_C", "Article_D", "Article_E"],
            )


class EdgesToIntTest(unittest.TestCase):
    def test_converts_deduplicates_and_filters(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            entities = tmp_path / "entities.tsv"
            out = tmp_path / "edges_int.tsv"
            map_entities.map_entities(ENT_FIXTURE, entities)

            stats = edges_to_int.edges_to_int(
                OUT_FIXTURE,
                out,
                entity_count=5,
            )

            self.assertEqual(stats.rows_read, 6)
            self.assertEqual(stats.edges_written, 4)
            self.assertEqual(stats.duplicates_skipped, 1)
            self.assertEqual(stats.self_loops_skipped, 1)
            self.assertEqual(stats.comment_skipped, 1)

            with out.open(newline="", encoding="utf-8") as f:
                rows = list(csv.reader(f, delimiter="\t"))

            self.assertEqual(rows[0], ["src_id", "dst_id"])
            self.assertEqual(
                rows[1:],
                [
                    ["0", "1"],
                    ["0", "2"],
                    ["1", "2"],
                    ["3", "4"],
                ],
            )

    def test_end_to_end_with_map_entities(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            entities = tmp_path / "entities.tsv"
            out = tmp_path / "edges_int.tsv"

            map_entities.run(ENT_FIXTURE, entities, force=True)
            edges_to_int.run(OUT_FIXTURE, entities, out, force=True)

            self.assertTrue(out.is_file())
            self.assertTrue(
                read_stage_manifest(tmp_path, edges_to_int.MANIFEST_NAME) is not None
            )


class FetchKonectTest(unittest.TestCase):
    def test_manifest_cache_requires_both_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            (raw / fetch.KONECT_OUT_FILE).write_text("1 2\n", encoding="utf-8")
            (raw / fetch.KONECT_ENT_FILE).write_text("A\nB\n", encoding="utf-8")

            from datapipeline.lib.manifest import build_manifest, write_manifest

            write_manifest(
                raw,
                build_manifest(
                    source="konect",
                    dataset=fetch.KONECT_DATASET,
                    files={
                        fetch.KONECT_OUT_FILE: (raw / fetch.KONECT_OUT_FILE).stat().st_size,
                        fetch.KONECT_ENT_FILE: (raw / fetch.KONECT_ENT_FILE).stat().st_size,
                    },
                ),
            )

            from datapipeline.lib.manifest import is_fetch_current

            self.assertTrue(
                is_fetch_current(
                    raw,
                    source="konect",
                    dataset=fetch.KONECT_DATASET,
                    required_files=fetch.KONECT_REQUIRED_FILES,
                )
            )

    @patch("datapipeline.stages.fetch._download_url")
    @patch("datapipeline.stages.fetch._extract_konect_tar")
    @patch("datapipeline.stages.fetch.build_ent_from_page_sql")
    @patch("datapipeline.stages.fetch.scan_max_node_id")
    def test_run_konect_installs_out_and_ent(
        self,
        mock_scan_max: object,
        mock_build_ent: object,
        mock_extract: object,
        mock_download: object,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)

            def fake_extract(archive: Path, dest: Path) -> None:
                out_path = dest / "wikipedia_link_en" / fetch.KONECT_OUT_FILE
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_text("% header\n1\t2\n", encoding="utf-8")

            mock_extract.side_effect = fake_extract

            mock_scan_max.return_value = 2

            def fake_build_ent(page_sql: Path, ent_path: Path, *, max_page_id: int) -> int:
                self.assertEqual(max_page_id, 2)
                ent_path.write_text("Article_A\nArticle_B\n", encoding="utf-8")
                return 2

            mock_build_ent.side_effect = fake_build_ent

            fetch._run_konect(raw, force=True)

            self.assertTrue((raw / fetch.KONECT_OUT_FILE).is_file())
            self.assertTrue((raw / fetch.KONECT_ENT_FILE).is_file())
            manifest = read_manifest(raw)
            self.assertIsNotNone(manifest)
            assert manifest is not None
            self.assertEqual(manifest["source"], "konect")
            self.assertIn(fetch.KONECT_OUT_FILE, manifest["files"])
            self.assertIn(fetch.KONECT_ENT_FILE, manifest["files"])


if __name__ == "__main__":
    unittest.main()
