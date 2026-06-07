WEB := web

.PHONY: install dev build storybook build-storybook

install:
	cd $(WEB) && npm install

dev:
	cd $(WEB) && npm run dev

build:
	cd $(WEB) && npm run build

storybook:
	cd $(WEB) && npm run storybook

build-storybook:
	cd $(WEB) && npm run build-storybook
