WEB := web
SERVICE := service
PYTHON := datapipeline/.venv/bin/python3

.PHONY: install setup-pipeline dev build storybook build-storybook fetch extract-edges build-vocab build-adjacency pipeline test-pipeline service-build service-start service-dev service-test service-lint

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
	$(PYTHON) -m datapipeline.stages.fetch --force $(ARGS)

extract-edges:
	$(PYTHON) -m datapipeline.stages.extract_edges --force $(ARGS)

build-vocab:
	$(PYTHON) -m datapipeline.stages.build_vocab --force $(ARGS)

build-adjacency:
	$(PYTHON) -m datapipeline.stages.build_adjacency --force $(ARGS)

pipeline:
	$(PYTHON) -m datapipeline.run --force $(ARGS)

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
