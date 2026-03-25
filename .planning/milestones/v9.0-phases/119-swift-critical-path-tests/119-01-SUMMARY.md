---
phase: 119-swift-critical-path-tests
plan: 01
subsystem: native-swift-tests
tags: [swift, testing, protobuf, notes-etl, tier1]
dependency_graph:
  requires: []
  provides: [ProtobufToMarkdown Tier 1 full-path test coverage]
  affects: [native/Isometry/IsometryTests/ProtobufToMarkdownTests.swift, native/Isometry/Isometry/ProtobufToMarkdown.swift]
tech_stack:
  added: [SwiftProtobuf serialization in tests, zlib C API gzip compression in tests]
  patterns: [makeCompressedProto fixture builder, atParagraphStart paragraph-prefix tracking]
key_files:
  created: []
  modified:
    - native/Isometry/IsometryTests/ProtobufToMarkdownTests.swift
    - native/Isometry/Isometry/ProtobufToMarkdown.swift
decisions:
  - atParagraphStart flag replaces isFirstRun in convertToMarkdown for correct multi-paragraph prefix application
metrics:
  duration: 8m
  completed: 2026-03-22
  tasks_completed: 1
  files_modified: 2
---

# Phase 119 Plan 01: ProtobufToMarkdown Tier 1 Full-Path Tests Summary

Tier 1 full-path tests for ProtobufToMarkdown.extract(zdata:snippet:) covering all 17 formatting types via programmatic NoteStoreProto fixtures + gzip compression.

## What Was Built

Extended `ProtobufToMarkdownTests.swift` with a complete Tier 1 test suite that exercises the full gzip→protobuf→AttributeRun→Markdown pipeline. Previously the tests only covered helper functions; the core conversion path had zero coverage.

### New Infrastructure

- `compressGzip(_:)` — private helper using `deflateInit2_` with `MAX_WBITS + 16` for gzip-format output
- `makeCompressedProto(text:runs:)` — builds `NoteStoreProto`, serializes via `SwiftProtobuf`, gzip-compresses, returns `Data` for `extract(zdata:)`
- `makeRun(length:)` / `makeRun(length:fontWeight:)` / `makeRun(length:styleType:)` — run construction helpers

### New Tests (17 functions)

| Test | Coverage |
|------|----------|
| `extractPlainTextFromProtobuf` | Basic text, isSnippetFallback==false |
| `extractBoldFromProtobuf` | fontWeight=1 → `**bold**` |
| `extractItalicFromProtobuf` | fontWeight=2 → `*italic*` |
| `extractBoldItalicFromProtobuf` | fontWeight=3 → `***bolditalic***` |
| `extractStrikethroughFromProtobuf` | strikethrough=1 → `~~struck~~` |
| `extractHeadingFromProtobuf` | styleType=0 → `# Title` |
| `extractSubheadingFromProtobuf` | styleType=2 → `### ` |
| `extractChecklistFromProtobuf` | styleType=103 done=1/0 → `- [x]` / `- [ ]` |
| `extractCodeBlockFromProtobuf` | styleType=4 → ` ``` ` fences |
| `extractBlockquoteFromProtobuf` | blockQuote=1 → `> ` |
| `extractNumberedListFromProtobuf` | styleType=102 → `1. ` |
| `extractBulletedListFromProtobuf` | styleType=100 → `- ` |
| `extractExternalLinkFromProtobuf` | https:// URL → `[text](url)` |
| `extractNoteLinkFromProtobuf` | applenotes:note/ID → noteLinks array + `[Linked Note: ...]` |
| `extractAttachmentFromProtobuf` | U+FFFC + attachmentInfo → attachments array + `[Image: ...]` |
| `extractHashtagsFromFullBody` | `#project` in body → tags array |
| `extractGeneratesSummary` | 300+ char body → summary ≤ 200 chars |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed paragraph prefix not applied to consecutive paragraph-style AttributeRuns**

- **Found during:** Task 1 (extractChecklistFromProtobuf failed)
- **Issue:** `convertToMarkdown` used `isFirstRun` flag to decide when to apply paragraph prefix, but `isFirstRun` was only `true` for the very first run in the note. Subsequent paragraph runs (e.g., a "Todo item" checklist run following a "Done item" checklist run) had no mechanism to apply their prefix. The paragraph prefix was silently dropped for all runs except the first.
- **Fix:** Replaced `isFirstRun: Bool` with `atParagraphStart: Bool` (initialized `true`, set `true` after every newline, reset to `false` on first content character). Now every paragraph-opening run correctly applies its own `paragraphPrefix(style:)` regardless of position.
- **Files modified:** `native/Isometry/Isometry/ProtobufToMarkdown.swift`
- **Commit:** f8d3e021

## Decisions Made

- `atParagraphStart` flag is the correct model because paragraph-start state is position-in-document, not run-index. This generalizes correctly to any number of consecutive paragraph runs.
- `pendingParagraphPrefix` (for mid-run continuation lines) is retained alongside `atParagraphStart` — they serve different purposes and don't conflict.

## Self-Check: PASSED

- ProtobufToMarkdownTests.swift: FOUND
- ProtobufToMarkdown.swift: FOUND
- Commit f8d3e021: FOUND
- SUMMARY.md: FOUND
