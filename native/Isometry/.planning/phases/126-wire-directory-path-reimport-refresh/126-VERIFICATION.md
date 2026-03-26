---
phase: 126-wire-directory-path-reimport-refresh
verified: 2026-03-26T21:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 126: Wire Directory Path + Re-Import Refresh — Verification Report

**Phase Goal:** Close audit gaps — directoryPath flows through import chunk pipeline so re-import uses stored path instead of falling back to picker; DataExplorer refreshes after re-import commit
**Verified:** 2026-03-26T21:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After importing via discovery flow, `datasets.directory_path` is non-NULL for every imported directory | VERIFIED | `NativeImportCoordinator.sendChunk(…directoryPath: dir.path)` — Swift passes `dir.path` on every chunk; JS `activeDirectoryPath` captured on chunk 0; forwarded via `bridge.importNative(…directoryPath)`; `etl-import-native.handler.ts` line 198 passes it to `CatalogWriter.recordImportRun`; SQL upsert uses `COALESCE(excluded.directory_path, directory_path)` to preserve existing paths |
| 2 | Clicking re-import (↺) on a dataset with stored path triggers seamless re-import without re-opening the picker | VERIFIED | `main.ts` line 755 reads `ds.directory_path` from `datasets:query`; line 757 branches `if (isNative && directoryPath)` — posts `native:request-alto-reimport` with stored path; BridgeManager lines 320-364 handle this message, read cards via `AltoIndexAdapter.fetchCardsForDirectory`, dispatch `alto-reimport-result` to JS; fallback picker only triggers when `!directoryPath` (line 775) |
| 3 | After re-import commit, DataExplorer stats panel immediately reflects updated card counts | VERIFIED | `main.ts` line 921: `void refreshDataExplorer()` called in the `if (committed)` branch immediately after `datasets:commit-reimport` resolves; DSET-04 comment present at line 920 |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|---------|--------|---------|
| `src/native/NativeBridge.ts` | `activeDirectoryPath` capture on chunk 0; pass to `importNative` on final chunk | VERIFIED | Lines 126, 767, 796-803 — module-level var, capture, pass-through |
| `src/worker/WorkerBridge.ts` | `importNative` accepts optional `directoryPath`, forwards in payload | VERIFIED | Line 410-411 — signature updated, payload spread |
| `src/worker/protocol.ts` | `etl:import-native` payload type includes `directoryPath?: string` | VERIFIED | Line 286 |
| `native/Isometry/Isometry/NativeImportCoordinator.swift` | `sendChunk` accepts `directoryPath?`; passes `dir.path` in `runAltoImport` | VERIFIED | Lines 131, 178, 193, 202 |
| `src/worker/handlers/etl-import-native.handler.ts` | Passes `directoryPath` to `CatalogWriter.recordImportRun` | VERIFIED | Line 198 — conditional spread |
| `src/etl/CatalogWriter.ts` | `upsertDataset` accepts `directoryPath?`; SQL uses `COALESCE` to avoid overwriting | VERIFIED | Lines 101, 146, 159 |
| `src/main.ts` | `refreshDataExplorer()` called after `datasets:commit-reimport` commit | VERIFIED | Lines 920-921 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Swift `NativeImportCoordinator.sendChunk` | JS `handleNativeImportChunk` | `native:import-chunk` message with `directoryPath` field in JS payload string | WIRED | `directoryPathField` appended to payload JS at line 193-202 of NativeImportCoordinator.swift |
| `handleNativeImportChunk` (NativeBridge.ts) | `WorkerBridge.importNative` | `activeDirectoryPath` captured on chunk 0, passed on final chunk | WIRED | Lines 796-803 of NativeBridge.ts |
| `WorkerBridge.importNative` | `etl-import-native.handler` | `etl:import-native` message with `directoryPath` in payload | WIRED | WorkerBridge.ts lines 410-411; protocol.ts line 286 |
| `etl-import-native.handler` | `CatalogWriter.upsertDataset` | `recordImportRun` → `upsertDataset` with `directoryPath` | WIRED | handler line 198 → CatalogWriter line 82 → upsertDataset line 159 |
| `main.ts` re-import button | `native:request-alto-reimport` Swift handler | `window.webkit.messageHandlers.nativeBridge.postMessage` with stored path | WIRED | main.ts lines 757-774 |
| BridgeManager `native:request-alto-reimport` | JS `alto-reimport-result` event | `AltoIndexAdapter.fetchCardsForDirectory` → evaluateJavaScript `window.__isometry.receive` | WIRED | BridgeManager.swift lines 339-363 |
| `alto-reimport-result` event | `refreshDataExplorer()` | `datasets:commit-reimport` → `if (committed)` branch | WIRED | main.ts lines 908-922 |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| DSET-03 | User can re-import a directory to refresh its cards (DedupEngine handles updates via source+source_id) | SATISFIED | Full pipeline: Swift passes `dir.path` on import chunk → stored in `datasets.directory_path` → re-import button reads stored path → Swift re-reads cards via `AltoIndexAdapter.fetchCardsForDirectory` → two-phase dedup+commit |
| DSET-04 | Before committing a re-import, user sees a diff preview showing new, modified, and deleted cards | SATISFIED (partial human verification needed) | `DiffPreviewDialog.show()` invoked at main.ts line 899 with `toInsert`, `toUpdate`, `deletedIds`, `deletedNames`, `unchanged`; after commit `refreshDataExplorer()` called (line 921) so stats panel reflects updated counts |

---

### Anti-Patterns Found

None. All modified files are free of TODO, FIXME, placeholder comments, empty implementations, or stub handlers.

---

### Human Verification Required

#### 1. directory_path Persisted After Fresh Discovery Import

**Test:** Open Isometry on a physical device, perform a fresh Alto Index discovery import, then open the DataExplorer catalog section and inspect the re-import (↺) button state.
**Expected:** Clicking ↺ triggers seamless re-import (no directory picker opens). This proves `datasets.directory_path` was stored during the discovery flow.
**Why human:** Requires a physical device with Alto Index data; cannot verify `directory_path` SQL value programmatically without running the app.

#### 2. DataExplorer Stats Update Immediately After Re-Import Commit

**Test:** Trigger a re-import with at least one new card, confirm the diff preview, and observe the DataExplorer stats panel (card count) without closing/reopening the panel.
**Expected:** Card count updates in the stats panel within 1-2 seconds of dismissing the commit confirmation, without requiring a manual refresh.
**Why human:** Real-time UI state update cannot be verified by static code analysis.

---

### Gaps Summary

No gaps. All three success criteria are satisfied by the two commits in this phase:

1. `feat(126-01): thread directoryPath through native import chunk pipeline` — threads the path from Swift `dir.path` through the chunk message, JS accumulator, WorkerBridge, and into `CatalogWriter.upsertDataset` SQL with COALESCE semantics.
2. `feat(126-01): add refreshDataExplorer after re-import commit` — adds the missing `refreshDataExplorer()` call in the committed branch of the `alto-reimport-result` handler.

The REQUIREMENTS.md marks both DSET-03 and DSET-04 as `Complete` at Phase 126 and the implementation evidence confirms this.

---

_Verified: 2026-03-26T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
