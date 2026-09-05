"""Thin orchestrator for datapipeline stages."""

from __future__ import annotations

import argparse
from pathlib import Path

from datapipeline.lib.paths import default_data_dir, default_raw_dir
from datapipeline.stages import (
    build_adjacency,
    build_redirect_map,
    build_title_index,
    extract_wiki_edges,
    fetch,
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run datapipeline stages in order.")
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=default_raw_dir(),
        help="Raw directory for fetch output (default: datapipeline/raw/)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=default_data_dir(),
        help="Data directory for processed outputs (default: datapipeline/data/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run stages even when cached output is valid",
    )
    args = parser.parse_args(argv)

    fetch.run(args.raw_dir, force=args.force)

    build_title_index.run(
        args.raw_dir / build_title_index.DEFAULT_INPUT,
        args.data_dir,
        force=args.force,
    )
    build_redirect_map.run(
        args.data_dir / build_redirect_map.DEFAULT_REDIRECT_TITLES,
        args.raw_dir / build_redirect_map.DEFAULT_REDIRECT_SQL,
        args.data_dir / build_redirect_map.DEFAULT_OUTPUT,
        force=args.force,
    )
    extract_wiki_edges.run(
        args.raw_dir / extract_wiki_edges.DEFAULT_LINKTARGET,
        args.raw_dir / extract_wiki_edges.DEFAULT_PAGELINKS,
        args.data_dir / extract_wiki_edges.DEFAULT_ENTITIES,
        args.data_dir / extract_wiki_edges.DEFAULT_PAGE_IDS,
        args.data_dir / extract_wiki_edges.DEFAULT_OUTPUT,
        redirect_map_path=args.data_dir / build_redirect_map.DEFAULT_OUTPUT,
        force=args.force,
    )

    build_adjacency.run(
        args.data_dir / build_adjacency.DEFAULT_INPUT,
        args.data_dir / build_adjacency.DEFAULT_ENTITIES,
        args.data_dir,
        force=args.force,
    )


if __name__ == "__main__":
    main()
