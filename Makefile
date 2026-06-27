WEB := web
SERVICE := service
PYTHON := datapipeline/.venv/bin/python3

-include .env
export POSTHOG_API_KEY
export VPS_IP

.PHONY: install setup-pipeline dev build storybook build-storybook fetch extract-edges map-entities edges-to-int build-vocab build-title-index extract-wiki-edges build-adjacency pipeline-kaggle pipeline-konect pipeline-wikipedia test-pipeline service-build service-start service-dev service-test service-lint reset-hits server-setup upload-data

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

server-setup:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Add it to .env or run with VPS_IP=x.x.x.x"; exit 1)
	@test -f ~/.ssh/wikihop_deploy.pub || (echo "Deploy key not found. Run: ssh-keygen -t ed25519 -f ~/.ssh/wikihop_deploy -N ''"; exit 1)
	ssh root@$(VPS_IP) "mkdir -p /opt/wikihop/deploy"
	rsync -az deploy/ root@$(VPS_IP):/opt/wikihop/deploy/
	rsync -az ~/.ssh/wikihop_deploy.pub root@$(VPS_IP):/opt/wikihop/deploy/wikihop_deploy.pub
	ssh root@$(VPS_IP) "bash /opt/wikihop/deploy/server-setup.sh"

upload-data:
	@test -n "$(VPS_IP)" || (echo "VPS_IP is not set. Add it to .env or run with VPS_IP=x.x.x.x"; exit 1)
	rsync -avz --progress \
		datapipeline/data/adj_fwd.neighbors.bin \
		datapipeline/data/adj_fwd.offsets.bin \
		datapipeline/data/adj_rev.neighbors.bin \
		datapipeline/data/adj_rev.offsets.bin \
		datapipeline/data/entities.tsv \
		deploy@$(VPS_IP):/opt/wikihop/data/
	ssh deploy@$(VPS_IP) "sudo chown -R wikihop:wikihop /opt/wikihop/data"
