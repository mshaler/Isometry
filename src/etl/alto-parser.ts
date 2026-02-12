/**
 * Alto-Index Parser
 *
 * Universal parser for alto.index markdown files with YAML frontmatter.
 * Handles all data types: notes, contacts, messages, calendar, reminders,
 * safari-history, safari-bookmarks, and voice-memos.
 *
 * Adapted from CardBoard-v3's alto-parser.ts with extensions for
 * diverse data types and LATCH field mapping.
 *
 * Phase 64-02: Refactored to use gray-matter via parsers/frontmatter module.
 */
import { parseFrontmatter as parseYamlFrontmatter, type ParsedFrontmatter } from './parsers/frontmatter';

// Re-export parseFrontmatter for backwards compatibility
export { parseYamlFrontmatter as parseFrontmatter };
export type { ParsedFrontmatter };

// ============================================================================
// Types
// ============================================================================

export interface AltoFrontmatter {
  // Common fields
  title: string;

  // Identifiers (various formats by type)
  id?: number;
  contact_id?: string;
  chat_id?: number;
  event_id?: string;
  reminder_id?: string;

  // Timestamps
  created?: string;
  modified?: string;
  last_modified?: string;
  created_date?: string;
  modified_date?: string;
  start_date?: string;
  end_date?: string;
  first_message?: string;
  last_message?: string;
  due_date?: string;

  // Location
  location?: string;

  // Category/Organization
  folder?: string;
  calendar?: string;
  organization?: string;
  list?: string;

  // Notes-specific
  attachments?: AltoAttachment[];
  links?: AltoLink[];
  source?: string;

  // Contact-specific
  link?: string;

  // Message-specific
  participants?: string[];
  is_group?: boolean;
  message_count?: number;

  // Calendar-specific
  all_day?: boolean;
  organizer?: string;
  attendees?: AltoAttendee[];
  status?: string;
  availability?: string;
  alarms?: AltoAlarm[];
  recurrence?: string[];
  url?: string;

  // Reminder-specific
  priority?: string;
  is_flagged?: boolean;
  has_alarm?: boolean;
}

export interface AltoAttachment {
  id: string;
  type: string;
  title?: string;
  content: string;
}

export interface AltoLink {
  id: string;
  title: string;
}

export interface AltoAttendee {
  name: string;
  status: string;
  role: string;
}

export interface AltoAlarm {
  type: string;
  offset: number;
}

export interface ParsedAltoFile {
  frontmatter: AltoFrontmatter;
  content: string;
  tags: string[];
  dataType: AltoDataType;
  filePath?: string;
}

export type AltoDataType =
  | 'notes'
  | 'contacts'
  | 'messages'
  | 'calendar'
  | 'reminders'
  | 'safari-history'
  | 'safari-bookmarks'
  | 'voice-memos';

// ============================================================================
// Tag Extraction
// ============================================================================

/**
 * Extract hashtags from attachments (notes-specific)
 */
export function extractTags(attachments: AltoAttachment[]): string[] {
  const tags: string[] = [];

  for (const attachment of attachments) {
    if (attachment.type === 'com.apple.notes.inlinetextattachment.hashtag') {
      const match = attachment.content.match(/#([^<]+)/);
      if (match) {
        tags.push(match[1]!);
      }
    }
  }

  return tags;
}

/**
 * Detect the data type from file path or frontmatter
 */
export function detectDataType(filePath: string, frontmatter: AltoFrontmatter): AltoDataType {
  if (filePath.includes('/notes/')) return 'notes';
  if (filePath.includes('/contacts/')) return 'contacts';
  if (filePath.includes('/messages/')) return 'messages';
  if (filePath.includes('/calendar/')) return 'calendar';
  if (filePath.includes('/reminders/')) return 'reminders';
  if (filePath.includes('/safari-history/')) return 'safari-history';
  if (filePath.includes('/safari-bookmarks/')) return 'safari-bookmarks';
  if (filePath.includes('/voice-memos/')) return 'voice-memos';

  // Fallback: detect from frontmatter keys
  if (frontmatter.contact_id) return 'contacts';
  if (frontmatter.chat_id !== undefined) return 'messages';
  if (frontmatter.event_id) return 'calendar';
  if (frontmatter.reminder_id) return 'reminders';
  if (frontmatter.folder) return 'notes';

  return 'notes'; // Default
}

/**
 * Generate a unique source ID based on data type
 */
export function generateSourceId(dataType: AltoDataType, frontmatter: AltoFrontmatter): string {
  const prefix = `alto-${dataType}`;

  switch (dataType) {
    case 'notes':
      return `${prefix}-${frontmatter.id}`;
    case 'contacts':
      return `${prefix}-${frontmatter.contact_id}`;
    case 'messages':
      return `${prefix}-${frontmatter.chat_id}`;
    case 'calendar':
      return `${prefix}-${frontmatter.event_id}`;
    case 'reminders':
      return `${prefix}-${frontmatter.reminder_id}`;
    case 'safari-history':
    case 'safari-bookmarks':
    case 'voice-memos':
      // Use title hash for these
      return `${prefix}-${hashString(frontmatter.title)}`;
    default:
      return `${prefix}-${Date.now()}`;
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Parse a single alto-index markdown file content.
 * Uses gray-matter via parsers/frontmatter for full YAML 1.2 spec support.
 */
export function parseAltoFile(content: string, filePath: string = ''): ParsedAltoFile | null {
  const parsed = parseYamlFrontmatter(content);
  if (!parsed) return null;

  const { frontmatter: rawFrontmatter, body } = parsed;

  const frontmatter = rawFrontmatter as unknown as AltoFrontmatter;
  const dataType = detectDataType(filePath, frontmatter);
  const tags = extractTags(frontmatter.attachments || []);

  return {
    frontmatter,
    content: body,
    tags,
    dataType,
    filePath,
  };
}
