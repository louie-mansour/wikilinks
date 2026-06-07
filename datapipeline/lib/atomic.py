from __future__ import annotations

import shutil
from pathlib import Path


def install_file(src: Path, dest: Path) -> None:
    """Copy src into dest atomically via a sibling .tmp file."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    shutil.copy2(src, tmp)
    tmp.replace(dest)
