---
phase: 36-notes-content-extraction
verified: 2026-03-06T20:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 36: Notes Content Extraction Verification Report

**Phase Goal:** Users can import the full body text of Apple Notes -- enabling FTS5 search across complete note content rather than just 100-char snippets
**Verified:** 2026-03-06T20:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Imported note cards contain full body text (not just ZSNIPPET preview) | VERIFIED | NotesAdapter.swift:404 calls `ProtobufToMarkdown.extract(zdata:snippet:attachmentLookup:)` and uses `result.body` as content field (line 421). ProtobufToMarkdown.swift implements full AttributeRun walker (lines 114-297) with Markdown reconstruction from protobuf deserialized via NoteStoreProto. |
| 2 | Notes with malformed protobuf fall back to ZSNIPPET with snippet-only tag | VERIFIED | ProtobufToMarkdown.swift:57-105 implements three-tier fallback cascade. Tier 3 (line 91-104) falls back to ZSNIPPET and appends "snippet-only" to tags array (line 95). Tier 2 (line 71-84) falls back to plain noteText if Markdown reconstruction fails. |
| 3 | Attachment metadata (type, filename) appears on imported cards | VERIFIED | NotesAdapter.swift:197-229 `buildAttachmentLookup()` batch-queries ZTYPEUTI+ZFILENAME from ZICCLOUDSYNCINGOBJECT. Lookup map passed to ProtobufToMarkdown.extract() at line 407. ProtobufToMarkdown.swift:150-173 generates inline `[Type: filename]` placeholders, lines 263-273 appends `## Attachments` section, lines 278-284 adds bare type name tags for filterability. |
| 4 | Note-to-note links create bidirectional connections between cards | VERIFIED | NotesAdapter.swift:448-482 emits link cards with `source_id: "notelink:{sourceZID}:{targetZID}"` and `source_url: "note-link:{targetZID}"`. etl-import-native.handler.ts:98-133 parses colon-delimited source_id, creates forward `links_to` (weight 0.5) and backward `linked_from` (weight 0.3) connections. Placeholder cards for unresolved targets at NotesAdapter.swift:485-519. |
| 5 | Full body content is searchable via FTS5 in SuperSearch | VERIFIED | Full body text stored in `content` field of CanonicalCard (NotesAdapter.swift:421). Existing FTS5 triggers on the `cards` table automatically index the `content` column. No additional wiring needed -- the existing pipeline handles this. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/NoteStoreProto.pb.swift` | SwiftProtobuf types for notestore.proto | VERIFIED | 728 lines. All 9 message types present: NoteStoreProto, NoteDocument, NoteContent, NoteAttributeRun, NoteParagraphStyle, NoteChecklist, NoteFont, NoteColor, NoteAttachmentInfo. Full SwiftProtobuf.Message conformance with decodeMessage/traverse/Equatable. |
| `native/Isometry/Isometry/GzipDecompressor.swift` | Gzip decompression via zlib C API | VERIFIED | 72 lines. Uses `inflateInit2_` with `MAX_WBITS + 32` (line 38-43) for automatic gzip header detection. 16KB chunk processing loop. Proper inflateEnd in all paths. Guards Z_STREAM_END status. |
| `native/Isometry/Isometry/ProtobufToMarkdown.swift` | AttributeRun walker with three-tier fallback | VERIFIED | 535 lines. Full Tier 1 Markdown reconstruction with paragraph styles (-1/0/1/2/4/100-103/blockquote), inline formatting (bold/italic/strikethrough), note link detection (applenotes:/notes://x-coredata://), U+FFFC attachment placeholders, UTI-to-human-type mapping, hashtag re-extraction, ~200-char summary generation. Three-tier fallback cascade. |
| `native/Isometry/Isometry/NotesAdapter.swift` | Extended with ZDATA reading, protobuf extraction, note-links | VERIFIED | 553 lines. LEFT JOIN ZICNOTEDATA (line 326), attachment batch lookup (lines 197-229), ProtobufToMarkdown.extract() call (line 404), note-link card emission (lines 448-482), placeholder card creation (lines 485-519), extraction statistics logging (lines 522-526). |
| `src/worker/handlers/etl-import-native.handler.ts` | note-link: prefix for bidirectional connections | VERIFIED | 171 lines. note-link: handling at lines 95-133. Colon-delimited source_id parsing, forward links_to (0.5) and backward linked_from (0.3) connections. |
| `native/Isometry/Isometry/WebBundle/assets/worker-CwPZlyDC.js` | Rebuilt with note-link handler | VERIFIED | Contains "note-link:", "links_to", "linked_from" patterns in minified bundle. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| GzipDecompressor.swift | zlib (system) | `inflateInit2_` with MAX_WBITS+32 | WIRED | Line 38-43: actual call with correct parameters |
| ProtobufToMarkdown.swift | NoteStoreProto.pb.swift | `NoteStoreProto(serializedBytes:)`, `NoteContent`, `NoteAttributeRun` | WIRED | Line 63 deserializes, line 115 takes NoteContent, line 333 uses NoteAttributeRun |
| ProtobufToMarkdown.swift | GzipDecompressor.swift | `GzipDecompressor.decompress()` | WIRED | Line 62: `try GzipDecompressor.decompress(zdata)` |
| NotesAdapter.swift | ProtobufToMarkdown.swift | `ProtobufToMarkdown.extract()` | WIRED | Line 404: called with zdata, snippet, attachmentLookup |
| NotesAdapter.swift (source_id) | etl-import-native.handler.ts (parsing) | `notelink:{sourceZID}:{targetZID}` format | WIRED | Swift line 477 emits, TS line 104 `split(':')` parses, line 106 validates length===3 |
| etl-import-native.handler.ts | DedupEngine.sourceIdMap | `sourceIdMap.get()` for note-link resolution | WIRED | Lines 100, 108 resolve targetSourceId and sourceZID via sourceIdMap |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BODY-01 | 36-01, 36-02 | Full body text extraction from gzip+protobuf ZDATA blobs | SATISFIED | GzipDecompressor + NoteStoreProto deserialization + ProtobufToMarkdown AttributeRun walker + NotesAdapter ZICNOTEDATA JOIN. Content field populated with full Markdown body. |
| BODY-02 | 36-01, 36-02 | Graceful fallback to ZSNIPPET on unknown/malformed protobuf | SATISFIED | Three-tier fallback in ProtobufToMarkdown.extract(). "snippet-only" tag added on Tier 3. Tier 2 extracts plain text on Markdown failure. Never fails the import. |
| BODY-03 | 36-01, 36-02 | Attachment metadata (type, filename) preserved on cards | SATISFIED | Batch attachment query (NotesAdapter.buildAttachmentLookup), inline [Type: filename] placeholders, ## Attachments section, bare type name tags for filterability, UTI-to-human-type mapping. |
| BODY-04 | 36-02 | Note-to-note links create connections between cards | SATISFIED | Note link detection via extractNoteLinkIdentifier (applenotes:/notes://x-coredata://), link cards with colon-delimited source_id, note-link: source_url convention, bidirectional connections (links_to 0.5, linked_from 0.3), placeholder cards for unresolved targets. |
| BODY-05 | 36-02 | Imported body content available for FTS5 search | SATISFIED | Full body text stored in content field of CanonicalCard. Existing FTS5 triggers on cards table automatically index content. No explicit FTS5 wiring needed. |

No orphaned requirements found. All 5 BODY requirements mapped to Phase 36 in REQUIREMENTS.md, all 5 claimed and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | - |

No TODO, FIXME, HACK, PLACEHOLDER, or stub patterns detected in any phase artifact. No empty implementations or console-log-only handlers.

### Human Verification Required

### 1. Full Body Text Quality

**Test:** Import Apple Notes via the native import picker. Open an imported note card and compare its content field to the original note in Apple Notes.
**Expected:** The card content contains full Markdown body text with headings, bold/italic formatting, checklists, lists, and attachment placeholders -- closely matching the original note's visual structure.
**Why human:** Markdown fidelity assessment requires visual comparison against the original Apple Notes formatting. Paragraph boundary handling and edge cases in AttributeRun walking cannot be verified programmatically without real NoteStore.sqlite test data.

### 2. Note-to-Note Link Connections

**Test:** Import notes that contain internal links to other notes. Check the graph/network view for connections between linked notes.
**Expected:** Bidirectional connections visible between linked notes (links_to forward, linked_from back). Placeholder cards appear for links to encrypted/deleted notes.
**Why human:** Requires real Apple Notes with internal links. The link URL patterns (applenotes:/notes://x-coredata://) vary across macOS versions and note creation methods.

### 3. FTS5 Search Over Full Body Content

**Test:** Import notes, then use SuperSearch to search for a phrase that appears deep in a note body (not in the title or first 100 characters).
**Expected:** The note card appears in search results.
**Why human:** Requires real data import and end-to-end FTS5 pipeline verification through the UI.

### 4. Fallback Behavior

**Test:** If any notes fail protobuf extraction (observable via import summary log showing snippet fallback count > 0), verify those cards have "snippet-only" in their tags and still display the ZSNIPPET content.
**Expected:** Fallback cards show snippet content and are tagged appropriately. Import never fails entirely due to a single note's protobuf issue.
**Why human:** Fallback behavior depends on encountering actual malformed/unsupported protobuf data in real NoteStore.sqlite.

### Gaps Summary

No gaps found. All 5 observable truths verified with supporting evidence at all three levels (exists, substantive, wired). All 5 BODY requirements satisfied. All 4 commits verified in git history. No anti-patterns detected. WebBundle rebuilt with updated handler.

The phase goal -- "Users can import the full body text of Apple Notes -- enabling FTS5 search across complete note content rather than just 100-char snippets" -- is achieved through the complete pipeline: GzipDecompressor (zlib C API with gzip auto-detection) -> NoteStoreProto (SwiftProtobuf deserialization) -> ProtobufToMarkdown (AttributeRun walker with three-tier fallback) -> NotesAdapter (ZICNOTEDATA JOIN, attachment batch lookup, note-link card emission) -> etl-import-native.handler.ts (bidirectional connection creation) -> FTS5 (automatic indexing via content field).

---

_Verified: 2026-03-06T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
