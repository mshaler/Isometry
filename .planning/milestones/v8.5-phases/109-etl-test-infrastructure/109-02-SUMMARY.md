---
phase: 109-etl-test-infrastructure
plan: "02"
subsystem: test-infrastructure
tags:
  - fixtures
  - ci
  - environment-boundary
  - harness
  - alto-index
dependency_graph:
  requires: []
  provides:
    - tests/ENVIRONMENT.md
    - CI environment-boundary job
    - window.__harness.mockPermission hook
    - tests/fixtures/alto-index/ (12 JSON files)
  affects:
    - Phase 110 ETL adapter tests (consume fixtures + boundary enforcement)
    - Phase 113 TCC permission tests (consume mockPermission hook)
tech_stack:
  added: []
  patterns:
    - grep-based CI boundary enforcement
    - __mock_permission_{adapter} window key convention for TCC simulation
    - CanonicalCard fixture generators following existing generate-fixtures.mjs pattern
key_files:
  created:
    - tests/ENVIRONMENT.md
    - tests/fixtures/alto-index/generate-alto-fixtures.mjs
    - tests/fixtures/alto-index/notes.json
    - tests/fixtures/alto-index/contacts.json
    - tests/fixtures/alto-index/calendar.json
    - tests/fixtures/alto-index/messages.json
    - tests/fixtures/alto-index/books.json
    - tests/fixtures/alto-index/calls.json
    - tests/fixtures/alto-index/safari-history.json
    - tests/fixtures/alto-index/kindle.json
    - tests/fixtures/alto-index/reminders.json
    - tests/fixtures/alto-index/safari-bookmarks.json
    - tests/fixtures/alto-index/voice-memos.json
    - tests/fixtures/alto-index/edge-cases.json
  modified:
    - .github/workflows/ci.yml
    - src/views/pivot/harness/HarnessShell.ts
decisions:
  - "mockPermission stores state as window.__mock_permission_{adapter} key; revoked deletes the key rather than setting a third value"
  - "edge-cases.json uses source: alto_edge_cases to distinguish from production types"
  - "CI environment-boundary job runs without checkout caching (no npm ci) to keep it fast"
metrics:
  duration: "5 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 2
---

# Phase 109 Plan 02: WASM/jsdom Boundary + Fixtures Summary

**One-liner:** WASM/jsdom boundary enforcement via CI grep check + ENVIRONMENT.md docs + __mockPermission TCC hook + 12 alto-index JSON fixture files with 25 cards each across all 11 subdirectory types.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Environment boundary docs + CI check + __mockPermission hook | a79345e0 | tests/ENVIRONMENT.md, .github/workflows/ci.yml, src/views/pivot/harness/HarnessShell.ts |
| 2 | Generate and commit alto-index JSON fixtures for all 11 subdirectory types | c64f4f1c | tests/fixtures/alto-index/ (13 files) |

## What Was Built

### Task 1: Boundary enforcement

**tests/ENVIRONMENT.md** — Comprehensive documentation covering:
- The rule (never mix realDb with @vitest-environment jsdom)
- Rationale (WASM binary vs jsdom runtime incompatibility)
- When to use Node vs jsdom environments
- Correct and incorrect examples with code
- How to fix violations (3 options: remove annotation, split files, mock the DB)
- CI enforcement description
- Troubleshooting for 5 common error messages

**.github/workflows/ci.yml** — New `environment-boundary` job (parallel with all existing jobs):
- Runs `grep -rl '@vitest-environment jsdom' tests/` then pipes to `grep -l 'realDb|from.*harness/realDb|from.*database/Database'`
- Hard failure (no continue-on-error) — violations block the build
- No Node.js setup required — pure shell script

**src/views/pivot/harness/HarnessShell.ts** — Two new methods on `window.__harness`:
- `mockPermission(adapter, state)` — stores 'granted'/'denied' on window or deletes key for 'revoked'
- `getPermissionState(adapter)` — returns current state or null
- `destroy()` cleanup — iterates Object.keys(window) to remove all `__mock_permission_*` keys

### Task 2: Alto-index fixtures

12 JSON files under `tests/fixtures/alto-index/`:

| File | Type | Cards | Source |
|------|------|-------|--------|
| notes.json | note | 25 | alto_notes |
| contacts.json | person | 25 | alto_contacts |
| calendar.json | event | 25 | alto_calendar |
| messages.json | message | 25 | alto_messages |
| books.json | reference | 25 | alto_books |
| calls.json | event | 25 | alto_calls |
| safari-history.json | reference | 25 | alto_safari_history |
| kindle.json | reference | 25 | alto_kindle |
| reminders.json | task | 25 | alto_reminders |
| safari-bookmarks.json | reference | 25 | alto_safari_bookmarks |
| voice-memos.json | media | 25 | alto_voice_memos |
| edge-cases.json | note | 10 | alto_edge_cases |

Each per-type fixture:
- Has all 27 CanonicalCard fields (matching src/etl/types.ts exactly)
- Uses realistic field values (not placeholder garbage)
- Source IDs follow pattern: `alto-{type}-{padded_index}`
- Cards 1-3 have edge-case names (long title, special chars, Unicode)
- Varies tags, folders, dates across cards

edge-cases.json covers: null name, null content, 520-char name, emoji (flags/skin tones/ZWJ), Unicode normalization (composed vs decomposed), empty tags, 22 tags, all dates null, source_id with colons/slashes, deeply nested folder path.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- tests/ENVIRONMENT.md — FOUND
- .github/workflows/ci.yml contains environment-boundary — FOUND (1 occurrence)
- src/views/pivot/harness/HarnessShell.ts contains mockPermission — FOUND (2 occurrences)
- tests/fixtures/alto-index/*.json count — 12 files FOUND
- notes.json entry count — 25 CONFIRMED
- edge-cases.json has null name — CONFIRMED
- edge-cases.json has emoji content — CONFIRMED
- Commits a79345e0 and c64f4f1c — FOUND in git log

## Self-Check: PASSED
