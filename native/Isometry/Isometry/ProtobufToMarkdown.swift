// ProtobufToMarkdown.swift
// AttributeRun walker converting protobuf Note to Markdown.
//
// Implements the full three-tier extraction cascade per CONTEXT.md locked decisions:
//   Tier 1: Full Markdown reconstruction from protobuf (heading/bold/italic/
//           strikethrough/checklist/list/code/blockquote/URL/attachment placeholders)
//   Tier 2: Plain text + hashtags if Markdown reconstruction fails but
//           decompression succeeded
//   Tier 3: ZSNIPPET fallback if decompression itself fails
//
// Requirements addressed:
//   - BODY-01: Full body text extraction from gzip+protobuf ZDATA blobs
//   - BODY-02: Graceful fallback to ZSNIPPET on unknown/malformed protobuf
//   - BODY-03: Attachment metadata (type, filename) preserved on cards

import Foundation
import SwiftProtobuf
import os

private nonisolated let logger = Logger(subsystem: "works.isometry.app", category: "ProtobufToMarkdown")

nonisolated enum ProtobufToMarkdown {

    // MARK: - Result Types

    struct ConversionResult: Sendable {
        let body: String              // Full Markdown body text
        let summary: String           // ~200-char auto-generated summary
        let tags: [String]            // Hashtags extracted from full body text
        let attachments: [AttachmentRef]   // Attachment metadata for ## Attachments section
        let noteLinks: [NoteLink]     // Note-to-note link targets for connection creation
        let isSnippetFallback: Bool   // true if fell back to ZSNIPPET
    }

    struct AttachmentRef: Sendable {
        let identifier: String        // ZIDENTIFIER for DB lookup
        let typeUti: String?          // UTI from protobuf AttachmentInfo
        let humanType: String         // "Image", "Drawing", "PDF", etc.
        let filename: String?         // Resolved from DB (may be nil until Plan 02 wires lookup)
    }

    struct NoteLink: Sendable {
        let targetIdentifier: String  // ZIDENTIFIER of linked note
        let displayName: String       // Text of the link in the note
    }

    // MARK: - Three-Tier Extraction

    /// Full three-tier extraction (per CONTEXT.md locked decision):
    /// Tier 1: Full Markdown reconstruction from protobuf
    /// Tier 2: Plain text + hashtags if Markdown reconstruction fails but decompression succeeded
    /// Tier 3: ZSNIPPET fallback if decompression itself fails
    static func extract(
        zdata: Data?,
        snippet: String?,
        attachmentLookup: [String: (filename: String?, typeUti: String?)] = [:]
    ) -> ConversionResult {
        // Attempt Tier 1 and Tier 2 if we have ZDATA
        if let zdata = zdata, !zdata.isEmpty {
            // Try decompression
            do {
                let decompressed = try GzipDecompressor.decompress(zdata)
                let proto = try NoteStoreProto(serializedBytes: decompressed)
                let note = proto.document.note

                // Tier 1: Full Markdown reconstruction
                do {
                    let result = try convertToMarkdown(note: note, attachmentLookup: attachmentLookup)
                    return result
                } catch {
                    // Tier 2: Plain text + hashtags (decompression succeeded, Markdown failed)
                    logger.warning("Markdown reconstruction failed, falling back to plain text: \(error.localizedDescription)")
                    let plainText = note.noteText
                    let tags = extractHashtags(from: plainText)
                    let summary = generateSummary(from: plainText)
                    return ConversionResult(
                        body: plainText,
                        summary: summary,
                        tags: tags,
                        attachments: [],
                        noteLinks: [],
                        isSnippetFallback: false
                    )
                }
            } catch {
                // Decompression or protobuf parsing failed -- fall through to Tier 3
                logger.warning("ZDATA extraction failed, falling back to ZSNIPPET: \(error.localizedDescription)")
            }
        }

        // Tier 3: ZSNIPPET fallback
        let content = snippet ?? ""
        let tags = extractHashtags(from: content)
        var allTags = tags
        allTags.append("snippet-only")
        let summary = generateSummary(from: content)
        return ConversionResult(
            body: content,
            summary: summary,
            tags: allTags,
            attachments: [],
            noteLinks: [],
            isSnippetFallback: true
        )
    }

    // MARK: - Markdown Reconstruction (Tier 1)

    private enum MarkdownError: Error {
        case invalidNoteText
    }

    /// Convert protobuf Note to full Markdown with all formatting.
    private static func convertToMarkdown(
        note: NoteContent,
        attachmentLookup: [String: (filename: String?, typeUti: String?)]
    ) throws -> ConversionResult {
        let text = note.noteText
        guard !text.isEmpty else {
            throw MarkdownError.invalidNoteText
        }

        var markdown = ""
        var attachments: [AttachmentRef] = []
        var noteLinks: [NoteLink] = []

        // Use Unicode scalar view for correct indexing (Pitfall 3: attributeRun.length
        // counts Unicode scalars, not grapheme clusters)
        let scalars = Array(text.unicodeScalars)
        var scalarOffset = 0

        // Track state for code blocks
        var inCodeBlock = false
        var pendingParagraphPrefix: String? = nil
        var isFirstRun = true

        for run in note.attributeRun {
            let runLength = Int(run.length)
            let endOffset = min(scalarOffset + runLength, scalars.count)

            guard scalarOffset < scalars.count else { break }

            // Extract the text slice using Unicode scalars
            let runScalars = scalars[scalarOffset..<endOffset]
            let runText = String(String.UnicodeScalarView(runScalars))

            scalarOffset = endOffset

            // Check for attachment placeholder (U+FFFC)
            if runText.contains("\u{FFFC}") && run.hasAttachmentInfo {
                let info = run.attachmentInfo
                let uti = info.hasTypeUti ? info.typeUti : nil
                let identifier = info.hasAttachmentIdentifier ? info.attachmentIdentifier : ""
                let lookup = attachmentLookup[identifier]
                let humanType = humanFriendlyType(uti: lookup?.typeUti ?? uti)
                let filename = lookup?.filename

                let ref = AttachmentRef(
                    identifier: identifier,
                    typeUti: uti,
                    humanType: humanType,
                    filename: filename
                )
                attachments.append(ref)

                // Inline placeholder
                if let name = filename, !name.isEmpty {
                    markdown += "[\(humanType): \(name)]"
                } else {
                    markdown += "[\(humanType)]"
                }
                continue
            }

            // Process the run text line-by-line for paragraph handling
            let lines = splitPreservingNewlines(runText)

            for (lineIndex, line) in lines.enumerated() {
                let isNewline = line == "\n"
                let contentLine = isNewline ? "" : line

                // Apply pending paragraph prefix to content lines
                if !contentLine.isEmpty {
                    if let prefix = pendingParagraphPrefix {
                        markdown += prefix
                        pendingParagraphPrefix = nil
                    } else if isFirstRun && run.hasParagraphStyle {
                        // First run with paragraph style -- apply prefix
                        let prefix = paragraphPrefix(style: run.paragraphStyle)
                        if !prefix.isEmpty {
                            markdown += prefix
                        }
                    }
                    isFirstRun = false
                }

                // Handle code blocks
                let styleType = run.hasParagraphStyle ? run.paragraphStyle.styleType : -1
                if styleType == 4 && !inCodeBlock {
                    markdown += "```\n"
                    inCodeBlock = true
                } else if styleType != 4 && inCodeBlock {
                    markdown += "```\n"
                    inCodeBlock = false
                }

                // Handle note-to-note links and external links
                if run.hasLink && !contentLine.isEmpty {
                    let linkURL = run.link
                    if let noteId = extractNoteLinkIdentifier(from: linkURL) {
                        // Internal note link
                        noteLinks.append(NoteLink(
                            targetIdentifier: noteId,
                            displayName: contentLine
                        ))
                        markdown += "[Linked Note: \(contentLine)]"
                    } else if linkURL.hasPrefix("http://") || linkURL.hasPrefix("https://") {
                        // External URL
                        markdown += "[\(contentLine)](\(linkURL))"
                    } else {
                        // Unknown link format -- render text only
                        markdown += contentLine
                    }
                } else if !contentLine.isEmpty {
                    // Apply inline formatting
                    let formatted = applyInlineFormatting(contentLine, run: run)
                    markdown += formatted
                }

                // Handle newlines (paragraph boundaries)
                if isNewline {
                    if inCodeBlock {
                        markdown += "\n"
                    } else {
                        markdown += "\n"
                    }
                    // Set up paragraph prefix for the next content line
                    // Look ahead: the NEXT run may have a paragraph style
                    // For now, clear the pending prefix -- it will be set by the next run
                    pendingParagraphPrefix = nil
                    isFirstRun = false

                    // Set paragraph prefix for next line from current run's style
                    // (the style applies to the paragraph that this newline terminates)
                    if lineIndex < lines.count - 1 && run.hasParagraphStyle {
                        pendingParagraphPrefix = paragraphPrefix(style: run.paragraphStyle)
                    }
                }
            }

            // If this run has a paragraph style and the next content line should get a prefix
            if run.hasParagraphStyle && !runText.contains("\n") && scalarOffset < scalars.count {
                // The paragraph style applies -- we set the prefix for the current line
                // only if we haven't already applied it
            }
        }

        // Close any open code block
        if inCodeBlock {
            markdown += "```\n"
        }

        // Post-processing: Append ## Attachments section
        if !attachments.isEmpty {
            markdown += "\n## Attachments\n\n"
            for att in attachments {
                if let name = att.filename, !name.isEmpty {
                    markdown += "- [\(att.humanType)] \(name)\n"
                } else {
                    markdown += "- [\(att.humanType)]\n"
                }
            }
        }

        // Extract hashtags from full body text (per locked decision: re-extract from full body)
        var tags = extractHashtags(from: markdown)

        // Add bare type name tags for filterability (per locked decision)
        let typeTagSet = Set(attachments.map { $0.humanType.lowercased() })
        for typeTag in typeTagSet.sorted() {
            if !tags.contains(typeTag) {
                tags.append(typeTag)
            }
        }

        // Generate ~200-char summary
        let summary = generateSummary(from: markdown)

        return ConversionResult(
            body: markdown,
            summary: summary,
            tags: tags,
            attachments: attachments,
            noteLinks: noteLinks,
            isSnippetFallback: false
        )
    }

    // MARK: - Paragraph Style Mapping

    /// Map paragraph style to Markdown prefix.
    private static func paragraphPrefix(style: NoteParagraphStyle) -> String {
        let indentLevel = style.hasIndentAmount ? Int(style.indentAmount) : 0
        let indent = String(repeating: "  ", count: indentLevel)

        // Check blockquote first (field 8)
        if style.hasBlockQuote && style.blockQuote != 0 {
            return "> "
        }

        let type = style.styleType
        switch type {
        case 0:  return "# "           // Title
        case 1:  return "## "          // Heading
        case 2:  return "### "         // Subheading
        case 4:  return ""             // Monospaced (handled via code block state)
        case 100: return "\(indent)- "      // Dotted list
        case 101: return "\(indent)- "      // Dashed list
        case 102: return "\(indent)1. "     // Numbered list
        case 103:                           // Checkbox
            if style.hasChecklist && style.checklist.done != 0 {
                return "\(indent)- [x] "
            } else {
                return "\(indent)- [ ] "
            }
        default: return ""             // Body text (-1)
        }
    }

    // MARK: - Inline Formatting

    /// Apply inline formatting (bold, italic, strikethrough) to text.
    private static func applyInlineFormatting(_ text: String, run: NoteAttributeRun) -> String {
        var result = text

        // Apply strikethrough
        if run.hasStrikethrough && run.strikethrough != 0 {
            result = "~~\(result)~~"
        }

        // Apply bold and italic based on fontWeight
        // 1=bold, 2=italic, 3=bold+italic
        if run.hasFontWeight {
            let weight = run.fontWeight
            if weight == 3 {
                result = "***\(result)***"
            } else if weight == 1 {
                result = "**\(result)**"
            } else if weight == 2 {
                result = "*\(result)*"
            }
        }

        return result
    }

    // MARK: - Note Link Detection

    /// Extract note identifier from internal link URLs.
    /// Handles: applenotes:note/{id}, notes://showNote?identifier={id}, x-coredata://.../{id}
    private static func extractNoteLinkIdentifier(from url: String) -> String? {
        // Pattern 1: applenotes:note/{identifier}
        if url.hasPrefix("applenotes:") {
            if let range = url.range(of: "applenotes:note/") {
                let identifier = String(url[range.upperBound...])
                if !identifier.isEmpty {
                    return identifier
                }
            }
            // Try just applenotes: followed by identifier
            let stripped = url.replacingOccurrences(of: "applenotes:", with: "")
            if !stripped.isEmpty {
                return stripped
            }
        }

        // Pattern 2: notes://showNote?identifier={UUID}
        if url.hasPrefix("notes://") {
            if let urlComponents = URLComponents(string: url),
               let identifier = urlComponents.queryItems?.first(where: { $0.name == "identifier" })?.value {
                return identifier
            }
        }

        // Pattern 3: x-coredata://.../ICNote/{identifier}
        if url.hasPrefix("x-coredata://") {
            // Extract the last path component as identifier
            if let lastSlash = url.lastIndex(of: "/") {
                let identifier = String(url[url.index(after: lastSlash)...])
                if !identifier.isEmpty {
                    return identifier
                }
            }
        }

        return nil
    }

    // MARK: - UTI to Human-Friendly Type

    /// Map UTI to human-friendly type name.
    static func humanFriendlyType(uti: String?) -> String {
        guard let uti = uti else { return "Attachment" }
        let lowered = uti.lowercased()
        switch lowered {
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

    // MARK: - Hashtag Extraction

    /// Extract #hashtag patterns from text.
    /// Matches # followed by word characters (letters, digits, underscore).
    /// Same regex pattern as NotesAdapter.extractHashtags().
    static func extractHashtags(from text: String) -> [String] {
        guard !text.isEmpty else { return [] }

        let pattern = #"#(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: range)

        var tags: [String] = []
        var seen = Set<String>()
        for match in matches {
            if let tagRange = Range(match.range(at: 1), in: text) {
                let tag = String(text[tagRange])
                let lowered = tag.lowercased()
                // Skip Markdown heading markers (##, ###) that look like hashtags
                if !tag.isEmpty && !seen.contains(lowered) {
                    seen.insert(lowered)
                    tags.append(tag)
                }
            }
        }

        return tags
    }

    // MARK: - Summary Generation

    /// Generate ~200-char summary from body text.
    /// Strips Markdown syntax, trims at word boundary.
    /// Same pattern as AppleNotesParser.ts generateSummary.
    static func generateSummary(from text: String) -> String {
        guard !text.isEmpty else { return "" }

        // Strip Markdown syntax for plain text summary
        var plain = text
        // Remove heading markers
        plain = plain.replacingOccurrences(of: "### ", with: "")
        plain = plain.replacingOccurrences(of: "## ", with: "")
        plain = plain.replacingOccurrences(of: "# ", with: "")
        // Remove bold/italic markers
        plain = plain.replacingOccurrences(of: "***", with: "")
        plain = plain.replacingOccurrences(of: "**", with: "")
        plain = plain.replacingOccurrences(of: "~~", with: "")
        // Remove code fences
        plain = plain.replacingOccurrences(of: "```", with: "")
        // Remove blockquote markers
        plain = plain.replacingOccurrences(of: "> ", with: "")
        // Remove checklist markers
        plain = plain.replacingOccurrences(of: "- [x] ", with: "")
        plain = plain.replacingOccurrences(of: "- [ ] ", with: "")
        // Remove list markers
        plain = plain.replacingOccurrences(of: "- ", with: "")
        // Collapse whitespace
        plain = plain.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        // Trim to ~200 chars at word boundary
        if plain.count <= 200 {
            return plain
        }

        let truncated = String(plain.prefix(200))
        // Find last space to trim at word boundary
        if let lastSpace = truncated.lastIndex(of: " ") {
            return String(truncated[..<lastSpace])
        }
        return truncated
    }

    // MARK: - Text Splitting Helpers

    /// Split text into segments preserving newline characters as separate entries.
    private static func splitPreservingNewlines(_ text: String) -> [String] {
        var result: [String] = []
        var current = ""

        for char in text {
            if char == "\n" {
                if !current.isEmpty {
                    result.append(current)
                    current = ""
                }
                result.append("\n")
            } else {
                current.append(char)
            }
        }
        if !current.isEmpty {
            result.append(current)
        }

        return result
    }
}
