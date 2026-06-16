from __future__ import annotations

from pathlib import Path

from datapipeline.lib.page_sql import iter_article_titles


def scan_max_node_id(out_path: Path) -> int:
    """Return the largest 1-based node id in a KONECT out.* edge list."""
    out_path = out_path.resolve()
    max_id = 0
    with out_path.open(encoding="utf-8") as in_file:
        for line in in_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("%"):
                continue
            parts = stripped.split()
            if len(parts) < 2:
                continue
            try:
                src = int(parts[0])
                dst = int(parts[1])
            except ValueError:
                continue
            if src > max_id:
                max_id = src
            if dst > max_id:
                max_id = dst
    if max_id == 0:
        raise SystemExit(f"konect_ent: no integer edges found in {out_path.name}")
    return max_id


def build_ent_from_page_sql(
    page_sql: Path,
    out_ent: Path,
    *,
    max_page_id: int,
    missing_prefix: str = "Page_",
) -> int:
    """Write one article title per line for KONECT/Wikipedia page ids 1..max_page_id."""
    page_sql = page_sql.resolve()
    out_ent = out_ent.resolve()
    out_ent.parent.mkdir(parents=True, exist_ok=True)

    titles: dict[int, str] = {}
    for page_id, title in iter_article_titles(page_sql):
        if 1 <= page_id <= max_page_id:
            titles[page_id] = title

    tmp = out_ent.with_suffix(out_ent.suffix + ".tmp")
    written = 0
    with tmp.open("w", encoding="utf-8") as out_file:
        for page_id in range(1, max_page_id + 1):
            title = titles.get(page_id)
            if title is None:
                title = f"{missing_prefix}{page_id}"
            out_file.write(f"{title}\n")
            written += 1

            if page_id % 1_000_000 == 0:
                print(f"konect_ent: wrote {page_id:,} / {max_page_id:,} entity lines")

    tmp.replace(out_ent)
    return written
