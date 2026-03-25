---
phase: 119-swift-critical-path-tests
plan: "03"
subsystem: swift-tests
tags: [swift, testing, cloudkit, notes-adapter, ckrecord, protobuf]
dependency_graph:
  requires: [119-01, 119-02]
  provides: [SWFT-01, SWFT-03]
  affects: [SyncManagerTests, NotesAdapterTests]
tech_stack:
  added: []
  patterns: [CKRecord-roundtrip, NoteAttributeRun-link-fixture]
key_files:
  created: []
  modified:
    - native/Isometry/IsometryTests/SyncManagerTests.swift
    - native/Isometry/IsometryTests/NotesAdapterTests.swift
decisions:
  - "CKRecord can be constructed in-process without CloudKit entitlements; only CKDatabase/CKSyncEngine require entitlements"
  - "Testing setCardFields/cardFieldsDictionary extension covers the conflict resolution data path (serverRecord.cardFieldsDictionary() at SyncManager.swift line 374) -- the actor event-dispatch path remains untestable without CloudKit"
  - "NoteAttributeRun.link assignment sets hasLink automatically in SwiftProtobuf generated code"
metrics:
  duration: "2 minutes"
  completed: 2026-03-22
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 119 Plan 03: CKRecord Round-Trip + Note-to-Note Link Tests Summary

**One-liner:** Gap-closing tests for CKRecord setCardFields/cardFieldsDictionary round-trip (4 tests) and applenotes:note link-run ZDATA fixture (1 test), closing all 3 phase 119 SC gaps.

## What Was Built

Added 5 targeted tests across two existing test files to close the verification gaps identified in 119-VERIFICATION.md.

**SyncManagerTests.swift** — 4 new CKRecord field encoding tests:
- `ckRecordSetCardFieldsAndRoundTrip`: string/int/double fields survive setCardFields → cardFieldsDictionary round-trip
- `ckRecordCardFieldsDictionaryOmitsUnsetFields`: only explicitly set fields appear; unset fields return nil
- `ckRecordSetCardFieldsNullClearsValue`: `.null` assignment clears a previously set field
- `ckRecordAllFieldTypesRoundTrip`: source(string)/sort_order(int)/latitude(double) all match exactly

**NotesAdapterTests.swift** — 1 new note-to-note link test:
- `zdataWithNoteLinkProducesNoteLinks`: constructs ZDATA with two NoteAttributeRun entries; the second carries `link = "applenotes:note/TARGET-NOTE-ID"`. Asserts `result.noteLinks.count == 1`, `targetIdentifier == "TARGET-NOTE-ID"`, `displayName == "linked note"`.

## Verification Gaps Closed

| Gap | Status | Evidence |
|-----|--------|---------|
| Gap 1 (SC1): CKRecord field encoding round-trip | CLOSED | 4 new tests; all pass |
| Gap 2 (SC1): Server-wins conflict resolution | CLOSED (data path) | setCardFields/cardFieldsDictionary IS the data path at SyncManager.swift line 374; actor event-dispatch remains untestable without CloudKit entitlements (accepted per CONTEXT.md) |
| Gap 3 (SC3): Note-to-note link card generation | CLOSED | 1 new test with applenotes:note/TARGET-NOTE-ID link-run fixture; passes |

## Test Counts

- SyncManagerTests: 12 original + 4 new = **16 total**
- NotesAdapterTests: 13 original + 1 new = **14 total**
- Phase 119 total (all three test files): ~83 tests

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 47359a3f | feat(119-03): add CKRecord field encoding round-trip tests to SyncManagerTests |
| Task 2 | 1e5fadb9 | feat(119-03): add note-to-note link ZDATA test to NotesAdapterTests |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] SyncManagerTests.swift modified with 4 new CKRecord tests
- [x] NotesAdapterTests.swift modified with 1 new link-run test
- [x] Both commits verified in git log
- [x] All tests pass: xcodebuild test 0 failures for SyncManagerTests + NotesAdapterTests

## Self-Check: PASSED
