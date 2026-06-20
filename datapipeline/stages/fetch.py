"""Downloads Wikipedia link graph raw data (Kaggle, KONECT, or Wikipedia SQL dumps)."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tarfile
import time
import zipfile
from pathlib import Path

from datapipeline.lib.atomic import install_file
from datapipeline.lib.konect_ent import build_ent_from_page_sql, scan_max_node_id
from datapipeline.lib.page_sql import (
    LINKTARGET_SQL_URL,
    PAGE_SQL_URL,
    PAGELINKS_SQL_URL,
    REDIRECT_SQL_URL,
)
from datapipeline.lib.manifest import build_manifest, is_fetch_current, write_manifest
from datapipeline.lib.paths import default_raw_dir

KAGGLE_DATASET = "kutayahin/wikipedia-link-graph-100k"
KAGGLE_ACCESS_TOKEN_FILE = "access_token"
KAGGLE_DOWNLOAD_URL = "https://www.kaggle.com/api/v1/datasets/download/{dataset}"
KAGGLE_REQUIRED_FILES = ("links_export.csv",)
KAGGLE_OPTIONAL_FILES = ("graph.json",)

KONECT_NETWORK = "wikipedia_link_en"
KONECT_DATASET = KONECT_NETWORK
KONECT_TAR_URL = f"http://konect.cc/files/download.tsv.{KONECT_NETWORK}.tar.bz2"
KONECT_OUT_FILE = f"out.{KONECT_NETWORK}"
KONECT_ENT_FILE = f"ent.{KONECT_NETWORK}"
KONECT_REQUIRED_FILES = (KONECT_OUT_FILE, KONECT_ENT_FILE)

WIKI_DATASET = "enwiki"
WIKI_PAGE_FILE = "enwiki-latest-page.sql.gz"
WIKI_LINKTARGET_FILE = "enwiki-latest-linktarget.sql.gz"
WIKI_PAGELINKS_FILE = "enwiki-latest-pagelinks.sql.gz"
WIKI_REDIRECT_FILE = "enwiki-latest-redirect.sql.gz"
WIKI_REQUIRED_FILES = (WIKI_PAGE_FILE, WIKI_LINKTARGET_FILE, WIKI_PAGELINKS_FILE, WIKI_REDIRECT_FILE)


def _find_file(root: Path, name: str) -> Path | None:
    direct = root / name
    if direct.is_file():
        return direct
    matches = list(root.rglob(name))
    if not matches:
        return None
    if len(matches) > 1:
        matches.sort(key=lambda p: len(p.parts))
    return matches[0]


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
        headers = {"Range": f"bytes={resume_from}-"} if resume_from else {}
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


def _kaggle_credentials_message() -> str:
    return (
        "Kaggle credentials not found. Configure ~/.kaggle/access_token "
        "(or set KAGGLE_API_TOKEN), or use legacy ~/.kaggle/kaggle.json "
        "(or set KAGGLE_USERNAME and KAGGLE_KEY)."
    )


def _get_access_token() -> str | None:
    token = os.environ.get("KAGGLE_API_TOKEN", "").strip()
    if token:
        return token
    token_file = Path.home() / ".kaggle" / KAGGLE_ACCESS_TOKEN_FILE
    if token_file.is_file():
        return token_file.read_text(encoding="utf-8").strip()
    return None


def _has_legacy_kaggle_credentials() -> bool:
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.is_file():
        return True
    return bool(os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY"))


def _ensure_kaggle_credentials() -> None:
    if _get_access_token() or _has_legacy_kaggle_credentials():
        return
    raise SystemExit(_kaggle_credentials_message())


def _download_kaggle_http(dataset: str, dest_dir: Path, *, access_token: str) -> None:
    url = KAGGLE_DOWNLOAD_URL.format(dataset=dataset)
    archive_path = dest_dir / f"{dataset.rsplit('/', 1)[-1]}.zip"
    headers = {"Authorization": f"Bearer {access_token}"}

    requests = _ensure_requests()
    with requests.get(url, headers=headers, stream=True, timeout=(30, 300)) as response:
        if response.status_code in (401, 403):
            raise SystemExit(
                f"Kaggle authentication failed ({response.status_code}). "
                "Regenerate your token at https://www.kaggle.com/settings/api and "
                "accept the dataset license while logged in."
            )
        response.raise_for_status()

        total = int(response.headers.get("Content-Length", 0)) or None
        downloaded = 0
        chunk_size = 1024 * 1024
        with archive_path.open("wb") as out_file:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if not chunk:
                    continue
                out_file.write(chunk)
                downloaded += len(chunk)
                if total and downloaded % (50 * chunk_size) < chunk_size:
                    print(f"fetch: {downloaded:,} / {total:,} bytes")


def _download_kaggle_legacy(dataset: str, dest_dir: Path) -> None:
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except ImportError as exc:
        raise SystemExit(
            "kaggle package not installed. Run: pip install -r datapipeline/requirements.txt"
        ) from exc

    api = KaggleApi()
    api.authenticate()

    try:
        api.dataset_download_files(dataset, path=str(dest_dir), unzip=False, quiet=False)
    except Exception as exc:
        message = str(exc).lower()
        if "kaggle.json" in message or "credentials" in message:
            raise SystemExit(_kaggle_credentials_message()) from exc
        raise


def _download_kaggle(dataset: str, dest_dir: Path) -> None:
    access_token = _get_access_token()
    if access_token:
        _download_kaggle_http(dataset, dest_dir, access_token=access_token)
        return
    _download_kaggle_legacy(dataset, dest_dir)


def _extract_zip(archive: Path, dest_dir: Path) -> None:
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(dest_dir)
        return
    raise SystemExit(f"Expected a zip archive from Kaggle, got: {archive.name}")


def _extract_konect_tar(archive: Path, dest_dir: Path) -> None:
    with tarfile.open(archive, "r:bz2") as tf:
        tf.extractall(dest_dir)


def _run_kaggle(out_dir: Path, *, force: bool) -> None:
    if not force and is_fetch_current(
        out_dir,
        source="kaggle",
        dataset=KAGGLE_DATASET,
        required_files=KAGGLE_REQUIRED_FILES,
    ):
        size = (out_dir / KAGGLE_REQUIRED_FILES[0]).stat().st_size
        path = out_dir / KAGGLE_REQUIRED_FILES[0]
        print(f"fetch: skip {path} (up to date, {size:,} bytes)")
        return

    tmp_root = out_dir / f".fetch-tmp-{os.getpid()}"
    tmp_root.mkdir(parents=True, exist_ok=True)

    try:
        _ensure_kaggle_credentials()
        print(f"fetch: downloading {KAGGLE_DATASET} -> {out_dir}")
        _download_kaggle(KAGGLE_DATASET, tmp_root)

        archives = list(tmp_root.glob("*.zip"))
        if not archives:
            raise SystemExit(f"No zip archive found after download in {tmp_root}")

        extract_dir = tmp_root / "extracted"
        extract_dir.mkdir()
        _extract_zip(archives[0], extract_dir)

        csv_src = _find_file(extract_dir, KAGGLE_REQUIRED_FILES[0])
        if csv_src is None:
            found = [p.name for p in extract_dir.rglob("*") if p.is_file()]
            raise SystemExit(
                f"{KAGGLE_REQUIRED_FILES[0]} not found in archive. "
                f"Files: {found or '(empty)'}"
            )

        installed: dict[str, int] = {}
        install_file(csv_src, out_dir / KAGGLE_REQUIRED_FILES[0])
        installed[KAGGLE_REQUIRED_FILES[0]] = (
            out_dir / KAGGLE_REQUIRED_FILES[0]
        ).stat().st_size
        print(
            f"fetch: installed {KAGGLE_REQUIRED_FILES[0]} "
            f"({installed[KAGGLE_REQUIRED_FILES[0]]:,} bytes)"
        )

        for optional in KAGGLE_OPTIONAL_FILES:
            src = _find_file(extract_dir, optional)
            if src is None:
                continue
            install_file(src, out_dir / optional)
            installed[optional] = (out_dir / optional).stat().st_size
            print(f"fetch: installed {optional} ({installed[optional]:,} bytes)")

        write_manifest(
            out_dir,
            build_manifest(
                source="kaggle",
                dataset=KAGGLE_DATASET,
                files=installed,
            ),
        )
        print(f"fetch: done -> {out_dir}")
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


def _run_konect(out_dir: Path, *, force: bool) -> None:
    if not force and is_fetch_current(
        out_dir,
        source="konect",
        dataset=KONECT_DATASET,
        required_files=KONECT_REQUIRED_FILES,
    ):
        out_path = out_dir / KONECT_OUT_FILE
        ent_path = out_dir / KONECT_ENT_FILE
        print(
            f"fetch: skip {out_path} and {ent_path} (up to date, "
            f"{out_path.stat().st_size:,} + {ent_path.stat().st_size:,} bytes)"
        )
        return

    tmp_root = out_dir / f".fetch-tmp-{os.getpid()}"
    tmp_root.mkdir(parents=True, exist_ok=True)

    try:
        print(f"fetch: downloading KONECT {KONECT_NETWORK} -> {out_dir}")
        tar_path = tmp_root / f"{KONECT_NETWORK}.tar.bz2"
        _download_url(KONECT_TAR_URL, tar_path, label="fetch: konect tar")

        extract_dir = tmp_root / "extracted"
        extract_dir.mkdir()
        _extract_konect_tar(tar_path, extract_dir)

        out_src = _find_file(extract_dir, KONECT_OUT_FILE)
        if out_src is None:
            found = [p.name for p in extract_dir.rglob("*") if p.is_file()]
            raise SystemExit(
                f"{KONECT_OUT_FILE} not found in archive. Files: {found or '(empty)'}"
            )

        print(f"fetch: scanning {KONECT_OUT_FILE} for max node id")
        max_page_id = scan_max_node_id(out_src)
        print(f"fetch: max node id {max_page_id:,}")

        print(f"fetch: downloading Wikimedia page titles -> {out_dir}")
        page_sql_path = tmp_root / "enwiki-latest-page.sql.gz"
        _download_url(PAGE_SQL_URL, page_sql_path, label="fetch: page.sql.gz")

        ent_tmp = tmp_root / KONECT_ENT_FILE
        node_count = build_ent_from_page_sql(
            page_sql_path,
            ent_tmp,
            max_page_id=max_page_id,
        )
        print(f"fetch: extracted {node_count:,} entity titles from page.sql.gz")

        installed: dict[str, int] = {}
        install_file(out_src, out_dir / KONECT_OUT_FILE)
        installed[KONECT_OUT_FILE] = (out_dir / KONECT_OUT_FILE).stat().st_size
        print(f"fetch: installed {KONECT_OUT_FILE} ({installed[KONECT_OUT_FILE]:,} bytes)")

        install_file(ent_tmp, out_dir / KONECT_ENT_FILE)
        installed[KONECT_ENT_FILE] = (out_dir / KONECT_ENT_FILE).stat().st_size
        print(f"fetch: installed {KONECT_ENT_FILE} ({installed[KONECT_ENT_FILE]:,} bytes)")

        write_manifest(
            out_dir,
            build_manifest(
                source="konect",
                dataset=KONECT_DATASET,
                files=installed,
            ),
        )
        print(f"fetch: done -> {out_dir}")
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


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


def run(
    out_dir: Path,
    *,
    source: str = "kaggle",
    force: bool = False,
) -> None:
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if source == "kaggle":
        _run_kaggle(out_dir, force=force)
        return
    if source == "konect":
        _run_konect(out_dir, force=force)
        return
    if source == "wikipedia":
        _run_wikipedia(out_dir, force=force)
        return
    raise SystemExit(
        f"Unknown source {source!r}. Use --source kaggle, konect, or wikipedia."
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Download Wikipedia link graph raw data.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=default_raw_dir(),
        help="Output directory for raw files (default: datapipeline/raw/)",
    )
    parser.add_argument(
        "--source",
        choices=("kaggle", "konect", "wikipedia"),
        default="kaggle",
        help="Data source (default: kaggle)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if cached output is valid",
    )
    args = parser.parse_args(argv)

    try:
        run(args.out_dir, source=args.source, force=args.force)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"fetch: error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
