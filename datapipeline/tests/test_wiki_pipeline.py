from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from datapipeline.lib.stage_cache import read_stage_manifest
from datapipeline.stages import build_title_index, extract_wiki_edges

PAGE_FIXTURE = Path(__file__).parent / "fixtures" / "page_sample.sql"
LINKTARGET_FIXTURE = Path(__file__).parent / "fixtures" / "linktarget_sample.sql"
PAGELINKS_FIXTURE = Path(__file__).parent / "fixtures" / "pagelinks_sample.sql"


class BuildTitleIndexTest(unittest.TestCase):
    def test_writes_ns0_non_redirect_entities(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            stats = build_title_index.build_title_index(
                PAGE_FIXTURE,
                data_dir / "entities.tsv",
                data_dir / "wiki_page_ids.tsv",
            )

            self.assertEqual(stats.pages_read, 5)
            self.assertEqual(stats.ns0_total, 4)
            self.assertEqual(stats.redirects_skipped, 1)
            self.assertEqual(stats.entities_written, 3)

            entities = (data_dir / "entities.tsv").read_text(encoding="utf-8").splitlines()
            page_ids = (data_dir / "wiki_page_ids.tsv").read_text(encoding="utf-8").splitlines()

            self.assertEqual(entities, ["Main_Page", "Article_A", "Article_B"])
            self.assertEqual(page_ids, ["1", "4", "5"])

    def test_run_writes_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            build_title_index.run(PAGE_FIXTURE, data_dir, force=True)

            self.assertTrue((data_dir / "entities.tsv").is_file())
            self.assertTrue((data_dir / "wiki_page_ids.tsv").is_file())
            self.assertIsNotNone(
                read_stage_manifest(data_dir, build_title_index.MANIFEST_NAME)
            )


class ExtractWikiEdgesTest(unittest.TestCase):
    def test_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            build_title_index.run(PAGE_FIXTURE, data_dir, force=True)

            out = data_dir / "edges_int.tsv"
            stats = extract_wiki_edges.extract_wiki_edges(
                LINKTARGET_FIXTURE,
                PAGELINKS_FIXTURE,
                data_dir / "entities.tsv",
                data_dir / "wiki_page_ids.tsv",
                out,
            )

            self.assertEqual(stats.links_read, 6)
            self.assertEqual(stats.ns0_links, 5)
            self.assertEqual(stats.unresolved_skipped, 3)
            self.assertEqual(stats.self_loops_skipped, 1)
            self.assertEqual(stats.edges_written, 1)

            rows = out.read_text(encoding="utf-8").splitlines()
            self.assertEqual(rows[0], "src_id\tdst_id")
            self.assertEqual(rows[1:], ["0\t1"])

    def test_run_writes_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            build_title_index.run(PAGE_FIXTURE, data_dir, force=True)

            out = data_dir / "edges_int.tsv"
            extract_wiki_edges.run(
                LINKTARGET_FIXTURE,
                PAGELINKS_FIXTURE,
                data_dir / "entities.tsv",
                data_dir / "wiki_page_ids.tsv",
                out,
                force=True,
            )

            self.assertTrue(out.is_file())
            self.assertIsNotNone(
                read_stage_manifest(data_dir, extract_wiki_edges.MANIFEST_NAME)
            )


if __name__ == "__main__":
    unittest.main()
