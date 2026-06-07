from __future__ import annotations

from pathlib import Path

_PACKAGE_ROOT = Path(__file__).resolve().parent.parent


def package_root() -> Path:
    return _PACKAGE_ROOT


def default_raw_dir() -> Path:
    return _PACKAGE_ROOT / "raw"


def default_data_dir() -> Path:
    return _PACKAGE_ROOT / "data"
