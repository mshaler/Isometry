---
phase: 110-alto-index-e2e
verified: 2026-03-23T03:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification: true
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "A 501+ card alto-index import now triggers the FTS5 bulk rebuild path (notes.json bumped from 250 to 252 cards; total is 502, crossing isBulkImport = totalCards > 500)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "CommandBar UI Search After Alto-Index Import"
    expected: "Typing a note name in the CommandBar (or search box) returns results from imported alto-index cards"
    why_human: "Spec tests FTS5 via direct SQL query (cards_fts MATCH), not via CommandBar UI interaction. The UI search path through CommandBar/setSearchTerm is not exercised programmatically."
---

# Phase 110: Alto-Index E2E Verification Report

**Phase Goal:** Complete alto-index E2E test coverage with fixture generator, import helper, and spec covering type correctness, dedup, FTS5 bulk rebuild, and purge-replace behavior.
**Verified:** 2026-03-23T03:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 03)

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Playwright spec imports each of the 11 alto-index subdirectory fixture types and asserts correct `card_type` | VERIFIED | `e2e/alto-index.spec.ts` describe block 1 loops all 11 ALTO_TYPES, queries `cards WHERE source = ?`, asserts `card_type` match |
| 2 | Re-importing same alto-index fixtures produces zero net-new cards (DedupEngine idempotency) | VERIFIED | Describe block 2: imports twice, asserts `secondCount === firstCount`. Queries `import_sources WHERE source_type = 'alto_index'` to confirm catalog entry. |
| 3 | A 501+ card alto-index import triggers the FTS5 bulk rebuild path and cards are findable | VERIFIED | notes.json has 252 cards (was 250); total 502 > 500 threshold. Describe block 3 asserts `totalCount > 500` (strict) and queries `cards_fts MATCH 'Note*'` returning > 0. `isBulkImport = totalCards > 500` is now true at runtime. |
| 4 | The alto-index purge-then-replace behavior is explicitly asserted: non-alto seed cards absent after import | VERIFIED | Describe block 4: seeds meryl-streep sample data, imports alto-index, asserts `source NOT LIKE 'alto_%' = 0` and `connections count = 0`. |

**Score:** 4/4 success criteria verified

### Re-Verification: Gap Closure

| Gap | Previous Status | Current Status | Fix Applied |
|-----|----------------|----------------|-------------|
| FTS5 bulk rebuild path not triggered (fixtures produced exactly 500 cards; threshold is `> 500` strict) | PARTIAL | VERIFIED | `generate-alto-fixtures.mjs` default bumped from 250 to 252; `notes.json` regenerated with 252 cards; total is now 502. Spec assertion changed from `toBeGreaterThanOrEqual(500)` to `toBeGreaterThan(500)`. Commit `524c7835`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/fixtures/alto-index/notes.json` | 252 note cards (crosses > 500 threshold) | VERIFIED | 252 cards, all with `source='alto_notes'`, `card_type='note'` |
| `tests/fixtures/alto-index/generate-alto-fixtures.mjs` | Generator with `generateNotes(252)` | VERIFIED | Line 45: `function generateNotes(count = 252)`; line 889: `const notes = generateNotes(252)` |
| `e2e/helpers/etl.ts` | `importAltoIndex` exported function | VERIFIED | Exported at line 227; reads all 11 fixture files via `fs.readFileSync`; calls `importNativeCards(page, allCards, 'alto_index')` |
| `e2e/alto-index.spec.ts` | 4 describe blocks, 200+ lines | VERIFIED | 207 lines, 4 describe blocks: type correctness, dedup, FTS5 bulk rebuild, purge-then-replace |

All 10 non-notes fixture files verified at 25 cards each (books, calendar, calls, contacts, kindle, messages, reminders, safari-bookmarks, safari-history, voice-memos).

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/alto-index.spec.ts` | `e2e/helpers/etl.ts` | `import { importAltoIndex, resetDatabase }` | WIRED | Import at line 14; both functions called in all 4 describe blocks |
| `e2e/alto-index.spec.ts` | `e2e/helpers/isometry.ts` | `import { waitForAppReady, getCardCount }` | WIRED | Import at line 15; `waitForAppReady` in every test, `getCardCount` in 3 of 4 tests |
| `e2e/helpers/etl.ts` | `tests/fixtures/alto-index/*.json` | `fs.readFileSync` for all 11 fixture files | WIRED | `fixtureFiles` array has exactly 11 entries (lines 233-244) |
| `e2e/alto-index.spec.ts` | `src/worker/handlers/etl-import-native.handler.ts` | bridge via `importNativeCards` with `'alto_index'` sourceType | WIRED (indirect) | `importAltoIndex` calls `importNativeCards(page, allCards, 'alto_index')` which triggers `etl:import-native` bridge message |

### Requirements Coverage

ALTO-01..05 requirement IDs are not defined in the current `.planning/REQUIREMENTS.md` (which covers v9.0 Graph Algorithms). These IDs originate in `.planning/milestones/v7.2-REQUIREMENTS.md` (adapter implementation scope). The ROADMAP.md success criteria are the authoritative contract for Phase 110.

| Requirement | Plan | Description (inferred from ROADMAP success criteria) | Status |
|------------|------|------------------------------------------------------|--------|
| ALTO-01 | 110-01 | Fixture generator + importAltoIndex helper (infrastructure) | SATISFIED — notes.json has 252 cards; importAltoIndex exported and functional |
| ALTO-02 | 110-02 | Type correctness for all 11 subdirectory types | SATISFIED — describe block 1 verifies all 11 ALTO_TYPES |
| ALTO-03 | 110-02 | Dedup idempotency on re-import | SATISFIED — describe block 2 verifies re-import produces same card count |
| ALTO-04 | 110-02, 110-03 | FTS5 bulk rebuild at 501+ cards | SATISFIED — 502 total cards, `isBulkImport=true`, spec asserts `> 500` |
| ALTO-05 | 110-02 | Purge-then-replace behavior | SATISFIED — describe block 4 verifies connections=0 and non-alto cards=0 |

**Orphaned requirements:** ALTO-01..05 do not appear in `.planning/REQUIREMENTS.md`. See note above — this is expected; the milestones requirements file has different semantics.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/alto-index.spec.ts` | 66 | Comment says "250 notes + 10 × 25 = 500" but fixture now has 252 notes (502 total) | Info | Stale comment only; assertion at line 68 (`>= 490`) remains correct and passes |
| `e2e/alto-index.spec.ts` | 156 | `page.waitForTimeout(500)` hardcoded delay | Info | Timing-dependent; could be flaky on slow CI. Not a blocker (carried from Plan 02). |

No TODO/FIXME/placeholder comments found. No stub implementations found. No `toBeGreaterThanOrEqual(500)` assertion remains in the FTS5 block.

### Commits Verified

All commits documented in SUMMARY files exist in git log:

- `821d509c` feat(110-01): bump notes.json fixture to 250 cards
- `4172e378` feat(110-01): add importAltoIndex helper to e2e/helpers/etl.ts
- `b29a08ef` docs(110-01): complete alto-index fixture bump and importAltoIndex helper plan
- `d5079e7c` feat(110-02): create alto-index E2E spec with 4 describe blocks
- `524c7835` fix(110-03): bump notes fixture to 252 cards, cross FTS5 bulk rebuild threshold

### Human Verification Required

#### 1. CommandBar UI Search After Alto-Index Import

**Test:** Run `npx playwright test e2e/alto-index.spec.ts` and after the suite passes, manually open the app post-alto-index-import, type "Note" in the CommandBar (or main search box), and verify search results appear.
**Expected:** At least one alto-index note card (e.g., "Note 001") appears in search results.
**Why human:** The FTS5 spec tests via direct SQL `cards_fts MATCH 'Note*'` — this confirms FTS5 is populated. But the ROADMAP success criterion says "findable via CommandBar search". The UI search path through the filter/coordinator/CommandBar interaction is not exercised programmatically in the spec.

### Summary

All 4 success criteria are now verified. The single gap from the initial verification (FTS5 bulk rebuild threshold not crossed) was closed by Plan 03: `notes.json` was bumped from 250 to 252 cards, making the total fixture count 502 which strictly exceeds the `isBulkImport = totalCards > 500` condition in `etl-import-native.handler.ts`. The spec assertion was simultaneously tightened from `>= 500` to `> 500` to mirror the production code exactly.

The human verification item (CommandBar UI search) is carried forward as a non-blocking quality check. The programmatic FTS5 test via direct SQL is an acceptable proxy for automated CI purposes.

---

_Verified: 2026-03-23T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
