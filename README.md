# WikiLinks

Wikipedia link pathfinder — React frontend, a Python datapipeline for downloading and processing the link graph, and a Go search service that runs bidirectional BFS over the graph.

## Prerequisites

- **Python 3.9+** (`python3 --version`)
- **Node.js 18+** and npm (`node --version`, `npm --version`)
- **Go 1.22+** (`go version`) — required for the search service
- **Kaggle account** (only needed for `make fetch`) — [kaggle.com](https://www.kaggle.com)

## Getting started

Run these once from the repo root.

### 1. Web app dependencies

```bash
make install
```

### 2. Datapipeline (Python venv + packages)

```bash
make setup-pipeline
```

This creates `datapipeline/.venv/` and installs packages from `datapipeline/requirements.txt`.

### 3. Kaggle credentials (for `make fetch`)

1. Create a Kaggle account and accept the license for the [Wikipedia Link Graph 100K](https://www.kaggle.com/datasets/kutayahin/wikipedia-link-graph-100k) dataset.
2. In Kaggle → **Settings** → **API**, click **Generate New Token** and copy the token.
3. Save it to `~/.kaggle/access_token`:

```bash
mkdir -p ~/.kaggle
printf '%s' 'YOUR_TOKEN_HERE' > ~/.kaggle/access_token
chmod 600 ~/.kaggle/access_token
```

Alternatively, set `KAGGLE_API_TOKEN` in your environment.

Legacy API keys (`~/.kaggle/kaggle.json`, or `KAGGLE_USERNAME` + `KAGGLE_KEY`) are also supported.

---

You can now run any Makefile target below.

## Makefile targets

| Command | Description |
|---------|-------------|
| `make install` | Install web app npm dependencies |
| `make setup-pipeline` | Create Python venv and install datapipeline deps |
| `make fetch` | Download Wikipedia link graph to `datapipeline/raw/` (Kaggle default; use `ARGS="--source konect"` or `ARGS="--source wikipedia"`) |
| `make extract-edges` | Extract deduplicated edges TSV to `datapipeline/data/edges.tsv` (Kaggle path) |
| `make map-entities` | Copy KONECT entity titles → `datapipeline/data/entities.tsv` |
| `make edges-to-int` | Convert KONECT integer edges → `datapipeline/data/edges_int.tsv` |
| `make build-vocab` | Intern titles to integer IDs → `entities.tsv` + `edges_int.tsv` (Kaggle path) |
| `make build-title-index` | Build `entities.tsv` + `wiki_page_ids.tsv` from `enwiki-latest-page.sql.gz` (Wikipedia path) |
| `make extract-wiki-edges` | Resolve `pagelinks` + `linktarget` → `edges_int.tsv` (Wikipedia path) |
| `make build-adjacency` | Build forward + reverse CSR adjacency from `edges_int.tsv` |
| `make pipeline-kaggle` | Run full Kaggle pipeline (~29M edges) |
| `make pipeline-konect` | Run full KONECT pipeline (~437M edges) |
| `make pipeline-wikipedia` | Run full Wikipedia SQL dumps pipeline (~6.8–7M articles, likely >1B edges) |
| `make test-pipeline` | Run datapipeline unit tests |
| `make dev` | Start the Vite dev server |
| `make build` | Production build of the web app |
| `make storybook` | Start Storybook on port 6006 |
| `make build-storybook` | Build static Storybook site |
| `make service-build` | Compile Go search service to `bin/wikilinks-server` |
| `make service-dev` | Run Go server in dev mode (uses `datapipeline/data/`) |
| `make service-start` | Run the compiled binary |
| `make service-test` | Run Go unit tests |
| `make service-lint` | Run golangci-lint on the service |

### Search service

The service loads the CSR graph bundle from `datapipeline/data/` at startup and serves HTTP on port `8080`.

```bash
make service-build                          # compile
make service-dev                            # run (requires graph bundle)
curl http://localhost:8080/health           # {"status":"ok"}
curl "http://localhost:8080/api/search?from=Apollo&to=Zeus"
```

Flags (passed via `ARGS` or directly to the binary):

| Flag | Default | Description |
|------|---------|-------------|
| `--data-dir` | `datapipeline/data` | Path to the graph bundle directory |
| `--port` | `8080` | HTTP listen port |

The graph must be built first (`make pipeline-kaggle` / `make pipeline-konect` / `make pipeline-wikipedia`, or at minimum `make build-adjacency`).

### Datapipeline

**Kaggle (default, ~29M edges):**

```bash
make fetch                              # download to datapipeline/raw/
make extract-edges                      # raw CSV -> data/edges.tsv
make build-vocab                        # edges.tsv -> entities.tsv + edges_int.tsv
make build-adjacency                    # edges_int.tsv -> adj_fwd.* + adj_rev.*
make pipeline-kaggle                    # all of the above
```

**KONECT (~437M edges, superseded for full-scale — see `datapipeline/decisions/datasource.md`):**

```bash
make fetch ARGS="--source konect"       # ~3.8 GB download (KONECT tar + enwiki page.sql.gz)
make map-entities                       # ent -> data/entities.tsv
make edges-to-int                       # out + entities -> data/edges_int.tsv
make build-adjacency                    # same CSR bundle as Kaggle
make pipeline-konect                    # all KONECT stages in order
```

**Wikipedia SQL dumps (preferred full-scale path, ~6.8–7M articles, likely >1B edges):**

```bash
make fetch ARGS="--source wikipedia"    # ~10.8 GB download (page + linktarget + pagelinks SQL dumps)
make build-title-index                  # page.sql -> data/entities.tsv + data/wiki_page_ids.tsv
make extract-wiki-edges                 # linktarget + pagelinks -> data/edges_int.tsv
make build-adjacency                    # same CSR bundle as Kaggle/KONECT
make pipeline-wikipedia                 # all Wikipedia stages in order
```

Redirects are not resolved in this path (see `datapipeline/decisions/datasource.md`
"Known limitations / follow-ups").

Or run stages directly:

```bash
datapipeline/.venv/bin/python -m datapipeline.stages.fetch --source kaggle
datapipeline/.venv/bin/python -m datapipeline.stages.extract_edges
datapipeline/.venv/bin/python -m datapipeline.stages.build_vocab
datapipeline/.venv/bin/python -m datapipeline.stages.build_adjacency
datapipeline/.venv/bin/python -m datapipeline.run --source konect
datapipeline/.venv/bin/python -m datapipeline.run --source wikipedia
```

Downloaded files land in `datapipeline/raw/` (gitignored). Processed outputs land in `datapipeline/data/` (gitignored). Pass `--force` to any stage to bypass cache.

## Project layout

```
wikilinks/
├── web/                 # React + Vite frontend
├── service/             # Go search service (bidirectional BFS)
│   ├── cmd/server/      # Entrypoint
│   └── internal/
│       ├── graph/       # CSR loader + BFS engine
│       ├── service/     # Business logic
│       └── controller/  # HTTP handlers
├── datapipeline/
│   ├── decisions/       # Architecture docs (source of truth)
│   ├── stages/          # Pipeline stages (fetch, …)
│   ├── raw/             # Downloaded upstream files (gitignored)
│   └── data/            # Processed stage outputs (gitignored)
├── designs/             # UI design references
└── Makefile
```

## Troubleshooting

**`make fetch` — Kaggle credentials not found**

Ensure `~/.kaggle/access_token` exists with mode `600`, or export `KAGGLE_API_TOKEN`. Legacy `~/.kaggle/kaggle.json` (or `KAGGLE_USERNAME` + `KAGGLE_KEY`) also works.

**`make fetch` — 403 / permission error**

Accept the dataset license on Kaggle while logged in as the same user whose token is in `kaggle.json`.

**`make setup-pipeline` — command not found**

Install Python 3.9+ and ensure `python3` is on your `PATH`.
