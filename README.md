# WikiLinks

Wikipedia link pathfinder — React frontend plus a Python datapipeline for downloading and processing the link graph.

## Prerequisites

- **Python 3.9+** (`python3 --version`)
- **Node.js 18+** and npm (`node --version`, `npm --version`)
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
| `make fetch` | Download Kaggle Wikipedia link graph to `datapipeline/raw/` |
| `make extract-edges` | Extract deduplicated edges TSV to `datapipeline/data/edges.tsv` |
| `make build-vocab` | Intern titles to integer IDs → `entities.tsv` + `edges_int.tsv` |
| `make build-adjacency` | Build forward + reverse CSR adjacency from `edges_int.tsv` |
| `make pipeline` | Run fetch, extract-edges, build-vocab, and build-adjacency in order |
| `make test-pipeline` | Run datapipeline unit tests |
| `make dev` | Start the Vite dev server |
| `make build` | Production build of the web app |
| `make storybook` | Start Storybook on port 6006 |
| `make build-storybook` | Build static Storybook site |

### Datapipeline

```bash
make fetch                              # download (replaces existing raw files)
make extract-edges                      # raw CSV -> data/edges.tsv (deduplicated)
make build-vocab                        # edges.tsv -> entities.tsv + edges_int.tsv
make build-adjacency                    # edges_int.tsv -> adj_fwd.* + adj_rev.*
make pipeline                           # fetch + extract-edges + build-vocab + build-adjacency
make test-pipeline                      # unit tests
```

Or run stages directly:

```bash
datapipeline/.venv/bin/python -m datapipeline.stages.fetch
datapipeline/.venv/bin/python -m datapipeline.stages.extract_edges
datapipeline/.venv/bin/python -m datapipeline.stages.build_vocab
datapipeline/.venv/bin/python -m datapipeline.stages.build_adjacency
datapipeline/.venv/bin/python -m datapipeline.run
```

Downloaded files land in `datapipeline/raw/` (gitignored). Processed outputs land in `datapipeline/data/` (gitignored). Each `make` stage target always re-runs and replaces existing output.

## Project layout

```
wikilinks/
├── web/                 # React + Vite frontend
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
