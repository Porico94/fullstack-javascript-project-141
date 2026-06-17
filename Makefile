setup:
	npm install --legacy-peer-deps

start:
	node server/index.js

build:
	npm run build

test:
	npm test

lint:
	npx eslint .
