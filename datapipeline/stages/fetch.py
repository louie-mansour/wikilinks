"""Downloads Wikipedia link graph raw data (Wikipedia SQL dumps)."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from pathlib import Path

from datapipeline.lib.atomic import install_file
from datapipeline.lib.page_sql import (
    LINKTARGET_SQL_URL,
    PAGE_SQL_URL,
    PAGELINKS_SQL_URL,
    REDIRECT_SQL_URL,
)
from datapipeline.lib.manifest import build_manifest, is_fetch_current, write_manifest
from datapipeline.lib.paths import default_raw_dir

WIKI_DATASET = "enwiki"
WIKI_PAGE_FILE = "enwiki-latest-page.sql.gz"
WIKI_LINKTARGET_FILE = "enwiki-latest-linktarget.sql.gz"
WIKI_PAGELINKS_FILE = "enwiki-latest-pagelinks.sql.gz"
WIKI_REDIRECT_FILE = "enwiki-latest-redirect.sql.gz"
WIKI_REQUIRED_FILES = (WIKI_PAGE_FILE, WIKI_LINKTARGET_FILE, WIKI_PAGELINKS_FILE, WIKI_REDIRECT_FILE)


def _ensure_requests():
    try:
        import requests
    except ImportError as exc:
        raise SystemExit(
            "requests package not installed. Run: pip install -r datapipeline/requirements.txt"
        ) from exc
    return requests


def _content_total(response, resume_from: int) -> int | None:
    content_range = response.headers.get("Content-Range", "")
    if "/" in content_range:
        total_str = content_range.rsplit("/", 1)[-1]
        if total_str.isdigit():
            return int(total_str)
    content_length = response.headers.get("Content-Length")
    if content_length:
        return resume_from + int(content_length)
    return None


def _download_url(
    url: str, dest: Path, *, label: str = "fetch", max_retries: int = 8
) -> None:
    """Download url to dest, resuming via HTTP Range on transient connection drops.

    dumps.wikimedia.org resets connections mid-stream on multi-GB files; without
    resume, a single drop near the end of a 7GB download means starting over.
    """
    requests = _ensure_requests()
    dest.parent.mkdir(parents=True, exist_ok=True)
    chunk_size = 1024 * 1024

    for attempt in range(1, max_retries + 1):
        resume_from = dest.stat().st_size if dest.exists() else 0
        headers = {"User-Agent": "wikilinks-datapipeline/1.0 (fetch stage)"}
        if resume_from:
            headers["Range"] = f"bytes={resume_from}-"
        try:
            with requests.get(url, headers=headers, stream=True, timeout=(30, 300)) as response:
                if resume_from and response.status_code == 200:
                    # server ignored Range and is sending the full file again
                    resume_from = 0
                response.raise_for_status()
                total = _content_total(response, resume_from)
                downloaded = resume_from
                mode = "ab" if resume_from else "wb"
                with dest.open(mode) as out_file:
                    for chunk in response.iter_content(chunk_size=chunk_size):
                        if not chunk:
                            continue
                        out_file.write(chunk)
                        downloaded += len(chunk)
                        if total and downloaded % (50 * chunk_size) < chunk_size:
                            print(f"{label}: {downloaded:,} / {total:,} bytes")
            return
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as exc:
            if attempt == max_retries:
                raise
            wait = min(2**attempt, 60)
            print(
                f"{label}: connection dropped ({exc!r}); "
                f"retrying in {wait}s (attempt {attempt}/{max_retries})"
            )
            time.sleep(wait)


def _run_wikipedia(out_dir: Path, *, force: bool) -> None:
    if not force and is_fetch_current(
        out_dir,
        source="wikipedia",
        dataset=WIKI_DATASET,
        required_files=WIKI_REQUIRED_FILES,
    ):
        sizes = ", ".join(
            f"{name} ({(out_dir / name).stat().st_size:,} bytes)"
            for name in WIKI_REQUIRED_FILES
        )
        print(f"fetch: skip {out_dir} (up to date, {sizes})")
        return

    tmp_root = out_dir / f".fetch-tmp-{os.getpid()}"
    tmp_root.mkdir(parents=True, exist_ok=True)

    try:
        installed: dict[str, int] = {}
        for name, url in (
            (WIKI_PAGE_FILE, PAGE_SQL_URL),
            (WIKI_LINKTARGET_FILE, LINKTARGET_SQL_URL),
            (WIKI_PAGELINKS_FILE, PAGELINKS_SQL_URL),
            (WIKI_REDIRECT_FILE, REDIRECT_SQL_URL),
        ):
            dest = out_dir / name
            if dest.is_file():
                # Multi-GB files already on disk: don't discard and re-download
                # just because an earlier/later file in this run needs a retry.
                installed[name] = dest.stat().st_size
                print(f"fetch: skip {name} (already downloaded, {installed[name]:,} bytes)")
                continue
            print(f"fetch: downloading {name} -> {out_dir}")
            tmp_path = tmp_root / name
            _download_url(url, tmp_path, label=f"fetch: {name}")
            install_file(tmp_path, dest)
            installed[name] = dest.stat().st_size
            print(f"fetch: installed {name} ({installed[name]:,} bytes)")

        write_manifest(
            out_dir,
            build_manifest(source="wikipedia", dataset=WIKI_DATASET, files=installed),
        )
        print(f"fetch: done -> {out_dir}")
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


def run(out_dir: Path, *, force: bool = False) -> None:
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    _run_wikipedia(out_dir, force=force)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Download Wikipedia link graph raw data.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=default_raw_dir(),
        help="Output directory for raw files (default: datapipeline/raw/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.out_dir, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"fetch: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
