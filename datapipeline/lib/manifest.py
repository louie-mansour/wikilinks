from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MANIFEST_NAME = ".fetch-manifest.json"


def manifest_path(out_dir: Path) -> Path:
    return out_dir / MANIFEST_NAME


def read_manifest(out_dir: Path) -> dict[str, Any] | None:
    path = manifest_path(out_dir)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_manifest(out_dir: Path, data: dict[str, Any]) -> None:
    path = manifest_path(out_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def is_fetch_current(
    out_dir: Path,
    *,
    source: str,
    dataset: str,
    required_files: tuple[str, ...],
) -> bool:
    """Return True if all required outputs exist and manifest matches source/dataset/sizes."""
    manifest = read_manifest(out_dir)
    if manifest is None:
        return False

    if manifest.get("source") != source or manifest.get("dataset") != dataset:
        return False

    recorded = manifest.get("files", {})
    for name in required_files:
        output = out_dir / name
        if not output.is_file() or output.stat().st_size == 0:
            return False
        if recorded.get(name) != output.stat().st_size:
            return False
    return True


def build_manifest(
    *,
    source: str,
    dataset: str,
    files: dict[str, int],
) -> dict[str, Any]:
    return {
        "source": source,
        "dataset": dataset,
        "files": files,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
