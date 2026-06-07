from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def input_fingerprint(path: Path) -> dict[str, Any]:
    stat = path.resolve().stat()
    return {
        "path": str(path.resolve()),
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
    }


def stage_manifest_path(out_dir: Path, manifest_name: str) -> Path:
    return out_dir / manifest_name


def read_stage_manifest(out_dir: Path, manifest_name: str) -> dict[str, Any] | None:
    path = stage_manifest_path(out_dir, manifest_name)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_stage_manifest(out_dir: Path, manifest_name: str, data: dict[str, Any]) -> None:
    path = stage_manifest_path(out_dir, manifest_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def is_output_current(
    output: Path,
    inputs: list[Path],
    out_dir: Path,
    manifest_name: str,
) -> bool:
    """Return True if output exists and manifest fingerprints match all inputs."""
    if not output.exists() or output.stat().st_size == 0:
        return False

    manifest = read_stage_manifest(out_dir, manifest_name)
    if manifest is None:
        return False

    recorded_output = manifest.get("output", {})
    if recorded_output.get("path") != str(output.resolve()):
        return False
    if recorded_output.get("size") != output.stat().st_size:
        return False

    recorded_inputs = manifest.get("inputs", [])
    if len(recorded_inputs) != len(inputs):
        return False

    for recorded, inp in zip(recorded_inputs, inputs):
        if not inp.exists():
            return False
        current = input_fingerprint(inp)
        if recorded != current:
            return False

    return True


def output_fingerprint(path: Path) -> dict[str, Any]:
    return {
        "path": str(path.resolve()),
        "size": path.stat().st_size if path.exists() else 0,
    }


def are_outputs_current(
    outputs: list[Path],
    inputs: list[Path],
    out_dir: Path,
    manifest_name: str,
) -> bool:
    """Return True if all outputs exist and manifest fingerprints match all inputs."""
    for output in outputs:
        if not output.exists() or output.stat().st_size == 0:
            return False

    manifest = read_stage_manifest(out_dir, manifest_name)
    if manifest is None:
        return False

    recorded_outputs = manifest.get("outputs", [])
    if len(recorded_outputs) != len(outputs):
        return False

    for recorded, output in zip(recorded_outputs, outputs):
        if recorded.get("path") != str(output.resolve()):
            return False
        if recorded.get("size") != output.stat().st_size:
            return False

    recorded_inputs = manifest.get("inputs", [])
    if len(recorded_inputs) != len(inputs):
        return False

    for recorded, inp in zip(recorded_inputs, inputs):
        if not inp.exists():
            return False
        current = input_fingerprint(inp)
        if recorded != current:
            return False

    return True


def build_stage_manifest(
    *,
    output: Path,
    inputs: list[Path],
    stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "inputs": [input_fingerprint(p) for p in inputs],
        "output": output_fingerprint(output),
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    if stats:
        data["stats"] = stats
    return data


def build_multi_output_manifest(
    *,
    outputs: list[Path],
    inputs: list[Path],
    stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "inputs": [input_fingerprint(p) for p in inputs],
        "outputs": [output_fingerprint(p) for p in outputs],
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    if stats:
        data["stats"] = stats
    return data
