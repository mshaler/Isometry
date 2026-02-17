/**
 * TipTap Test Fixtures
 *
 * Phase 112-03: Sample content and mock data for TipTap extension tests
 */

/**
 * Sample markdown content for testing
 */
export const sampleMarkdown = `# Test Document

This is a paragraph with **bold** and *italic* text.

## Section One

- Item 1
- Item 2
- Item 3

## Section Two

Here's a [link](https://example.com) and some \`inline code\`.

\`\`\`javascript
const hello = 'world';
console.log(hello);
\`\`\`

> This is a blockquote
`;

/**
 * Sample ProseMirror JSON document
 */
export const sampleProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Test Document' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This is a paragraph with ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        { type: 'text', text: ' and ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
        { type: 'text', text: ' text.' },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Section One' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Item 1' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Item 2' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Item 3' }],
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Mock card data for WikiLink suggestion tests
 */
export interface MockCard {
  id: string;
  name: string;
  folder?: string;
  tags?: string[];
  created_at?: string;
}

export const testCards: MockCard[] = [
  {
    id: 'card-001',
    name: 'Project Overview',
    folder: 'Projects',
    tags: ['project', 'overview'],
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'card-002',
    name: 'Meeting Notes - January',
    folder: 'Meetings',
    tags: ['meeting', 'notes'],
    created_at: '2026-01-20T14:30:00Z',
  },
  {
    id: 'card-003',
    name: 'Architecture Decision Records',
    folder: 'Architecture',
    tags: ['architecture', 'decision'],
    created_at: '2026-02-01T09:00:00Z',
  },
  {
    id: 'card-004',
    name: 'Daily Standup Template',
    folder: 'Templates',
    tags: ['template', 'standup'],
    created_at: '2026-02-05T08:00:00Z',
  },
  {
    id: 'card-005',
    name: 'Bug Tracker',
    folder: 'Projects',
    tags: ['bugs', 'tracker'],
    created_at: '2026-02-10T11:00:00Z',
  },
];

/**
 * Mock function to query cards by name (for WikiLink tests)
 */
export function queryCardsByName(query: string): MockCard[] {
  if (!query) return testCards.slice(0, 5);
  const lowerQuery = query.toLowerCase();
  return testCards.filter(
    (card) =>
      card.name.toLowerCase().includes(lowerQuery) ||
      card.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Sample tags for Hashtag autocomplete tests
 */
export const testTags: string[] = [
  'project',
  'meeting',
  'todo',
  'idea',
  'reference',
  'important',
  'urgent',
  'review',
  'done',
  'blocked',
  'architecture',
  'frontend',
  'backend',
  'database',
  'testing',
];

/**
 * Mock function to query tags (for Hashtag tests)
 */
export function queryTags(query: string): string[] {
  if (!query) return testTags.slice(0, 5);
  const lowerQuery = query.toLowerCase();
  return testTags.filter((tag) => tag.toLowerCase().includes(lowerQuery));
}

/**
 * Sample inline properties for InlineProperty tests
 */
export interface MockInlineProperty {
  key: string;
  value: string;
}

export const testInlineProperties: MockInlineProperty[] = [
  { key: 'status', value: 'active' },
  { key: 'priority', value: 'high' },
  { key: 'due', value: '2026-02-28' },
  { key: 'assignee', value: 'alice' },
  { key: 'estimate', value: '3h' },
];

/**
 * Callout types for CalloutExtension tests
 */
export const calloutTypes = ['info', 'warning', 'success', 'error'] as const;

/**
 * Sample callout content for testing
 */
export const sampleCallouts = [
  { type: 'info', content: 'This is an informational callout.' },
  { type: 'warning', content: 'This is a warning callout.' },
  { type: 'success', content: 'This is a success callout.' },
  { type: 'error', content: 'This is an error callout.' },
];

/**
 * Sample toggle content for ToggleExtension tests
 */
export const sampleToggles = [
  { title: 'FAQ Section', content: 'Frequently asked questions go here.' },
  { title: 'Implementation Details', content: 'Technical details hidden by default.' },
  { title: 'Code Examples', content: 'Collapsible code samples.' },
];

/**
 * Sample bookmark URLs for BookmarkExtension tests
 */
export const sampleBookmarks = [
  {
    url: 'https://github.com/ueberdosis/tiptap',
    title: 'TipTap Editor',
    description: 'The headless editor framework for web artisans.',
  },
  {
    url: 'https://prosemirror.net',
    title: 'ProseMirror',
    description: 'A toolkit for building rich-text editors on the web.',
  },
  {
    url: 'https://d3js.org',
    title: 'D3.js',
    description: 'Data-Driven Documents.',
  },
];

/**
 * Slash command categories for SlashCommands tests
 */
export const expectedSlashCommandCategories = ['isometry', 'template', 'format'] as const;

/**
 * Expected slash command IDs (subset for validation)
 */
export const expectedSlashCommandIds = [
  'save-card',
  'send-to-shell',
  'pafv-query',
  'latch-filter',
  'graph-query',
  'template',
  'meeting-template',
  'code-snippet',
  'task-list',
  'supergrid',
  'network',
  'timeline',
  'h1',
  'h2',
  'h3',
  'callout',
  'toggle',
  'bookmark',
];
