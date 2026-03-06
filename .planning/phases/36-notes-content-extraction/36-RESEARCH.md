# Phase 36: Notes Content Extraction - Research

**Researched:** 2026-03-06
**Domain:** Apple Notes protobuf parsing (gzip decompression + protobuf deserialization + Markdown reconstruction)
**Confidence:** HIGH

## Summary

Phase 36 extends the existing NotesAdapter (Phase 35) to extract full body text from Apple Notes' gzip-compressed protobuf blobs stored in the `ZICNOTEDATA.ZDATA` column. The protobuf format is well-documented by the digital forensics community, with a canonical `.proto` schema available from `apple_cloud_notes_parser`. The decompression uses gzip (standard zlib with gzip headers), and the protobuf deserialization can be handled by Apple's own SwiftProtobuf library with a generated `.pb.swift` file from the known schema.

The implementation has three core parts: (1) gzip decompression of the ZDATA blob using Swift's native zlib C API, (2) protobuf deserialization using SwiftProtobuf-generated types from the documented `notestore.proto` schema, and (3) Markdown reconstruction by walking the `Note.note_text` and `AttributeRun` entries to map paragraph styles, inline formatting, checklists, attachments, and links to Markdown syntax. Attachment metadata comes from cross-referencing the protobuf's `AttachmentInfo.attachment_identifier` against `ZICCLOUDSYNCINGOBJECT` rows to get filename and type UTI. Note-to-note links are detected via the `AttributeRun.link` field when the URL starts with `applenotes:` or the `notes://` scheme, with the identifier mapping to `ZIDENTIFIER`.

**Primary recommendation:** Use SwiftProtobuf with a `.proto`-generated Swift file for type-safe deserialization, raw zlib C API for gzip decompression (no external dependency), and a `ProtobufToMarkdown` converter that walks attribute runs to reconstruct Markdown.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Best-effort Markdown with high fidelity -- formatting loss should be minimized
- Map Apple Notes paragraph styles to Markdown heading levels: Title -> #, Heading -> ##
- Preserve all inline styles: bold -> **bold**, italic -> *italic*, strikethrough -> ~~text~~
- Render checklists as Markdown checkboxes: - [ ] unchecked, - [x] checked
- Render ordered lists as 1. 2. 3. numbered items; unordered as - bullet lists
- Render tables as | col1 | col2 | Markdown tables (same approach as AppleNotesParser.ts)
- Render code-styled text as ``` fenced code blocks
- Render quote-styled paragraphs as > Markdown blockquotes
- Preserve embedded URLs as [text](url) Markdown links
- Insert inline media placeholders where attachments appeared: [Image: sunset.jpg], [Drawing], etc.
- Auto-generate ~200-char summary from the full body text (same pattern as AppleNotesParser.ts generateSummary)
- Re-extract hashtags from the full body text (not just ZSNIPPET) -- catches tags deeper in the note
- Tags for filterability: bare type names as tags (image, pdf, drawing, audio, video, scan, etc.)
- Append ## Attachments section at end of body content with bullet list of [Type] filename entries
- Cross-reference filenames between inline placeholders in body and Attachments section entries
- Show filename only (no system file paths -- not portable across devices)
- Show human-friendly type category only (Image, PDF, Audio -- not MIME types like image/jpeg)
- No attachment count in summary field -- the Attachments section is sufficient
- Use source_url convention: note-link:{targetZIDENTIFIER} (same pattern as CalendarAdapter's attendee-of:)
- Connection label: links_to with weight 0.5 for forward links (consistent with AppleNotesParser)
- Bidirectional connections: also create linked_from backlink with weight 0.3 (lower than forward)
- Inline references in body text where note links appeared: [Linked Note: Meeting Agenda]
- Unresolved targets (encrypted/deleted notes) get a placeholder card with card_type "collection" and content "[Not imported -- encrypted or deleted]"
- Unidirectional links_to still created to placeholder cards; placeholder gets linked_from back
- Add snippet-only tag to cards that fell back to ZSNIPPET content
- Import summary reports breakdown: "842 notes (812 full body, 27 snippet fallback, 3 encrypted skipped)"
- NULL ZDATA -> use ZSNIPPET + snippet-only tag (never skip a note)
- Maximize extraction on partial failure: if decompression succeeds but Markdown reconstruction fails, extract plain text + hashtags; only fall back fully to ZSNIPPET if decompression itself fails

### Claude's Discretion
- Protobuf parsing approach (manual binary parsing vs. SwiftProtobuf generated code)
- Gzip decompression implementation details
- How to detect/distinguish attachment types from protobuf fields
- Internal protobuf field mapping to Markdown elements
- Error handling granularity within the protobuf parser
- FTS5 optimization strategy for full body content indexing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BODY-01 | Full body text extraction from gzip+protobuf ZDATA blobs | Protobuf schema fully documented; gzip decompression via native zlib; SwiftProtobuf for type-safe deserialization; Markdown reconstruction via AttributeRun walking |
| BODY-02 | Graceful fallback to ZSNIPPET on unknown/malformed protobuf | Three-tier fallback: full Markdown -> plain text extraction -> ZSNIPPET; snippet-only tag marks fallback cards |
| BODY-03 | Attachment metadata (type, filename) preserved on cards | AttachmentInfo.attachment_identifier cross-referenced against ZICCLOUDSYNCINGOBJECT for ZTYPEUTI and ZFILENAME; human-friendly type mapping from UTI |
| BODY-04 | Note-to-note links create connections between cards | AttributeRun.link field contains applenotes:/notes:// URLs with identifier; source_url convention note-link:{ZIDENTIFIER} for auto-connection on TS side |
| BODY-05 | Body content indexed for FTS5 search | Full body text stored in content field; existing SQLiteWriter + FTS5 triggers handle indexing automatically |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SwiftProtobuf | 2.0+ | Protobuf deserialization from .proto schema | Apple's official Swift protobuf library; type-safe generated code; correct varint/field parsing |
| zlib (system) | built-in | Gzip decompression of ZDATA blobs | System library, no external dependency; available via `import zlib` |
| SQLite3 (system) | built-in | Database queries for attachment metadata | Already used by NotesAdapter in Phase 35 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Foundation | built-in | Data, String, URL types | All Swift code |
| os (Logger) | built-in | Structured logging | Debug/error reporting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SwiftProtobuf | Manual binary parsing | Manual parsing avoids the dependency but is error-prone with varint decoding, nested messages, and repeated fields. SwiftProtobuf is Apple's own library and well-maintained. The .proto file is one-time code generation. |
| zlib C API | Foundation NSData.decompressed(using: .zlib) | Foundation's .zlib algorithm does NOT handle gzip headers (0x1F 0x8B magic bytes). ZDATA uses gzip format, not raw deflate. Must use zlib C API with `MAX_WBITS + 32` for auto-detection. |
| zlib C API | GzipSwift / DataCompression SPM package | External dependency for a ~40-line function. Not worth adding when raw zlib achieves the same. |

**Installation:**
SwiftProtobuf is added via SPM in Xcode: File > Add Package > `https://github.com/apple/swift-protobuf` (from: "2.0.0"). The generated `.pb.swift` file is checked into the repo as a one-time artifact (per REQUIREMENTS.md Out of Scope: "protoc in CI").

## Architecture Patterns

### Recommended File Structure
```
native/Isometry/Isometry/
├── NotesAdapter.swift              # Extended: add ZDATA reading + protobuf extraction
├── NoteStoreProto.pb.swift         # Generated from notestore.proto (one-time, checked in)
├── GzipDecompressor.swift          # Gzip decompression utility (~40 lines)
├── ProtobufToMarkdown.swift        # AttributeRun walker -> Markdown string
└── NativeImportAdapter.swift       # Unchanged (CanonicalCard struct)

src/worker/handlers/
└── etl-import-native.handler.ts    # Extended: add note-link: prefix handling
```

### Pattern 1: Three-Tier Fallback Extraction
**What:** Cascading extraction with progressively less fidelity
**When to use:** Every note extraction attempt
**Example:**
```swift
func extractBody(zdata: Data?, snippet: String?) -> (content: String, tags: [String], isSnippetFallback: Bool) {
    // Tier 1: Full Markdown reconstruction
    if let zdata = zdata {
        do {
            let decompressed = try GzipDecompressor.decompress(zdata)
            let proto = try NoteStoreProto(serializedBytes: decompressed)
            let note = proto.document.note
            let markdown = ProtobufToMarkdown.convert(note)
            return (markdown.body, markdown.tags, false)
        } catch let markdownError {
            // Tier 2: Plain text + hashtags from protobuf
            if let decompressed = try? GzipDecompressor.decompress(zdata),
               let proto = try? NoteStoreProto(serializedBytes: decompressed) {
                let plainText = proto.document.note.noteText
                let tags = extractHashtags(from: plainText)
                return (plainText, tags, false)
            }
            // Tier 3: Fall through to ZSNIPPET
        }
    }
    // Tier 3: ZSNIPPET fallback
    let content = snippet ?? ""
    let tags = extractHashtags(from: content)
    return (content, tags, true)
}
```

### Pattern 2: AttributeRun Walker
**What:** Walk note_text character-by-character using AttributeRun lengths to apply formatting
**When to use:** Converting protobuf Note to Markdown
**Example:**
```swift
struct ProtobufToMarkdown {
    struct Result {
        let body: String         // Full Markdown body
        let tags: [String]       // Extracted hashtags
        let attachments: [AttachmentRef]  // For ## Attachments section
        let noteLinks: [NoteLink]         // For connection creation
    }

    static func convert(_ note: Note, attachmentLookup: [String: AttachmentMeta]) -> Result {
        var markdown = ""
        var offset = 0
        let text = note.noteText

        for run in note.attributeRun {
            let runText = substring(text, from: offset, length: Int(run.length))
            offset += Int(run.length)

            // Check for attachment placeholder (U+FFFC object replacement character)
            if runText == "\u{FFFC}", run.hasAttachmentInfo {
                // Insert inline placeholder: [Image: sunset.jpg]
                // Look up metadata from attachmentLookup map
                continue
            }

            // Apply paragraph style (heading, list, checklist, blockquote, code)
            // Apply inline formatting (bold, italic, strikethrough)
            // Handle links (external URLs and note-to-note)
            markdown += applyFormatting(runText, run: run)
        }

        return Result(body: markdown, tags: tags, attachments: attachments, noteLinks: noteLinks)
    }
}
```

### Pattern 3: Source URL Convention for Auto-Connections
**What:** Encode note-to-note link targets in source_url for TS-side connection creation
**When to use:** When a note contains links to other notes
**Example:**
```swift
// For each note link found in protobuf:
// Create a "link card" with source_url = "note-link:{targetZIDENTIFIER}"
let linkCard = CanonicalCard(
    id: UUID().uuidString,
    card_type: "note",
    name: sourceNote.name,
    content: nil,
    source: "native_notes",
    source_id: "link-\(sourceIdentifier)-\(targetIdentifier)",
    source_url: "note-link:\(targetIdentifier)",
    // ... other fields
)
```

```typescript
// In etl-import-native.handler.ts, alongside existing attendee-of: handling:
if (card.source_url?.startsWith('note-link:')) {
    const targetSourceId = card.source_url.replace('note-link:', '');
    const targetUUID = dedupResult.sourceIdMap.get(targetSourceId);
    const sourceUUID = dedupResult.sourceIdMap.get(card.source_id);
    if (targetUUID && sourceUUID) {
        // Forward link: links_to (0.5)
        autoConnections.push({ source_id: sourceUUID, target_id: targetUUID, label: 'links_to', weight: 0.5 });
        // Backlink: linked_from (0.3)
        autoConnections.push({ source_id: targetUUID, target_id: sourceUUID, label: 'linked_from', weight: 0.3 });
    }
}
```

### Anti-Patterns to Avoid
- **Don't parse protobuf manually with raw bytes:** The protobuf wire format (varints, length-delimited fields, nested messages) is complex. SwiftProtobuf handles edge cases (unknown fields, default values, packed repeated fields) correctly.
- **Don't use NSData.decompressed(using: .zlib) for ZDATA:** This handles raw deflate/zlib, not gzip format. ZDATA starts with gzip magic bytes (0x1F 0x8B) and requires `inflateInit2_` with `MAX_WBITS + 32`.
- **Don't load attachment binary data:** Only extract metadata (filename, type). Binary data causes OOM (per REQUIREMENTS.md: "Notes attachment binary content storage -- OOM risk").
- **Don't assume all notes have ZDATA:** Some notes may have NULL ZDATA (very old notes, sync artifacts). Always fall back to ZSNIPPET.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Protobuf deserialization | Manual varint/field parser | SwiftProtobuf generated code from `.proto` | Varints, nested messages, repeated fields, unknown field handling are deceptively complex |
| Gzip header parsing | Custom gzip header reader | zlib `inflateInit2_` with `MAX_WBITS + 32` | System zlib handles all gzip variants (magic bytes, CRC, OS flags) automatically |
| FTS5 indexing of body content | Custom FTS5 triggers or re-indexing | Existing SQLiteWriter + cards_fts triggers | Content field is already indexed by FTS5 triggers on INSERT/UPDATE |
| Connection auto-creation | Custom connection logic in Swift | Existing source_url convention + TS handler | CalendarAdapter's attendee-of: pattern is proven; note-link: is identical |
| Dedup on re-import | Custom dedup in Swift | Existing DedupEngine on TS side | DedupEngine handles source_id matching, sourceIdMap resolution, update-vs-insert |

**Key insight:** The existing ETL pipeline (CanonicalCard -> bridge -> DedupEngine -> SQLiteWriter) handles all persistence concerns. Phase 36 only needs to put richer data into the CanonicalCard fields that Phase 35 already established.

## Common Pitfalls

### Pitfall 1: Gzip vs Zlib Confusion
**What goes wrong:** Using Foundation's `.zlib` decompression on gzip-formatted data fails silently or throws errors.
**Why it happens:** ZDATA uses gzip format (magic bytes 0x1F 0x8B), which wraps deflate with a header. Foundation's `.zlib` expects raw deflate or zlib-wrapped deflate without gzip headers.
**How to avoid:** Use zlib C API directly with `inflateInit2_(&stream, MAX_WBITS + 32, ...)` where `+32` enables automatic gzip detection.
**Warning signs:** Decompression fails on all blobs; error messages about incorrect header check.

### Pitfall 2: Object Replacement Character (U+FFFC) in Note Text
**What goes wrong:** Attachment positions appear as invisible/garbled characters in extracted text.
**Why it happens:** Apple Notes uses Unicode Object Replacement Character (U+FFFC, decimal 65532) as a placeholder where attachments are embedded. Each U+FFFC corresponds to an `AttachmentInfo` in the same-position `AttributeRun`.
**How to avoid:** When walking attribute runs, check for U+FFFC in the text slice. When found, look up the corresponding `AttachmentInfo` to generate an inline placeholder like `[Image: sunset.jpg]`.
**Warning signs:** Strange characters or empty spaces in extracted Markdown.

### Pitfall 3: AttributeRun Length Mismatch
**What goes wrong:** Formatting is applied to wrong text ranges, or extraction crashes with index out of bounds.
**Why it happens:** `AttributeRun.length` counts Unicode scalar values, not UTF-8 bytes or grapheme clusters. Swift String indexing is character-based (grapheme clusters), which can differ from Unicode scalar counts for emoji and combining characters.
**How to avoid:** Use `String.unicodeScalars` view for indexing when walking attribute runs, then convert back to String for output.
**Warning signs:** Formatting bleeds across paragraphs; crashes on notes containing emoji.

### Pitfall 4: Missing Newline Handling in Note Text
**What goes wrong:** All paragraphs merge into one line in the Markdown output.
**Why it happens:** Apple Notes separates paragraphs with newline characters (\n) in `note_text`. Paragraph styles apply to runs that end with \n. The Markdown converter must detect paragraph boundaries.
**How to avoid:** When a run's text ends with \n, close the current paragraph and apply paragraph-level formatting (heading, list item, blockquote) before starting the next.
**Warning signs:** All text appears on one line; heading markers appear mid-text.

### Pitfall 5: Note-to-Note Link Identifier Resolution
**What goes wrong:** Note links don't resolve to cards; connections point to nonexistent targets.
**Why it happens:** The `link` field in AttributeRun contains URLs like `applenotes:note/{some-identifier}` or `notes://showNote?identifier={UUID}`. The identifier format may differ from `ZIDENTIFIER`. Some link targets may be encrypted or deleted notes.
**How to avoid:** Parse both URL formats to extract the identifier. Match against known ZIDENTIFIER values. For unresolvable targets, create placeholder collection cards per the locked decision.
**Warning signs:** Zero note-link connections in import results despite notes containing links.

### Pitfall 6: ZICNOTEDATA vs ZICCLOUDSYNCINGOBJECT Join
**What goes wrong:** ZDATA is NULL for all rows because it's queried from the wrong table.
**Why it happens:** ZDATA lives in the `ZICNOTEDATA` table, not `ZICCLOUDSYNCINGOBJECT`. The Phase 35 query only reads from ZICCLOUDSYNCINGOBJECT. A JOIN is needed: `ZICCLOUDSYNCINGOBJECT.ZNOTEDATA` -> `ZICNOTEDATA.Z_PK`.
**How to avoid:** Add a LEFT JOIN to ZICNOTEDATA in the main notes query, fetching `ZICNOTEDATA.ZDATA` alongside existing ZICCLOUDSYNCINGOBJECT columns.
**Warning signs:** All notes fall back to ZSNIPPET even though they have body content.

## Code Examples

### Gzip Decompression (verified from zlib C API documentation)
```swift
import Foundation
import zlib

enum GzipDecompressor {
    enum GzipError: Error {
        case decompressFailed(Int32)
        case emptyInput
    }

    static func decompress(_ data: Data) throws -> Data {
        guard !data.isEmpty else { throw GzipError.emptyInput }

        var stream = z_stream()
        // MAX_WBITS + 32 enables automatic gzip/zlib detection
        var status = inflateInit2_(&stream, MAX_WBITS + 32, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        guard status == Z_OK else { throw GzipError.decompressFailed(status) }

        var output = Data(capacity: data.count * 2)

        try data.withUnsafeBytes { inputPtr in
            stream.next_in = UnsafeMutablePointer<Bytef>(
                mutating: inputPtr.bindMemory(to: Bytef.self).baseAddress!
            )
            stream.avail_in = uInt(data.count)

            repeat {
                let chunkSize = 16384
                var chunk = Data(count: chunkSize)
                chunk.withUnsafeMutableBytes { outputPtr in
                    stream.next_out = outputPtr.bindMemory(to: Bytef.self).baseAddress!
                    stream.avail_out = uInt(chunkSize)
                    status = inflate(&stream, Z_NO_FLUSH)
                }
                let bytesProduced = chunkSize - Int(stream.avail_out)
                output.append(chunk.prefix(bytesProduced))
            } while status == Z_OK
        }

        inflateEnd(&stream)
        guard status == Z_STREAM_END else { throw GzipError.decompressFailed(status) }
        return output
    }
}
```

### Protobuf Schema (notestore.proto -- source: apple_cloud_notes_parser)
```protobuf
syntax = "proto2";

message NoteStoreProto {
    required Document document = 2;
}

message Document {
    required int32 version = 2;
    required Note note = 3;
}

message Note {
    required string note_text = 2;
    repeated AttributeRun attribute_run = 5;
}

message AttributeRun {
    required int32 length = 1;
    optional ParagraphStyle paragraph_style = 2;
    optional Font font = 3;
    optional int32 font_weight = 5;      // 1=bold, 2=italic, 3=bold+italic
    optional int32 underlined = 6;
    optional int32 strikethrough = 7;
    optional int32 superscript = 8;
    optional string link = 9;
    optional Color color = 10;
    optional AttachmentInfo attachment_info = 12;
    optional int32 unknown_identifier = 13;
    optional int32 emphasis_style = 14;  // iOS 18: 1=purple, 2=pink, 3=orange, 4=mint, 5=blue
}

message ParagraphStyle {
    optional int32 style_type = 1 [default = -1];
    // -1 = body, 0 = title, 1 = heading, 2 = subheading, 4 = monospaced
    // 100 = dotted list, 101 = dashed list, 102 = numbered list, 103 = checkbox
    optional int32 alignment = 2;       // 0=left, 1=center, 2=right, 3=justified
    optional int32 indent_amount = 4;
    optional Checklist checklist = 5;
    optional int32 block_quote = 8;     // Non-zero = blockquote
}

message Checklist {
    required bytes uuid = 1;
    required int32 done = 2;            // 0=unchecked, 1=checked
}

message Font {
    optional string font_name = 1;
    optional float point_size = 2;
    optional int32 font_hints = 3;
}

message Color {
    required float red = 1;
    required float green = 2;
    required float blue = 3;
    required float alpha = 4;
}

message AttachmentInfo {
    optional string attachment_identifier = 1;  // Maps to ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER
    optional string type_uti = 2;               // e.g., public.jpeg, com.apple.drawing.2
}
```

### Paragraph Style to Markdown Mapping
```swift
// Source: Ciofeca Forensics + apple_cloud_notes_parser protobuf analysis
func paragraphPrefix(style: ParagraphStyle, indentLevel: Int = 0) -> String {
    let indent = String(repeating: "  ", count: indentLevel)

    // Check blockquote first (field 8)
    if style.hasBlockQuote && style.blockQuote != 0 {
        return "> "
    }

    switch style.styleType {
    case 0:  return "# "          // Title
    case 1:  return "## "         // Heading
    case 2:  return "### "        // Subheading
    case 4:  return "```\n"       // Monospaced (code block)
    case 100: return "\(indent)- "     // Dotted list
    case 101: return "\(indent)- "     // Dashed list
    case 102: return "\(indent)1. "    // Numbered list
    case 103:                          // Checkbox
        if style.hasChecklist && style.checklist.done != 0 {
            return "\(indent)- [x] "
        } else {
            return "\(indent)- [ ] "
        }
    default: return ""            // Body text (-1)
    }
}
```

### ZICNOTEDATA Join Query
```sql
-- Extended from Phase 35 query to include ZDATA from ZICNOTEDATA
SELECT
    n.ZIDENTIFIER,
    n.{titleColumn},
    n.ZSNIPPET,
    n.{creationDateColumn},
    n.{modificationDateColumn},
    n.{folderColumn},
    {encryptedFilter},
    n.Z_PK,
    nd.ZDATA                    -- NEW: gzipped protobuf blob
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICNOTEDATA nd ON n.ZNOTEDATA = nd.Z_PK
WHERE n.ZIDENTIFIER IS NOT NULL
  AND n.{titleColumn} IS NOT NULL
  AND n.ZMARKEDFORDELETION != 1
```

### Attachment Metadata Query
```sql
-- Look up attachment metadata by ZIDENTIFIER from protobuf AttachmentInfo
SELECT
    a.ZIDENTIFIER,
    a.ZTYPEUTI,
    m.ZFILENAME
FROM ZICCLOUDSYNCINGOBJECT a
LEFT JOIN ZICCLOUDSYNCINGOBJECT m ON a.ZMEDIA = m.Z_PK
WHERE a.ZIDENTIFIER = ?
```

### UTI to Human-Friendly Type Mapping
```swift
func humanFriendlyType(uti: String?) -> String {
    guard let uti = uti else { return "Attachment" }
    switch uti {
    case let u where u.hasPrefix("public.image"),
         let u where u == "public.jpeg",
         let u where u == "public.png",
         let u where u == "public.heic":
        return "Image"
    case "com.apple.drawing.2", "com.apple.drawing":
        return "Drawing"
    case "com.adobe.pdf":
        return "PDF"
    case let u where u.hasPrefix("public.audio"):
        return "Audio"
    case let u where u.hasPrefix("public.movie"),
         let u where u.hasPrefix("public.video"):
        return "Video"
    case "com.apple.notes.gallery":
        return "Gallery"
    case "com.apple.notes.table":
        return "Table"
    case "public.vcard":
        return "Contact"
    case "public.url":
        return "Link"
    case let u where u.contains("scan"):
        return "Scan"
    default:
        return "Attachment"
    }
}
```

### TypeScript Handler Extension for note-link: Prefix
```typescript
// Add alongside existing attendee-of: handling in etl-import-native.handler.ts
if (card.source_url?.startsWith('note-link:')) {
    const targetSourceId = card.source_url.replace('note-link:', '');
    const targetUUID = dedupResult.sourceIdMap.get(targetSourceId);
    // Get the source note's UUID from the link card's source_id
    // source_id format: "link-{sourceZID}-{targetZID}"
    const sourceZID = card.source_id.split('-').slice(1, -1).join('-'); // Handle UUIDs with dashes
    // Actually, simpler: extract from card.source_id pattern
    const personUUID = dedupResult.sourceIdMap.get(card.source_id);

    if (targetUUID && personUUID) {
        // Forward link
        autoConnections.push({
            id: crypto.randomUUID(),
            source_id: personUUID,
            target_id: targetUUID,
            via_card_id: null,
            label: 'links_to',
            weight: 0.5,
            created_at: new Date().toISOString(),
        });
        // Backlink
        autoConnections.push({
            id: crypto.randomUUID(),
            source_id: targetUUID,
            target_id: personUUID,
            via_card_id: null,
            label: 'linked_from',
            weight: 0.3,
            created_at: new Date().toISOString(),
        });
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual protobuf binary parsing | SwiftProtobuf 2.0 generated code | 2024 (Swift 5.9+) | Type-safe, handles unknown fields, correct varint encoding |
| NSData.decompressed(using: .zlib) | Raw zlib C API with MAX_WBITS+32 | Always (gzip != zlib) | Correctly handles gzip headers in ZDATA |
| ZSNIPPET only (Phase 35) | Full ZDATA protobuf extraction | Phase 36 | Complete note body instead of 100-char preview |
| iOS 17 note links | iOS 18 note links + emphasis | Dec 2024 | emphasis_style field 14 added; note linking existed in iOS 15+ |

**iOS 18 / macOS 15 additions (from Ciofeca Forensics Dec 2024):**
- `emphasis_style` (field 14): Colored highlights (1=purple, 2=pink, 3=orange, 4=mint, 5=blue)
- New attachment UTIs: `com.apple.notes.inlinetextattachment.calculateresult` (math), `com.apple.paper` (graphs)
- New DB columns: `ZHASEMPHASIS`, `ZNEEDSTRANSCRIPTION`, `ZOUTLINESTATEDATA`
- These are additive -- the core protobuf structure (Note, AttributeRun, ParagraphStyle) is unchanged

## Open Questions

1. **Note-to-note link URL format**
   - What we know: Links are in AttributeRun.link (field 9). External URLs are plain https:// strings. Internal note links likely use `applenotes:note/{identifier}` or `notes://showNote?identifier={UUID}` format.
   - What's unclear: Exact format of the identifier in internal links. It could be ZIDENTIFIER (UUID), a Core Data URL path (x-coredata://...), or a notes:// scheme URL. Multiple formats may coexist across macOS versions.
   - Recommendation: Parse all known patterns (applenotes:, notes://, x-coredata://) to extract the identifier. Do a pre-implementation spike on the user's actual NoteStore.sqlite to verify the format. The three-tier fallback protects against unrecognized formats.

2. **Table rendering from MergableDataProto**
   - What we know: Tables use a separate CRDT-based protobuf (`MergableDataProto` in `ZMERGEABLEDATA` column of the attachment row in ZICCLOUDSYNCINGOBJECT). The structure involves OrderedSet, Dictionary, and ObjectID types.
   - What's unclear: Whether tables are worth fully parsing for Phase 36 given the CRDT complexity. The decision says "Render tables as Markdown tables" but the data lives in a different blob.
   - Recommendation: For Phase 36, insert a `[Table]` placeholder at the attachment position. Full table rendering from MergableDataProto is complex CRDT parsing and could be a follow-up enhancement. This still satisfies BODY-01 (body text extracted) and BODY-03 (attachment metadata preserved).

3. **Emphasis style rendering**
   - What we know: iOS 18 added `emphasis_style` (field 14) for colored text highlights. Values 1-5 map to colors.
   - What's unclear: Whether Markdown has a good representation for colored highlights.
   - Recommendation: Skip emphasis rendering for now -- standard Markdown has no color syntax. The text content itself is still extracted correctly.

## Sources

### Primary (HIGH confidence)
- [apple_cloud_notes_parser/notestore.proto](https://github.com/threeplanetssoftware/apple_cloud_notes_parser/blob/master/proto/notestore.proto) -- Complete protobuf schema with all field numbers
- [apple-notes-liberator/notestore.proto](https://github.com/HamburgChimps/apple-notes-liberator/blob/main/src/main/proto/notestore.proto) -- Corroborating schema from independent project
- [Ciofeca Forensics: The Protobuf](https://ciofecaforensics.com/2020/09/18/apple-notes-revisited-protobuf/) -- Detailed protobuf field analysis with field numbers
- [Ciofeca Forensics: iOS 18 Notes](https://ciofecaforensics.com/2024/12/10/ios18-notes/) -- Latest schema changes (emphasis_style, new columns)
- [SwiftProtobuf GitHub](https://github.com/apple/swift-protobuf) -- Apple's official Swift protobuf library
- [Ciofeca Forensics: Embedded Objects](https://ciofecaforensics.com/2020/01/13/apple-notes-revisited-easy-embedded-objects/) -- Attachment ZTYPEUTI, ZMEDIA, ZFILENAME chain

### Secondary (MEDIUM confidence)
- [dunhamsteve/notesutils/notes.md](https://github.com/dunhamsteve/notesutils/blob/master/notes.md) -- ParagraphStyle type values, CRDT analysis
- [iphonebackuptools Issue #50](https://github.com/richinfante/iphonebackuptools/issues/50) -- ZDATA gzip format confirmation (0x1F 0x8B magic bytes)
- [Hookmark Forum: Notes URL scheme](https://discourse.hookproductivity.com/t/using-the-built-in-notes-url-scheme/6071) -- notes://showNote?identifier= format
- [ProxymanApp/atlantis DataCompression.swift](https://github.com/ProxymanApp/atlantis/blob/main/Sources/DataCompression.swift) -- Verified gzip decompression with inflateInit2_ + MAX_WBITS+32

### Tertiary (LOW confidence)
- Note-to-note link exact URL format in AttributeRun.link field -- needs validation against actual user data (pre-implementation spike recommended in STATE.md blockers)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- protobuf schema verified across 3+ independent sources; SwiftProtobuf is Apple's library; gzip format confirmed by multiple forensic analyses
- Architecture: HIGH -- extends proven Phase 35 NotesAdapter pattern; source_url convention proven by CalendarAdapter; ETL pipeline unchanged
- Pitfalls: HIGH -- well-documented by forensics community; gzip/zlib distinction verified; U+FFFC pattern documented in multiple sources
- Note links: MEDIUM -- URL format(s) documented but not verified against macOS 15; multiple format variants may exist
- Table rendering: LOW -- CRDT-based MergableDataProto is complex; recommending placeholder for Phase 36

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain -- Apple Notes protobuf format changes only with major OS releases)
