from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from datapipeline.lib.konect_ent import (
    build_ent_from_page_sql,
    scan_max_node_id,
)
from datapipeline.lib.page_sql import iter_article_titles

OUT_FIXTURE = Path(__file__).parent / "fixtures" / "konect_out_sample"
PAGE_FIXTURE = Path(__file__).parent / "fixtures" / "page_sample.sql"


class PageSqlTest(unittest.TestCase):
    def test_iter_article_titles_filters_namespace(self) -> None:
        titles = dict(iter_article_titles(PAGE_FIXTURE))
        self.assertEqual(
            titles,
            {
                1: "Main_Page",
                2: "Missing_A",
                4: "Article_A",
                5: "Article_B",
            },
        )


class KonectEntTest(unittest.TestCase):
    def test_scan_max_node_id(self) -> None:
        self.assertEqual(scan_max_node_id(OUT_FIXTURE), 5)

    def test_build_ent_from_page_sql_writes_titles_by_page_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "ent.wikipedia_link_en"
            count = build_ent_from_page_sql(
                PAGE_FIXTURE,
                out,
                max_page_id=5,
            )
            self.assertEqual(count, 5)
            self.assertEqual(
                out.read_text(encoding="utf-8"),
                "Main_Page\n"
                "Missing_A\n"
                "Page_3\n"
                "Article_A\n"
                "Article_B\n",
            )


if __name__ == "__main__":
    unittest.main()
