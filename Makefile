YARN ?= yarn
STRESS_RUNS ?= 50
STRESS_WARMUP ?= 5
CI_RUNS ?= 40
CI_WARMUP ?= 5
CI_DCL_P95_MAX ?= 16
CI_DCL_SD_MAX ?= 2

.PHONY: help build build-refract build-react build-preact benchmark bench bench-stress bench-ci

help:
	@echo "Available targets:"
	@echo "  make build      Build Refract, React demo, and Preact demo"
	@echo "  make benchmark  Build all demo apps and run benchmark suite"
	@echo "  make bench      Alias for benchmark"
	@echo "  make bench-stress  Build all demo apps and run stress benchmark suite"
	@echo "  make bench-ci   Build all demo apps and run CI benchmark guardrails"

build: build-refract build-react build-preact

build-refract:
	$(YARN) build

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
