"""Downloads Kaggle 100K Wikipedia link graph; output: raw/links_export.csv (+ optional raw/graph.json)."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import zipfile
from pathlib import Path

from datapipeline.lib.atomic import install_file
from datapipeline.lib.manifest import build_manifest, is_fetch_current, write_manifest
from datapipeline.lib.paths import default_raw_dir

KAGGLE_DATASET = "kutayahin/wikipedia-link-graph-100k"
KAGGLE_ACCESS_TOKEN_FILE = "access_token"
KAGGLE_DOWNLOAD_URL = "https://www.kaggle.com/api/v1/datasets/download/{dataset}"
REQUIRED_FILE = "links_export.csv"
OPTIONAL_FILES = ("graph.json",)


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
    try:
        import requests
    except ImportError as exc:
        raise SystemExit(
            "requests package not installed. Run: pip install -r datapipeline/requirements.txt"
        ) from exc

    url = KAGGLE_DOWNLOAD_URL.format(dataset=dataset)
    archive_path = dest_dir / f"{dataset.rsplit('/', 1)[-1]}.zip"
    headers = {"Authorization": f"Bearer {access_token}"}

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


def _extract_archive(archive: Path, dest_dir: Path) -> None:
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(dest_dir)
        return
    raise SystemExit(f"Expected a zip archive from Kaggle, got: {archive.name}")


def run(
    out_dir: Path,
    *,
    source: str = "kaggle",
    force: bool = False,
) -> None:
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if source != "kaggle":
        raise SystemExit(f"Source {source!r} is not implemented yet. Use --source kaggle.")

    if not force and is_fetch_current(
        out_dir,
        source=source,
        dataset=KAGGLE_DATASET,
        required_file=REQUIRED_FILE,
    ):
        size = (out_dir / REQUIRED_FILE).stat().st_size
        print(f"fetch: skip {out_dir / REQUIRED_FILE} (up to date, {size:,} bytes)")
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
        _extract_archive(archives[0], extract_dir)

        csv_src = _find_file(extract_dir, REQUIRED_FILE)
        if csv_src is None:
            found = [p.name for p in extract_dir.rglob("*") if p.is_file()]
            raise SystemExit(
                f"{REQUIRED_FILE} not found in archive. Files: {found or '(empty)'}"
            )

        installed: dict[str, int] = {}
        install_file(csv_src, out_dir / REQUIRED_FILE)
        installed[REQUIRED_FILE] = (out_dir / REQUIRED_FILE).stat().st_size
        print(f"fetch: installed {REQUIRED_FILE} ({installed[REQUIRED_FILE]:,} bytes)")

        for optional in OPTIONAL_FILES:
            src = _find_file(extract_dir, optional)
            if src is None:
                continue
            install_file(src, out_dir / optional)
            installed[optional] = (out_dir / optional).stat().st_size
            print(f"fetch: installed {optional} ({installed[optional]:,} bytes)")

        write_manifest(
            out_dir,
            build_manifest(
                source=source,
                dataset=KAGGLE_DATASET,
                files=installed,
            ),
        )
        print(f"fetch: done -> {out_dir}")
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


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
        choices=("kaggle", "konect"),
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
