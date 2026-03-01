// Isometry v5 — Phase 8 Attachment Parsers
// Helpers for extracting data from alto-index attachment types.

import type { AltoAttachment } from '../types';

/**
 * Extract hashtag names from hashtag attachments.
 * Parses com.apple.notes.inlinetextattachment.hashtag content.
 *
 * Example attachment content:
 * <a class="tag link" href="/tags/film">#film</a>
 *
 * @returns Array of tag names without # prefix
 */
export function extractHashtags(attachments: AltoAttachment[]): string[] {
  const tags: string[] = [];

  for (const att of attachments) {
    if (att.type !== 'com.apple.notes.inlinetextattachment.hashtag') continue;
    if (!att.content) continue;

    // Extract tag from HTML: <a ...>#tagname</a>
    const match = att.content.match(/#(\w+)/);
    if (match && match[1]) {
      tags.push(match[1]);
    }
  }

  return tags;
}

/**
 * Extract internal note link IDs from link attachments.
 * Parses com.apple.notes.inlinetextattachment.link content.
 *
 * @returns Array of note IDs (as strings) that this note links to
 */
export function extractNoteLinks(attachments: AltoAttachment[]): string[] {
  const noteIds: string[] = [];

  for (const att of attachments) {
    if (att.type !== 'com.apple.notes.inlinetextattachment.link') continue;

    // The attachment id or content should contain the target note ID
    // Format varies by alto-index version; extract numeric ID
    if (att.id) {
      const match = att.id.match(/(\d+)/);
      if (match && match[1]) {
        noteIds.push(match[1]);
      }
    }
  }

  return noteIds;
}

/**
 * Convert HTML table to Markdown table syntax.
 * Parses com.apple.notes.table attachment content.
 *
 * @param html - HTML table string
 * @returns Markdown table string
 */
export function parseTableToMarkdown(html: string): string {
  // Simple regex-based extraction for Apple Notes tables
  // Tables are relatively well-formed in alto-index exports

  const rows: string[][] = [];

  // Extract rows: <tr>...</tr>
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const rowContent = rowMatch[1];
    if (!rowContent) continue;

    const cells: string[] = [];

    // Extract cells: <td>...</td> or <th>...</th>
    const cellMatches = rowContent.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    for (const cellMatch of cellMatches) {
      // Strip HTML tags and trim whitespace
      const cellText = (cellMatch[1] ?? '')
        .replace(/<[^>]+>/g, '')
        .trim();
      cells.push(cellText);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return '';

  // Build Markdown table
  const lines: string[] = [];

  // Header row
  const headerRow = rows[0];
  if (headerRow) {
    lines.push('| ' + headerRow.join(' | ') + ' |');
    lines.push('| ' + headerRow.map(() => '---').join(' | ') + ' |');
  }

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row) {
      lines.push('| ' + row.join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}

/**
 * Extract @mentions from note content.
 * Matches @FirstName LastName (two words) or @SingleWord.
 *
 * @returns Array of unique person names (lowercase, deduplicated)
 */
export function extractMentions(content: string): string[] {
  // Two-pass approach:
  // 1. Try to match @Word Word (two capitalized words)
  // 2. Match remaining @Word (single word)

  const uniqueNames = new Set<string>();

  // First pass: match two-word mentions (@FirstName LastName)
  // Look for @ followed by capitalized word, space, and another capitalized word
  const twoWordRegex = /@([A-Z]\w+\s+[A-Z]\w+)/g;
  let match;

  while ((match = twoWordRegex.exec(content)) !== null) {
    const name = match[1]?.trim().toLowerCase();
    if (name) {
      uniqueNames.add(name);
    }
  }

  // Second pass: match single-word mentions
  // Replace already-matched two-word mentions with placeholders to avoid re-matching
  let contentCopy = content;
  for (const name of uniqueNames) {
    // Replace matched two-word mentions with spaces to prevent re-matching
    const originalForm = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    contentCopy = contentCopy.replace(new RegExp(`@${originalForm}`, 'g'), ' '.repeat(originalForm.length + 1));
  }

  // Now match single-word mentions
  const singleWordRegex = /@(\w+)/g;
  while ((match = singleWordRegex.exec(contentCopy)) !== null) {
    const name = match[1]?.trim().toLowerCase();
    if (name) {
      uniqueNames.add(name);
    }
  }

  return Array.from(uniqueNames);
}
