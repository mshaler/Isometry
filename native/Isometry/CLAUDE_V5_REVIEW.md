# Review: Post-D-011 Document Updates

*Reviewer: Jake (Claude Code) — 2026-03-04*
*Documents reviewed: `CLAUDE.md` (root, archived), `decision-log.md`, `CLAUDE-v5.md`*

---

## Verdict

**The three edits to CLAUDE-v5.md are precisely scoped and correct.** The D-011 decision is well-reasoned. The root CLAUDE.md archive header is clean. The trap that caused the gap analysis error has been explicitly closed.

This is a good set of changes. The recommendations below are refinements to catch secondary drift that was already present before this session's edits.

---

## What Was Done (Verified)

### Root `CLAUDE.md` — Archive header ✅
- ⚠️ header at the top with three clear pointers (CLAUDE-v5.md, native CLAUDE.md, D-011)
- "sql.js web runtime + WKWebView checkpoint shell is the permanent two-layer architecture"
- "The native Swift SQLite actor described below will not be built"
- Full original content preserved below for historical reference
- **No issues found.**

### `decision-log.md` — D-011 ✅
- Status: Decided, date 2026-03-04
- Five-point rationale covering performance, sync model, boundary clarity, rewrite cost, and review validation
- "What this means for implementation" section with four actionable consequences
- References the three-way architecture review
- Supersedes `SQLITE-MIGRATION-PLAN-v2.md` by name
- **No issues found with D-011 itself.** (See item 1 below for an adjacent issue in D-001–D-010.)

### `CLAUDE-v5.md` — Three targeted edits ✅

| Edit | Location | Verified |
|------|----------|----------|
| Two-document callout block | Lines 5–9 | ✅ Correctly names both active guides and cites D-011 |
| Mission: "sql.js via WKWebView checkpoint on device" | Line 19 | ✅ Replaces retired "native SQLite + CloudKit" |
| "Do not reference" additions | Lines 746–749 | ✅ Names phantom types (`IsometryDatabase`, `Node`/`Edge`, `CKModifyRecordsOperation`) that caused gap analysis error |
| Go/No-Go: "iCloud checkpoint sync" | Line 764 | ✅ Replaces "CloudKit sync" — prevents future CKRecord confusion |

---

## Recommendations (Secondary Drift)

These are pre-existing issues that weren't introduced by this session's edits but are now more visible because the documents are receiving scrutiny.

### 1. D-001 through D-010 statuses say "Proposed" — should be "Decided" or "Implemented"

**Location:** `decision-log.md` index table (lines 12–21) and each decision body

D-011 is correctly marked "Decided". But D-001 through D-010 are all still "Proposed" even though:
- They're treated as final in CLAUDE-v5.md (each marked with ✓)
- The code implementing them has shipped (v1.0 through v2.0)
- CLAUDE-v5.md line 25 says: *"These decisions are **final**. Do not revisit them during implementation."*

A future session reading the decision log index will see 10 "Proposed" items and one "Decided" item, which creates a false impression that D-001–D-010 are still open.

**Recommendation:** Update the status of D-001 through D-010 to at least "Decided" (or "Implemented" / "Verified" for those validated by shipped code and tests). This is a mechanical change — no content decisions required.

**Priority:** Low. The ✓ marks in CLAUDE-v5.md are the stronger signal. But the inconsistency could confuse a session that reads `decision-log.md` first.

---

### 2. CLAUDE-v5.md Phase 7 section is ambiguous post-D-011

**Location:** `CLAUDE-v5.md` lines 549–554

```
### Phase 7: Native Shell (Separate Repo/Subdir)

**Swift implementation:**
- `WebViewContainer` — WKWebView with message handlers
- `CloudKitSync` — Database export/import
- `KeychainManager` — Credential storage
```

This creates two problems:
- The native shell **was built** (v2.0 shipped), so "Phase 7" is simultaneously completed (the shell exists) and retired (the native SQLite migration won't happen). The section doesn't reflect either status.
- The file names listed (`CloudKitSync.swift`, `KeychainManager.swift`) don't match the shipped code (`DatabaseManager.swift`, `BridgeManager.swift`, `AssetsSchemeHandler.swift`, etc.).

**Recommendation:** Add a one-line annotation:

```
### Phase 7: Native Shell ✓ (Shipped as v2.0)

> See `native/Isometry/CLAUDE.md` for the authoritative shell guide.
> Native SQLite migration originally planned for this phase was retired (D-011).
```

This is consistent with the "two-document system" callout at the top — it just needs the pointer repeated at the phase level.

**Priority:** Medium. A session reading the implementation order sequentially will reach Phase 7 and find stale guidance.

---

### 3. CLAUDE-v5.md project structure tree shows phantom native files

**Location:** `CLAUDE-v5.md` lines 344–348

```
native/                            ← Swift/SwiftUI shell (separate repo or subdir)
│   ├── IsometryApp.swift
│   ├── WebViewContainer.swift
│   ├── CloudKitSync.swift
│   └── KeychainManager.swift
```

The actual shipped native directory contains 10 Swift files, none of which are `CloudKitSync.swift` or `KeychainManager.swift`. This tree was written before v2.0 was built.

**Recommendation:** Replace with a pointer rather than trying to maintain a duplicate tree:

```
native/Isometry/                   ← Swift/SwiftUI shell (see native/Isometry/CLAUDE.md for file map)
```

**Priority:** Low. The two-document callout at the top will already direct a reader to the native CLAUDE.md. But the phantom file names could cause grep-based confusion.

---

### 4. D-006 says `'table'` but shipped code uses `'supergrid'`

**Location:** `CLAUDE-v5.md` line 180 and `ContentView.swift` line 41

D-006 defines:
```typescript
| 'table'     // Raw data view
```

The shipped native ContentView uses:
```swift
IsometryView(id: "supergrid", displayName: "SuperGrid", systemImage: "tablecells")
```

If a future session maps JS ViewType strings to Swift sidebar entries, this mismatch will cause a bug.

**Recommendation:** Verify which is canonical (the JS source files will have the definitive `ViewType` enum). If `supergrid` is the shipped name, update D-006 to match. If `table` is the JS-side name, update `ContentView.swift`.

**Priority:** Medium. This is a latent bug waiting for the first cross-boundary feature that touches both sides.

---

### 5. D-010 timing values don't match implementation

**Location:** `decision-log.md` D-010 timing matrix vs. `BridgeManager.swift`

D-010 specifies:

| Trigger | Debounce |
|---------|----------|
| Card mutation | 2 seconds |
| Periodic (foreground) | 5 minutes |

Shipped code (`BridgeManager.swift` line 267):
- Autosave timer: **30 seconds** (not 5 minutes)
- No 2-second mutation debounce exists in Swift (the `mutated` message just sets a flag)

The 30-second interval is documented correctly in `native/Isometry/CLAUDE.md`. The discrepancy is in the decision log.

**Recommendation:** Update D-010 to reflect the shipped values, or add a note that the Swift shell simplified the spec (30s timer replaces both the 2s debounce and 5m periodic). Either way, the shipped behavior should be the source of truth.

**Priority:** Low. This is spec-vs-code drift in a decision that's already implemented. The native CLAUDE.md has the correct values.

---

### 6. `SQLITE-MIGRATION-PLAN-v2.md` does not exist in the repository

**Location:** Referenced in D-011 line 188 and CLAUDE-v5.md line 747

Both documents reference this file by name:
- D-011: *"Superseded document: `SQLITE-MIGRATION-PLAN-v2.md`"*
- CLAUDE-v5.md: *"Do not reference: `SQLITE-MIGRATION-PLAN-v2.md` (retired architecture)"*

A `find` (via Glob) returns no results for `**/SQLITE-MIGRATION-PLAN*.md` anywhere in the repo.

This could mean:
1. The file was already deleted in a previous session
2. It was never committed (only existed in a planning session's context)
3. It was renamed

**Recommendation:** Add "(if it exists)" or "(may have been deleted)" to the references, or confirm whether it was intentionally removed. A future session seeing "do not reference X" will try to find X to understand what it says — and will waste time searching for a file that isn't there.

**Priority:** Low. The "do not reference" instruction works even if the file doesn't exist — it prevents a session from creating or recreating it.

---

## Summary

| Item | Severity | Action |
|------|----------|--------|
| D-001–D-010 still "Proposed" | 🔵 Low | Update statuses to "Decided" or "Implemented" |
| Phase 7 section ambiguous post-D-011 | 🟡 Medium | Add one-line annotation pointing to native CLAUDE.md |
| Project tree has phantom native files | 🔵 Low | Replace with pointer to native CLAUDE.md |
| `'table'` vs `'supergrid'` naming mismatch | 🟡 Medium | Verify canonical name, fix the wrong side |
| D-010 timing values don't match code | 🔵 Low | Update decision log to match shipped 30s interval |
| `SQLITE-MIGRATION-PLAN-v2.md` doesn't exist | 🔵 Low | Clarify in references that file may not exist |

**None of these block ongoing work.** The three targeted edits from this session are correct and should ship as-is. These recommendations are for a future cleanup pass.
