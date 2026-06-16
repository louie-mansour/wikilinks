from __future__ import annotations

import unittest
from pathlib import Path

from datapipeline.lib.page_sql import iter_linktargets, iter_pagelinks, iter_pages

PAGE_FIXTURE = Path(__file__).parent / "fixtures" / "page_sample.sql"
LINKTARGET_FIXTURE = Path(__file__).parent / "fixtures" / "linktarget_sample.sql"
PAGELINKS_FIXTURE = Path(__file__).parent / "fixtures" / "pagelinks_sample.sql"


class IterPagesTest(unittest.TestCase):
    def test_yields_all_namespaces_with_redirect_flag(self) -> None:
        rows = list(iter_pages(PAGE_FIXTURE))
        self.assertEqual(
            rows,
            [
                (1, 0, "Main_Page", 0),
                (2, 0, "Missing_A", 1),
                (3, 1, "Talk:Foo", 0),
                (4, 0, "Article_A", 0),
                (5, 0, "Article_B", 0),
            ],
        )


class IterLinktargetsTest(unittest.TestCase):
    def test_yields_id_namespace_title_rows(self) -> None:
        ids: list[int] = []
        namespaces: list[int] = []
        titles: list[str] = []
        for lt_ids, lt_namespaces, lt_titles in iter_linktargets(LINKTARGET_FIXTURE):
            ids.extend(int(x) for x in lt_ids)
            namespaces.extend(int(x) for x in lt_namespaces)
            titles.extend(lt_titles)

        self.assertEqual(ids, [10, 11, 12, 13])
        self.assertEqual(namespaces, [0, 1, 0, 0])
        self.assertEqual(titles, ["Article_A", "Talk:Foo", "Missing_A", "Main_Page"])


class IterPagelinksTest(unittest.TestCase):
    def test_yields_from_target_namespace_rows(self) -> None:
        froms: list[int] = []
        targets: list[int] = []
        namespaces: list[int] = []
        for pl_from, pl_target_id, pl_from_namespace in iter_pagelinks(PAGELINKS_FIXTURE):
            froms.extend(int(x) for x in pl_from)
            targets.extend(int(x) for x in pl_target_id)
            namespaces.extend(int(x) for x in pl_from_namespace)

        self.assertEqual(froms, [1, 4, 5, 4, 3, 1])
        self.assertEqual(targets, [10, 11, 12, 14, 10, 13])
        self.assertEqual(namespaces, [0, 0, 0, 0, 1, 0])


if __name__ == "__main__":
    unittest.main()
