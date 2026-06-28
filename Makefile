WEB := web
SERVICE := service
PYTHON := datapipeline/.venv/bin/python3

-include service/.env
export POSTHOG_API_KEY

.PHONY: install setup-pipeline dev build storybook build-storybook fetch extract-edges map-entities edges-to-int build-vocab build-title-index extract-wiki-edges build-adjacency pipeline-kaggle pipeline-konect pipeline-wikipedia test-pipeline service-build service-start service-dev service-test service-lint reset-hits keygen server-setup add-github-secrets upload-data

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

fetch:
	$(PYTHON) -m datapipeline.stages.fetch $(ARGS)

extract-edges:
	$(PYTHON) -m datapipeline.stages.extract_edges --max-depth 2 $(ARGS)

map-entities:
	$(PYTHON) -m datapipeline.stages.map_entities $(ARGS)

edges-to-int:
	$(PYTHON) -m datapipeline.stages.edges_to_int $(ARGS)

build-vocab:
	$(PYTHON) -m datapipeline.stages.build_vocab --force $(ARGS)

build-title-index:
	$(PYTHON) -m datapipeline.stages.build_title_index --force $(ARGS)

extract-wiki-edges:
	$(PYTHON) -m datapipeline.stages.extract_wiki_edges --force $(ARGS)

build-adjacency:
	$(PYTHON) -m datapipeline.stages.build_adjacency --force $(ARGS)

pipeline-kaggle:
	$(PYTHON) -m datapipeline.run --source kaggle $(ARGS)

pipeline-konect:
	$(PYTHON) -m datapipeline.run --source konect $(ARGS)

pipeline-wikipedia:
	$(PYTHON) -m datapipeline.run --source wikipedia $(ARGS)

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

upload-data:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Pass it: make $@ VPS_IP=x.x.x.x"; exit 1)
	rsync -avz --progress -e "ssh -i ~/.ssh/wikihop_deploy" \
		datapipeline/data/adj_fwd.neighbors.bin \
		datapipeline/data/adj_fwd.offsets.bin \
		datapipeline/data/adj_rev.neighbors.bin \
		datapipeline/data/adj_rev.offsets.bin \
		datapipeline/data/entities.tsv \
		deploy@$(VPS_IP):/opt/wikihop/data/
