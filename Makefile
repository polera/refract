YARN ?= yarn
STRESS_RUNS ?= 50
STRESS_WARMUP ?= 5
CI_RUNS ?= 40
CI_WARMUP ?= 5
CI_DCL_P95_MAX ?= 16
CI_DCL_SD_MAX ?= 2

.PHONY: help build build-refract build-refract-core build-refract-core-hooks build-refract-core-context build-refract-core-memo build-refract-core-security build-refract-full build-react build-preact benchmark bench bench-stress bench-ci

help:
	@echo "Available targets:"
	@echo "  make build      Build Refract demos (root + entrypoint matrix), React demo, and Preact demo"
	@echo "  make benchmark  Build all demo apps and run benchmark suite"
	@echo "  make bench      Alias for benchmark"
	@echo "  make bench-stress  Build all demo apps and run stress benchmark suite"
	@echo "  make bench-ci   Build all demo apps and run CI benchmark guardrails"

build: build-refract build-refract-core build-refract-core-hooks build-refract-core-context build-refract-core-memo build-refract-core-security build-refract-full build-react build-preact

build-refract:
	$(YARN) build

build-refract-core:
	$(YARN) vite build --config benchmark/refract-core-demo/vite.config.ts benchmark/refract-core-demo

build-refract-core-hooks:
	$(YARN) vite build --config benchmark/refract-core-hooks-demo/vite.config.ts benchmark/refract-core-hooks-demo

build-refract-core-context:
	$(YARN) vite build --config benchmark/refract-core-context-demo/vite.config.ts benchmark/refract-core-context-demo

build-refract-core-memo:
	$(YARN) vite build --config benchmark/refract-core-memo-demo/vite.config.ts benchmark/refract-core-memo-demo

build-refract-core-security:
	$(YARN) vite build --config benchmark/refract-core-security-demo/vite.config.ts benchmark/refract-core-security-demo

build-refract-full:
	$(YARN) vite build --config benchmark/refract-full-demo/vite.config.ts benchmark/refract-full-demo

build-react:
	$(YARN) --cwd benchmark/react-demo build

build-preact:
	$(YARN) --cwd benchmark/preact-demo build

benchmark: build
	$(YARN) --cwd benchmark bench

bench: benchmark

bench-stress: build
	BENCH_RUNS=$(STRESS_RUNS) BENCH_WARMUP=$(STRESS_WARMUP) $(YARN) --cwd benchmark bench

bench-ci: build
	BENCH_RUNS=$(CI_RUNS) \
	BENCH_WARMUP=$(CI_WARMUP) \
	BENCH_GUARDRAILS=1 \
	BENCH_GUARDRAIL_DCL_P95_MAX=$(CI_DCL_P95_MAX) \
	BENCH_GUARDRAIL_DCL_SD_MAX=$(CI_DCL_SD_MAX) \
	$(YARN) --cwd benchmark bench
