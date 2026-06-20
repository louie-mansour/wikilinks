from __future__ import annotations

import unittest
from pathlib import Path

from datapipeline.lib.page_sql import iter_linktargets, iter_pagelinks, iter_pages, iter_redirects

PAGE_FIXTURE = Path(__file__).parent / "fixtures" / "page_sample.sql"
LINKTARGET_FIXTURE = Path(__file__).parent / "fixtures" / "linktarget_sample.sql"
PAGELINKS_FIXTURE = Path(__file__).parent / "fixtures" / "pagelinks_sample.sql"
REDIRECT_FIXTURE = Path(__file__).parent / "fixtures" / "redirect_sample.sql"


class IterPagesTest(unittest.TestCase):
    def test_yields_all_namespaces_with_redirect_flag(self) -> None:
        rows = list(iter_pages(PAGE_FIXTURE))
        # _unescape_sql_string converts underscores to spaces in Wikipedia titles.
        self.assertEqual(
            rows,
            [
                (1, 0, "Main Page", 0),
                (2, 0, "Missing A", 1),
                (3, 1, "Talk:Foo", 0),
                (4, 0, "Article A", 0),
                (5, 0, "Article B", 0),
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
        self.assertEqual(titles, ["Article A", "Talk:Foo", "Missing A", "Main Page"])


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


class IterRedirectsTest(unittest.TestCase):
    def test_yields_from_namespace_title(self) -> None:
        froms: list[int] = []
        namespaces: list[int] = []
        titles: list[str] = []
        for rd_from, rd_namespaces, rd_titles in iter_redirects(REDIRECT_FIXTURE):
            froms.extend(int(x) for x in rd_from)
            namespaces.extend(int(x) for x in rd_namespaces)
            titles.extend(rd_titles)

        self.assertEqual(froms, [2])
        self.assertEqual(namespaces, [0])
        # _unescape_sql_string converts underscores to spaces
        # rd_title "Article_A" is unescaped to "Article A"
        self.assertEqual(titles, ["Article A"])


if __name__ == "__main__":
    unittest.main()
