/**
 * Apple Notes Content Extractor
 *
 * Decompresses and parses the gzipped protobuf content from ZDATA blobs.
 *
 * Apple Notes uses a custom protobuf schema for rich text content.
 * The structure (reverse-engineered) is approximately:
 *
 * message NoteStoreProto {
 *   message Document {
 *     message Note {
 *       string note_text = 2;
 *       repeated AttributeRun attribute_runs = 5;
 *     }
 *   }
 * }
 *
 * Since we don't have the official .proto file, we use a lightweight
 * manual parser that extracts text content and basic formatting.
 */

import { gunzipSync } from 'zlib';
import { ParsedContent, AttachmentMeta } from './types';

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extract content from Apple Notes ZDATA blob
 *
 * @param data - The raw ZDATA buffer (gzipped protobuf)
 * @returns Parsed content with plain text and markdown
 */
export function extractNoteContent(data: Buffer | null): ParsedContent {
  if (!data || data.length === 0) {
    return emptyContent();
  }

  try {
    // Step 1: Decompress gzip
    const decompressed = gunzipSync(data);

    // Step 2: Parse protobuf structure
    const parsed = parseNoteProtobuf(decompressed);

    // Step 3: Extract additional metadata
    const inlineTags = extractInlineTags(parsed.plainText);
    const urls = extractUrls(parsed.plainText);
    const mentions = extractMentions(parsed.plainText);

    return {
      plainText: parsed.plainText,
      markdown: parsed.markdown,
      inlineTags,
      urls,
      mentions,
      hasAttachments: parsed.attachments.length > 0,
      attachments: parsed.attachments,
    };
  } catch (error) {
    console.error('Failed to extract note content:', error);
    return emptyContent();
  }
}

/**
 * Return empty content structure
 */
function emptyContent(): ParsedContent {
  return {
    plainText: '',
    markdown: '',
    inlineTags: [],
    urls: [],
    mentions: [],
    hasAttachments: false,
    attachments: [],
  };
}

// =============================================================================
// Protobuf Parser
// =============================================================================

interface ParsedProtobuf {
  plainText: string;
  markdown: string;
  attachments: AttachmentMeta[];
}

/**
 * Parse Apple Notes protobuf structure
 *
 * This is a simplified parser that extracts the main text content.
 * Apple Notes uses nested protobuf messages, so we recursively search
 * for string fields that contain the note text.
 */
function parseNoteProtobuf(data: Buffer): ParsedProtobuf {
  const strings: string[] = [];
  const attachments: AttachmentMeta[] = [];

  // Extract all string fields from the protobuf
  extractStringsFromProtobuf(data, strings);

  // The note text is typically the longest string, or concatenated strings
  // Filter out metadata strings (UUIDs, URLs, etc.)
  const textStrings = strings.filter(
    (s) =>
      s.length > 1 &&
      !isUUID(s) &&
      !s.startsWith('x-coredata://') &&
      !s.startsWith('com.apple.')
  );

  // Reconstruct the note text
  // Apple Notes stores text in chunks; we join them
  const plainText = textStrings.join('').trim();

  // Convert to markdown (basic conversion)
  const markdown = convertToMarkdown(plainText);

  return {
    plainText,
    markdown,
    attachments,
  };
}

/**
 * Recursively extract all strings from a protobuf buffer
 */
function extractStringsFromProtobuf(data: Buffer, strings: string[]): void {
  let offset = 0;

  while (offset < data.length) {
    try {
      // Read field header (varint)
      const { value: header, bytesRead: headerBytes } = readVarint(
        data,
        offset
      );
      if (headerBytes === 0) break;

      offset += headerBytes;

      const wireType = Number(header & 0x7n);

      switch (wireType) {
        case 0: {
          // Varint
          const { bytesRead: varintBytes } = readVarint(data, offset);
          offset += varintBytes;
          break;
        }

        case 1: // 64-bit
          offset += 8;
          break;

        case 2: {
          // Length-delimited (string, bytes, or nested message)
          const { value: length, bytesRead: lengthBytes } = readVarint(
            data,
            offset
          );
          offset += lengthBytes;

          const len = Number(length);
          if (offset + len > data.length) break;

          const content = data.subarray(offset, offset + len);

          // Try to interpret as UTF-8 string
          if (isValidUtf8(content)) {
            const str = content.toString('utf8');
            if (str.length > 0 && isPrintableString(str)) {
              strings.push(str);
            }
          }

          // Also try to parse as nested protobuf
          if (content.length > 2) {
            try {
              extractStringsFromProtobuf(content, strings);
            } catch {
              // Not a valid nested protobuf, ignore
            }
          }

          offset += len;
          break;
        }

        case 5: // 32-bit
          offset += 4;
          break;

        default:
          // Unknown wire type, skip to end
          offset = data.length;
          break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Read a varint from the buffer
 */
function readVarint(
  data: Buffer,
  offset: number
): { value: bigint; bytesRead: number } {
  let result = 0n;
  let shift = 0n;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    bytesRead++;

    result |= BigInt(byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return { value: result, bytesRead };
    }

    shift += 7n;

    if (shift > 63n) {
      throw new Error('Varint too long');
    }
  }

  return { value: 0n, bytesRead: 0 };
}

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Check if buffer is valid UTF-8
 */
function isValidUtf8(buffer: Buffer): boolean {
  try {
    const str = buffer.toString('utf8');
    // Check for replacement characters indicating invalid UTF-8
    return !str.includes('\uFFFD');
  } catch {
    return false;
  }
}

/**
 * Check if string contains mostly printable characters
 */
function isPrintableString(str: string): boolean {
  // Count printable characters (including common Unicode)
  let printable = 0;
  for (const char of str) {
    const code = char.charCodeAt(0);
    if (code >= 32 || char === '\n' || char === '\t') {
      printable++;
    }
  }
  return printable / str.length > 0.8;
}

/**
 * Check if string looks like a UUID
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

// =============================================================================
// Markdown Conversion
// =============================================================================

/**
 * Convert plain text to basic markdown
 *
 * Apple Notes formatting is stored in attribute runs within the protobuf.
 * For now, we do basic heuristic conversion:
 * - Lines that look like headers get # prefixes
 * - Checkbox items get - [ ] or - [x] prefixes
 * - Links are preserved
 */
function convertToMarkdown(plainText: string): string {
  const lines = plainText.split('\n');
  const markdownLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Detect potential headers (short lines followed by longer content)
    if (i === 0 && line.length < 100 && line.length > 0) {
      // First line is often the title
      line = `# ${line}`;
    }

    // Detect checkbox items (Apple uses special characters)
    if (line.includes('☐')) {
      line = line.replace(/☐\s*/g, '- [ ] ');
    }
    if (line.includes('☑') || line.includes('✓')) {
      line = line.replace(/[☑✓]\s*/g, '- [x] ');
    }

    // Detect bullet points
    if (line.match(/^[•·]\s/)) {
      line = line.replace(/^[•·]\s/, '- ');
    }

    markdownLines.push(line);
  }

  return markdownLines.join('\n');
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * Extract inline hashtags from text
 */
function extractInlineTags(text: string): string[] {
  const tagRegex = /#(\w+)/g;
  const tags: string[] = [];
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const urls: string[] = [];
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Extract @mentions from text
 */
function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mention = match[1].toLowerCase();
    if (!mentions.includes(mention)) {
      mentions.push(mention);
    }
  }

  return mentions;
}

// =============================================================================
// Alternative: HTML Content Extraction
// =============================================================================

/**
 * Some Apple Notes versions store HTML in addition to protobuf.
 * This extracts content from HTML format if available.
 */
export function extractFromHtml(html: string): ParsedContent {
  // Remove HTML tags for plain text
  const plainText = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  // Basic markdown conversion from HTML
  const markdown = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  return {
    plainText,
    markdown,
    inlineTags: extractInlineTags(plainText),
    urls: extractUrls(plainText),
    mentions: extractMentions(plainText),
    hasAttachments: false,
    attachments: [],
  };
}
