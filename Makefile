WEB := web
SERVICE := service
PYTHON := datapipeline/.venv/bin/python3
DATA_FRESHNESS_MARKER := datapipeline/data/.build-adjacency-manifest.json
MAX_DATA_AGE_DAYS ?= 1

-include service/.env
export POSTHOG_API_KEY

.PHONY: install setup-pipeline dev build storybook build-storybook _fetch _build-title-index _extract-wiki-edges _build-adjacency pipeline-wikipedia test-pipeline service-build service-start service-dev service-test service-lint reset-hits keygen server-setup add-github-secrets upload-data deploy-data

install:
	cd $(WEB) && npm install

setup-pipeline:
	python3 -m venv datapipeline/.venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r datapipeline/requirements.txt

dev:
	cd $(WEB) && npm run dev

build:
	cd $(WEB) && npm run build

storybook:
	cd $(WEB) && npm run storybook

build-storybook:
	cd $(WEB) && npm run build-storybook

# Run this to build the graph bundle. It orchestrates the private steps at the bottom of this file.
pipeline-wikipedia:
	$(PYTHON) -m datapipeline.run $(ARGS)

test-pipeline:
	$(PYTHON) -m unittest discover -s datapipeline/tests -v

service-build:
	mkdir -p bin
	cd $(SERVICE) && go build -o ../bin/wikilinks-server ./cmd/server

service-start:
	./bin/wikilinks-server --data-dir datapipeline/data

service-dev:
	cd $(SERVICE) && go run ./cmd/server --data-dir ../datapipeline/data

service-test:
	cd $(SERVICE) && go test ./...

service-lint:
	cd $(SERVICE) && golangci-lint run ./...

reset-hits:
	sqlite3 datapipeline/data/wikilinks.db "DELETE FROM article_hits;"

keygen:
	@if [ -f ~/.ssh/wikihop_deploy ]; then \
	  echo "Deploy key already exists at ~/.ssh/wikihop_deploy — skipping."; \
	else \
	  ssh-keygen -t ed25519 -f ~/.ssh/wikihop_deploy -N ''; \
	  echo "Key generated. Add VPS_IP=<your-ip> to .env then run: make server-setup"; \
	fi

server-setup:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Pass it: make $@ VPS_IP=x.x.x.x"; exit 1)
	@test -f ~/.ssh/wikihop_deploy.pub || (echo "Deploy key not found. Run: make keygen"; exit 1)
	ssh root@$(VPS_IP) "mkdir -p /opt/wikihop/deploy"
	rsync -az deploy/ root@$(VPS_IP):/opt/wikihop/deploy/
	rsync -az ~/.ssh/wikihop_deploy.pub root@$(VPS_IP):/opt/wikihop/deploy/wikihop_deploy.pub
	ssh root@$(VPS_IP) "bash /opt/wikihop/deploy/server-setup.sh"

add-github-secrets:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Pass it: make add-github-secrets VPS_IP=x.x.x.x"; exit 1)
	@test -f ~/.ssh/wikihop_deploy || (echo "Deploy key not found at ~/.ssh/wikihop_deploy. Run: make keygen"; exit 1)
	@which gh > /dev/null || (echo "GitHub CLI not installed. Run: brew install gh && gh auth login"; exit 1)
	gh secret set DEPLOY_SSH_KEY < ~/.ssh/wikihop_deploy
	gh secret set VPS_IP --body "$(VPS_IP)"
	@echo "Secrets set. Check: gh secret list"

# Rebuild the graph bundle only if the local data is stale (older than MAX_DATA_AGE_DAYS,
# default 1), then ship it to the server. Pass MAX_DATA_AGE_DAYS=0 to always rebuild.
deploy-data:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Pass it: make $@ VPS_IP=x.x.x.x"; exit 1)
	@if [ -z "$$(find $(DATA_FRESHNESS_MARKER) -mtime -$(MAX_DATA_AGE_DAYS) 2>/dev/null)" ]; then \
		echo "deploy-data: local data missing or older than $(MAX_DATA_AGE_DAYS)d — rebuilding"; \
		$(MAKE) pipeline-wikipedia ARGS="$(ARGS)"; \
	else \
		echo "deploy-data: local data is fresh (<$(MAX_DATA_AGE_DAYS)d old) — skipping rebuild"; \
	fi
	$(MAKE) upload-data VPS_IP=$(VPS_IP)

upload-data:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Pass it: make $@ VPS_IP=x.x.x.x"; exit 1)
	rsync -avz --progress -e "ssh -i ~/.ssh/wikihop_deploy" \
		datapipeline/data/adj_fwd.neighbors.bin \
		datapipeline/data/adj_fwd.offsets.bin \
		datapipeline/data/adj_rev.neighbors.bin \
		datapipeline/data/adj_rev.offsets.bin \
		datapipeline/data/entities.tsv \
		deploy@$(VPS_IP):/opt/wikihop/data/

# --- Private targets below (not meant to be run standalone; called by the public targets above) ---

_fetch:
	$(PYTHON) -m datapipeline.stages.fetch $(ARGS)

_build-title-index:
	$(PYTHON) -m datapipeline.stages.build_title_index --force $(ARGS)

_extract-wiki-edges:
	$(PYTHON) -m datapipeline.stages.extract_wiki_edges --force $(ARGS)

_build-adjacency:
	$(PYTHON) -m datapipeline.stages.build_adjacency --force $(ARGS)
