.DEFAULT_GOAL := help
.PHONY: help setup up down test lint build e2e hooks logs status audit

help:
	@echo "make setup  - prepare local configuration, build, migrate, and seed"
	@echo "make up     - start services and wait for readiness"
	@echo "make down   - stop services; preserve local data"
	@echo "make test   - run backend and frontend tests"
	@echo "make lint   - check Python, TypeScript, formatting, and configuration"
	@echo "make build  - build the frontend production bundle"
	@echo "make e2e    - run browser smoke tests (requires npm and Playwright)"
	@echo "make hooks  - install local pre-commit hooks (requires Python 3.12)"
	@echo "make logs   - show service logs"
	@echo "make status - show service health"
	@echo "make audit  - check dependencies for known vulnerabilities"

setup up down test lint build e2e hooks logs status audit:
	@bash scripts/dev.sh $@
