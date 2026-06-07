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
    required_file: str,
) -> bool:
    """Return True if required output exists and manifest matches source/dataset/size."""
    output = out_dir / required_file
    if not output.exists() or output.stat().st_size == 0:
        return False

    manifest = read_manifest(out_dir)
    if manifest is None:
        return False

    if manifest.get("source") != source or manifest.get("dataset") != dataset:
        return False

    recorded_size = manifest.get("files", {}).get(required_file)
    return recorded_size == output.stat().st_size


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
