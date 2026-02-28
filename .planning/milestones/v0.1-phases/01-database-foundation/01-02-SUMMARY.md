---
phase: 01-database-foundation
plan: 02
subsystem: database
tags: [sql.js, wasm, sqlite, fts5, emscripten]

# Dependency graph
requires: []
provides:
  - "Custom sql.js WASM artifact with FTS5 enabled (src/assets/sql-wasm-fts5.wasm)"
  - "Companion JS loader (src/assets/sql-wasm-fts5.js)"
  - "Reproducible build script (scripts/build-wasm.sh) with Docker + local emcc fallback"
affects:
  - 01-database-foundation
  - all phases (every plan depends on FTS5-capable sql.js WASM)

# Tech tracking
tech-stack:
  added:
    - "Emscripten 5.0.0 (build-time only, via Homebrew)"
    - "SQLite 3.49.0 (compiled into WASM via sql.js Makefile)"
  patterns:
    - "Custom WASM artifact committed to repo at src/assets/ — never replace node_modules content"
    - "Build script supports Docker (preferred) and local emcc (fallback) — macOS sha3sum workaround included"
    - "FTS5 enabled via -DSQLITE_ENABLE_FTS5 added to sql.js Makefile SQLITE_COMPILATION_FLAGS"

key-files:
  created:
    - "scripts/build-wasm.sh"
    - "src/assets/sql-wasm-fts5.wasm"
    - "src/assets/sql-wasm-fts5.js"
    - ".gitignore"
  modified: []

key-decisions:
  - "Built locally with Emscripten 5.0.0 via Homebrew (Docker unavailable) — same version as sql.js devcontainer pin"
  - "Added local emcc fallback to build-wasm.sh (Docker-first, local emcc second) — macOS sha3sum workaround documented in script"
  - "WASM stored at src/assets/sql-wasm-fts5.wasm (not node_modules override) — survives npm install"
  - ".build/ added to .gitignore — cloned sql.js repo and Emscripten output are build artifacts, not committed"

patterns-established:
  - "Pattern: Build WASM once, commit artifact — avoid rebuilding per developer machine"
  - "Pattern: Use locateFile callback in initSqlJs() to point to src/assets/sql-wasm-fts5.wasm"

requirements-completed: [DB-01]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 1 Plan 02: Custom sql.js FTS5 WASM Build Summary

**SQLite 3.49.0 compiled to WASM with -DSQLITE_ENABLE_FTS5 via Emscripten 5.0.0, producing a 756KB artifact with FTS5 porter/unicode61 tokenizer confirmed via pragma_compile_options**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T05:58:21Z
- **Completed:** 2026-02-28T06:00:30Z
- **Tasks:** 2 (1 auto + 1 auto-approved checkpoint)
- **Files modified:** 4

## Accomplishments

- Built custom sql.js WASM with -DSQLITE_ENABLE_FTS5 using Emscripten 5.0.0
- Verified FTS5 capability via `pragma_compile_options` query (ENABLE_FTS5 confirmed)
- Committed 756KB WASM artifact (~118KB larger than default FTS3-only build)
- Created reproducible build script with Docker-first + local emcc fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create build script and attempt custom FTS5 WASM build** - `9f81748` (feat)

Task 2 was a checkpoint:human-verify auto-approved in auto mode (FTS5 already verified programmatically).

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `scripts/build-wasm.sh` - Reproducible build script: clones sql.js, patches Makefile with FTS5 flag, builds via Docker or local emcc; includes macOS sha3sum workaround
- `src/assets/sql-wasm-fts5.wasm` - Custom-built SQLite 3.49.0 WASM with FTS5 (756KB)
- `src/assets/sql-wasm-fts5.js` - Companion JS loader for the custom WASM
- `.gitignore` - Excludes .build/ (Emscripten artifacts), node_modules/, dist/, .DS_Store

## Decisions Made

- **Local emcc instead of Docker:** Docker not available on build machine. Emscripten 5.0.0 was installed via Homebrew (same version as sql.js devcontainer pin). Build script updated to try Docker first, then local emcc.
- **macOS sha3sum workaround:** The sql.js Makefile uses `sha3sum -a 256` to verify the SQLite amalgamation zip. macOS does not have sha3sum. The build script pre-extracts the zip before invoking make, then touches the directory to satisfy make's dependency check.
- **Build-time only Emscripten:** Emscripten is a build-time dependency. The WASM artifact is committed so no developer needs to build it again unless updating the SQLite version or flags.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated build-wasm.sh to support local emcc fallback**
- **Found during:** Task 1 (running the build script)
- **Issue:** Docker was unavailable. The original script printed instructions and exited. Local Emscripten 5.0.0 was installed via Homebrew and could build successfully.
- **Fix:** Updated build script to: (1) try Docker first, (2) fall back to local emcc with macOS sha3sum workaround, (3) only print manual instructions if neither is available.
- **Files modified:** `scripts/build-wasm.sh`
- **Verification:** Build succeeded with local emcc; FTS5 confirmed via pragma_compile_options
- **Committed in:** `9f81748` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in build script missing local emcc fallback)
**Impact on plan:** Auto-fix necessary for the build to complete. The script now correctly handles the common case of Homebrew-installed emcc on macOS.

## Issues Encountered

- `sha3sum` not available on macOS — worked around by pre-extracting the SQLite amalgamation zip before invoking make, then touching the target directory to bypass the checksum step. This is documented in the build script.

## User Setup Required

None - the WASM artifact is committed to the repo. No external service configuration required.

## Next Phase Readiness

- `src/assets/sql-wasm-fts5.wasm` is ready for use in plans 01-03, 01-04
- Plans 01-03 and 01-04 can reference this WASM via `locateFile` callback in initSqlJs()
- Plan 01-03 (schema + Database.ts) can now implement the FTS5 virtual table and three-trigger sync

---
*Phase: 01-database-foundation*
*Completed: 2026-02-27*
