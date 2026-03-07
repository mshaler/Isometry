# Isometry — Build Automation
# Usage: make help

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJ       := native/Isometry/Isometry.xcodeproj
SCHEME     := Isometry
MAC_DEST   := platform=macOS
IOS_DEST   := platform=iOS Simulator,name=iPhone 16
XCBUILD    := xcodebuild -project $(PROJ) -scheme $(SCHEME)

# Filters: strip system noise from xcodebuild output
# - appintentsmetadataprocessor: Xcode metadata tool chatter
# - "export"|"Using the first": SPM duplicate symbol notes
# - "was built for": cross-platform archive noise
NOISE_FILTER := grep -v "appintentsmetadataprocessor\|Using the first\|was built for"

# ---------------------------------------------------------------------------
# Web
# ---------------------------------------------------------------------------

.PHONY: web
web: ## Build web bundle for native shell (vite build:native)
	npm run build:native

.PHONY: web-dev
web-dev: ## Start Vite dev server
	npm run dev

.PHONY: typecheck
typecheck: ## TypeScript type-check (tsc --noEmit)
	npm run typecheck

.PHONY: test-web
test-web: ## Run Vitest suite
	npm run test

.PHONY: lint
lint: ## Run Biome lint + format check
	npm run lint

.PHONY: fix
fix: ## Auto-fix Biome lint + format issues
	npm run fix

# ---------------------------------------------------------------------------
# Native — macOS
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build macOS debug (default)
	@$(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 \
		| tail -30 \
		| $(NOISE_FILTER) ; \
	$(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 \
		| grep -cE "BUILD SUCCEEDED|BUILD FAILED" > /dev/null

.PHONY: check
check: ## Build macOS and show only warnings/errors (zero-noise)
	@echo "Building macOS ($(SCHEME))..."
	@$(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 \
		| grep -E "warning:|error:" \
		| $(NOISE_FILTER) \
		| sort -u; \
	RESULT=$$($(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 | tail -5); \
	if echo "$$RESULT" | grep -q "BUILD SUCCEEDED"; then \
		echo ""; \
		echo "BUILD SUCCEEDED — zero project warnings"; \
	else \
		echo ""; \
		echo "BUILD FAILED"; \
		echo "$$RESULT"; \
		exit 1; \
	fi

.PHONY: warnings
warnings: ## List all unique warnings (for triage)
	@$(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 \
		| grep "warning:" \
		| $(NOISE_FILTER) \
		| sed 's|$(CURDIR)/||g' \
		| sort -u

.PHONY: errors
errors: ## List all errors
	@$(XCBUILD) -destination '$(MAC_DEST)' build 2>&1 \
		| grep "error:" \
		| sed 's|$(CURDIR)/||g' \
		| sort -u

.PHONY: release
release: ## Build macOS release
	@$(XCBUILD) -destination '$(MAC_DEST)' -configuration Release build 2>&1 \
		| tail -5

# ---------------------------------------------------------------------------
# Native — iOS
# ---------------------------------------------------------------------------

.PHONY: build-ios
build-ios: ## Build iOS Simulator debug
	@$(XCBUILD) -destination '$(IOS_DEST)' build 2>&1 \
		| tail -30 \
		| $(NOISE_FILTER)

.PHONY: check-ios
check-ios: ## Build iOS and show only warnings/errors
	@echo "Building iOS ($(SCHEME))..."
	@$(XCBUILD) -destination '$(IOS_DEST)' build 2>&1 \
		| grep -E "warning:|error:" \
		| $(NOISE_FILTER) \
		| sort -u; \
	RESULT=$$($(XCBUILD) -destination '$(IOS_DEST)' build 2>&1 | tail -5); \
	if echo "$$RESULT" | grep -q "BUILD SUCCEEDED"; then \
		echo ""; \
		echo "BUILD SUCCEEDED — zero project warnings"; \
	else \
		echo ""; \
		echo "BUILD FAILED"; \
		echo "$$RESULT"; \
		exit 1; \
	fi

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run XCTest suite (macOS)
	@$(XCBUILD) -destination '$(MAC_DEST)' test 2>&1 | tail -20

.PHONY: test-ios
test-ios: ## Run XCTest suite (iOS Simulator)
	@$(XCBUILD) -destination '$(IOS_DEST)' test 2>&1 | tail -20

.PHONY: test-all
test-all: test-web test ## Run both Vitest and XCTest suites

# ---------------------------------------------------------------------------
# Combined
# ---------------------------------------------------------------------------

.PHONY: all
all: web check ## Build web bundle then check native macOS build

.PHONY: ci
ci: typecheck lint test-web check ## Full CI pipeline: typecheck + lint + vitest + xcode build

.PHONY: clean
clean: ## Clean Xcode derived data for this project
	@$(XCBUILD) clean 2>&1 | tail -3
	@echo "Cleaned."

.PHONY: nuke
nuke: ## Delete ALL Derived Data (nuclear option)
	rm -rf ~/Library/Developer/Xcode/DerivedData/Isometry-*
	@echo "Derived Data nuked."

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@echo "Isometry Build Automation"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""
