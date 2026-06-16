"""Stream rows from MediaWiki page/linktarget/pagelinks .sql(.gz) dumps."""

from __future__ import annotations

import gzip
import re
from pathlib import Path

import numpy as np

# Matches one row in INSERT INTO `page` VALUES (...),(...);
# (page_id, page_namespace, page_title, page_is_redirect, ...)
_PAGE_ROW_RE = re.compile(
    r"\((\d+),(\d+),'((?:[^'\\]|\\.)*)',(\d+)",
)

# Matches one row in INSERT INTO `linktarget` VALUES (...),(...);
# (lt_id, lt_namespace, lt_title)
_LINKTARGET_ROW_RE = re.compile(
    r"\((\d+),(\d+),'((?:[^'\\]|\\.)*)'",
)

# Matches one row in INSERT INTO `pagelinks` VALUES (...),(...);
# (pl_from, pl_from_namespace, pl_target_id)
_PAGELINKS_ROW_RE = re.compile(r"\((\d+),(\d+),(\d+)\)")

PAGE_SQL_URL = "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-page.sql.gz"
LINKTARGET_SQL_URL = (
    "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-linktarget.sql.gz"
)
PAGELINKS_SQL_URL = (
    "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pagelinks.sql.gz"
)


def open_maybe_gz(path: Path):
    if path.suffix == ".gz" or path.name.endswith(".sql.gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def _unescape_sql_string(raw: str) -> str:
    return raw.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\").replace("_", " ")


def iter_pages(path: Path):
    """Yield (page_id, namespace, title, is_redirect) for every row in page.sql(.gz)."""
    with open_maybe_gz(path) as in_file:
        for line in in_file:
            if not line.startswith("INSERT INTO"):
                continue
            for page_id, namespace, raw_title, is_redirect in _PAGE_ROW_RE.findall(line):
                yield (
                    int(page_id),
                    int(namespace),
                    _unescape_sql_string(raw_title),
                    int(is_redirect),
                )


def iter_article_titles(path: Path):
    """Yield (page_id, page_title) for main-namespace (ns=0) rows, any redirect status."""
    for page_id, namespace, title, _is_redirect in iter_pages(path):
        if namespace != 0:
            continue
        yield page_id, title


def iter_sql_value_chunks(path: Path, pattern: re.Pattern, chunk_chars: int = 64 << 20):
    """Stream regex matches over INSERT VALUES tuples in a gzip SQL dump.

    Reads the decompressed text in chunk_chars-sized pieces and splits only at
    a `),(` tuple boundary, so a tuple never spans two chunks. Yields one list
    of match-tuples per chunk (so callers can batch-convert to numpy).
    """
    with open_maybe_gz(path) as in_file:
        carry = ""
        while True:
            data = in_file.read(chunk_chars)
            if not data:
                break
            text = carry + data
            split = text.rfind("),(")
            if split == -1:
                carry = text
                continue
            cut = split + 1
            yield pattern.findall(text[:cut])
            carry = text[cut:]
        if carry:
            yield pattern.findall(carry)


def iter_linktargets(path: Path):
    """Yield (lt_ids, lt_namespaces, lt_titles) per chunk from linktarget.sql(.gz).

    lt_ids/lt_namespaces are numpy arrays; lt_titles is a parallel list of
    unescaped title strings.
    """
    for matches in iter_sql_value_chunks(path, _LINKTARGET_ROW_RE):
        if not matches:
            continue
        lt_ids = np.array([m[0] for m in matches], dtype=np.uint32)
        lt_namespaces = np.array([m[1] for m in matches], dtype=np.int32)
        lt_titles = [_unescape_sql_string(m[2]) for m in matches]
        yield lt_ids, lt_namespaces, lt_titles


def iter_pagelinks(path: Path):
    """Yield (pl_from, pl_target_id, pl_from_namespace) per chunk from pagelinks.sql(.gz).

    All three are numpy arrays (pl_from/pl_target_id: uint32, pl_from_namespace: int32).
    """
    for matches in iter_sql_value_chunks(path, _PAGELINKS_ROW_RE):
        if not matches:
            continue
        arr = np.array(matches, dtype=np.uint64)
        pl_from = arr[:, 0].astype(np.uint32)
        pl_from_namespace = arr[:, 1].astype(np.int32)
        pl_target_id = arr[:, 2].astype(np.uint32)
        yield pl_from, pl_target_id, pl_from_namespace
