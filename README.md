# WikiLinks

Wikipedia link pathfinder — React frontend, a Python datapipeline for downloading and processing the link graph, and a Go search service that runs bidirectional BFS over the graph.

## Prerequisites

- **Python 3.9+** (`python3 --version`)
- **Node.js 18+** and npm (`node --version`, `npm --version`)
- **Go 1.22+** (`go version`) — required for the search service

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

---

You can now run any Makefile target below.

## Makefile targets

| Command | Description |
|---------|-------------|
| `make install` | Install web app npm dependencies |
| `make setup-pipeline` | Create Python venv and install datapipeline deps |
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
| `make server-setup` | One-time VPS provisioning via SSH (requires `VPS_IP` in `.env`) |
| `make upload-data` | Rsync graph files to the production server |
| `make reset-hits` | Clear article hit counts from the local SQLite database |

`pipeline-wikipedia` is the only public datapipeline target — it orchestrates the underlying stages itself via `datapipeline.run`. The Makefile also defines underscore-prefixed private targets (`_fetch`, `_build-title-index`, `_extract-wiki-edges`, `_build-adjacency`) that run one stage each; they exist for debugging a single stage and aren't meant to be run as the normal way to build the graph.

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

The graph must be built first (`make pipeline-wikipedia`, or at minimum `make build-adjacency`).

### Datapipeline

**Wikipedia SQL dumps (~6.8–7M articles, likely >1B edges):**

```bash
make pipeline-wikipedia                 # fetch -> build-title-index -> extract-wiki-edges -> build-adjacency
```

To debug a single stage in isolation, use its private target directly:

```bash
make _fetch                             # ~10.8 GB download (page + linktarget + pagelinks SQL dumps)
make _build-title-index                 # page.sql -> data/entities.tsv + data/wiki_page_ids.tsv
make _extract-wiki-edges                # linktarget + pagelinks -> data/edges_int.tsv
make _build-adjacency                   # edges_int.tsv -> adj_fwd.* + adj_rev.*
```

Redirects are not resolved in this path (see `datapipeline/decisions/datasource.md`
"Known limitations / follow-ups").

Or run stages directly:

```bash
datapipeline/.venv/bin/python -m datapipeline.stages.fetch
datapipeline/.venv/bin/python -m datapipeline.stages.build_title_index
datapipeline/.venv/bin/python -m datapipeline.stages.extract_wiki_edges
datapipeline/.venv/bin/python -m datapipeline.stages.build_adjacency
datapipeline/.venv/bin/python -m datapipeline.run
```

Downloaded files land in `datapipeline/raw/` (gitignored). Processed outputs land in `datapipeline/data/` (gitignored). Pass `--force` to any stage to bypass cache.

## Production deployment

WikiHop runs on a Hetzner CX23 (4GB RAM, x86) behind Cloudflare. The Go server mmap's the graph files and serves HTTP on port 8080; Caddy handles TLS and reverse proxies from Cloudflare's origin cert.

### First-time setup

**1. Generate the deploy SSH key (once, locally):**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/wikihop_deploy -N ""
# ~/.ssh/wikihop_deploy     → add as GitHub secret DEPLOY_SSH_KEY
# ~/.ssh/wikihop_deploy.pub → used by make server-setup
```

**2. Set your VPS IP in `.env`:**

```bash
VPS_IP=x.x.x.x
```

**3. Run server setup (SSHes in as root, installs Caddy + systemd, creates users):**

```bash
make server-setup
```

**4. Two manual steps on the server** (after `make server-setup` prints instructions):

- Upload the Cloudflare origin certificate to `/etc/caddy/cf-origin.pem` and `/etc/caddy/cf-origin.key`  
  (Generate at dash.cloudflare.com → SSL/TLS → Origin Server → Create Certificate → 15 years)
- Create `/opt/wikihop/.env` with `POSTHOG_API_KEY`, `POSTHOG_HOST`, `APP_ENV=production`

**5. Upload graph data files (~5GB, one time):**

```bash
make upload-data
```

**6. Start services on the server:**

```bash
ssh root@<VPS_IP> "systemctl restart caddy wikihop"
```

### GitHub Actions secrets

Add these two secrets to the GitHub repo (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/wikihop_deploy` (private key) |
| `VPS_IP` | Your Hetzner server IP |

Every push to `main` runs tests then auto-deploys.

### Makefile targets

| Command | Description |
|---------|-------------|
| `make server-setup` | One-time VPS provisioning (run as root via SSH) |
| `make upload-data` | Rsync graph files to `/opt/wikihop/data/` |
| `make reset-hits` | Clear article hit counts from SQLite |

### Admin operations

```bash
# Live logs
ssh deploy@<VPS_IP> 'journalctl -u wikihop -f'

# Service status
ssh deploy@<VPS_IP> 'sudo systemctl status wikihop'

# Reset hit counts
make reset-hits  # local SQLite
# or on server:
ssh deploy@<VPS_IP> 'sudo -u wikihop sqlite3 /opt/wikihop/data/wikilinks.db "DELETE FROM article_hits;"'
```

### Verification

```bash
curl https://wikihop.org/health   # {"status":"ok"}
```

---

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

**`make setup-pipeline` — command not found**

Install Python 3.9+ and ensure `python3` is on your `PATH`.
