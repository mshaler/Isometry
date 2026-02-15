# Phase 96: Block Types & Slash Commands - Research

**Researched:** 2026-02-14
**Domain:** TipTap rich text editor extensions, custom block nodes, React node views
**Confidence:** HIGH

## Summary

Phase 96 builds rich block types (callout, toggle, divider, bookmark) and expands slash commands on top of the existing TipTap editor infrastructure completed in Phase 95. The phase extends the `/template` pattern established in Phase 95 to include formatting blocks, media insertion, and interactive components.

**Key finding:** TipTap provides comprehensive APIs for custom node extensions with React integration. The codebase already has a working slash command system (`slash-commands.ts`) that can be extended with new commands. Four block types require custom node extensions with varying complexity: divider (trivial - built-in), toggle (simple - Pro extension available), callout (moderate - custom node + React view), and bookmark (complex - custom node + URL metadata fetching).

**Primary recommendation:** Extend the existing `SLASH_COMMANDS` array incrementally. Use built-in `HorizontalRule` for divider, TipTap Pro's `Details` extension for toggle, build a custom `Callout` node with React view for styled blocks, and create a `Bookmark` node with server-side URL unfurling. All styling must respect both NeXTSTEP (raised/sunken shadows) and Modern (glass) themes via CSS custom properties.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/core | ^2.x | Editor framework | Industry standard headless editor |
| @tiptap/react | ^2.x | React bindings | Official React integration |
| @tiptap/extension-horizontal-rule | ^2.x | Divider block | Built-in extension, zero config |
| @tiptap/extension-details | ^2.x (Pro) | Toggle/collapsible | Official Pro extension for details/summary |
| @tiptap/suggestion | ^2.x | Slash command engine | Already in use, powers template picker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unfurl.js | ^6.x | URL metadata extraction | Bookmark preview - fetches Open Graph/Twitter Cards |
| react-icons | ^5.x | Callout icons | Icon library already in project dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap Pro Details | Custom collapsible node | Pro subscription vs custom code - Pro wins for maintenance |
| unfurl.js | metascraper | unfurl.js has simpler API, metascraper has more fallbacks - unfurl sufficient |
| Custom callout node | BlockNote library | BlockNote is full editor replacement - overkill for one feature |

**Installation:**
```bash
# Already installed (Phase 45)
# @tiptap/core, @tiptap/react, @tiptap/suggestion

# New for Phase 96
npm install @tiptap/extension-horizontal-rule
npm install @tiptap/extension-details @tiptap/extension-details-summary @tiptap/extension-details-content
npm install unfurl.js
```

**Note:** TipTap Pro extensions (`Details`, `DetailsSummary`, `DetailsContent`) require a paid subscription. Verify license before implementation or build custom toggle node.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/notebook/editor/
│   ├── extensions/
│   │   ├── slash-commands.ts           # [EXISTING] Extend SLASH_COMMANDS array
│   │   ├── CalloutExtension.ts         # [NEW] Custom callout node
│   │   ├── BookmarkExtension.ts        # [NEW] Custom bookmark node
│   │   └── index.ts                    # [UPDATE] Export all extensions
│   ├── nodes/
│   │   ├── CalloutNode.tsx             # [NEW] React component for callout rendering
│   │   └── BookmarkNode.tsx            # [NEW] React component for bookmark card
│   └── CaptureComponent.tsx            # [UPDATE] Register new extensions
├── utils/editor/
│   ├── templates.ts                    # [EXISTING] Template CRUD - no changes
│   └── unfurl.ts                       # [NEW] URL metadata fetching service
└── types/
    └── editor.ts                       # [UPDATE] Add Callout/Bookmark types
```

### Pattern 1: Extending Slash Commands (Proven Pattern)
**What:** Add new items to `SLASH_COMMANDS` array in `slash-commands.ts`
**When to use:** Every new slash command (headings, blocks, media, references)
**Example:**
```typescript
// Source: /src/components/notebook/editor/extensions/slash-commands.ts (existing)
export const SLASH_COMMANDS: SlashCommand[] = [
  // ... existing commands
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    category: 'format',
    shortcut: 'h1',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlight important information',
    category: 'format',
    shortcut: 'callout',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
    },
  },
  // ... more commands
];
```

### Pattern 2: Custom Node with React View (Callout, Bookmark)
**What:** Create TipTap Node extension + React component for rendering
**When to use:** Interactive blocks with custom UI (callout, bookmark, toggle)
**Example:**
```typescript
// Source: TipTap official docs - https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutNode } from '../nodes/CalloutNode';

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',  // Allows nested content

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => ({ 'data-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-callout': '' }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNode);
  },

  addCommands() {
    return {
      setCallout: (attributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
          content: [{ type: 'paragraph' }],
        });
      },
    };
  },
});
```

```tsx
// CalloutNode.tsx - React component
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { NodeViewProps } from '@tiptap/core';

export function CalloutNode({ node, updateAttributes }: NodeViewProps) {
  const { type } = node.attrs;

  const icons = {
    info: '💡',
    warning: '⚠️',
    tip: '✨',
    error: '❌',
  };

  return (
    <NodeViewWrapper className={`callout callout--${type}`}>
      <div className="callout__header">
        <span className="callout__icon">{icons[type as keyof typeof icons]}</span>
        <select
          value={type}
          onChange={(e) => updateAttributes({ type: e.target.value })}
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="tip">Tip</option>
          <option value="error">Error</option>
        </select>
      </div>
      <NodeViewContent className="callout__content" />
    </NodeViewWrapper>
  );
}
```

### Pattern 3: Built-in Extension Usage (HorizontalRule)
**What:** Use TipTap's built-in extensions with minimal configuration
**When to use:** Standard HTML elements (hr, blockquote, code block)
**Example:**
```typescript
// Source: TipTap docs - https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';

// In CaptureComponent.tsx extensions array:
const editor = useEditor({
  extensions: [
    // ... other extensions
    HorizontalRule,
  ],
});

// Slash command:
{
  id: 'divider',
  label: 'Divider',
  description: 'Horizontal line separator',
  category: 'format',
  shortcut: 'divider',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHorizontalRule().run();
  },
}
```

### Pattern 4: Async Data Fetching in Node View (Bookmark)
**What:** Fetch external data when node is created, display loading state
**When to use:** URL previews, embedded content requiring external API calls
**Example:**
```tsx
// BookmarkNode.tsx
import { useState, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { unfurl } from 'unfurl.js';

export function BookmarkNode({ node }: NodeViewProps) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const result = await unfurl(node.attrs.url);
        setMetadata(result);
      } catch (error) {
        console.error('Failed to fetch URL metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [node.attrs.url]);

  if (loading) {
    return <NodeViewWrapper><div>Loading preview...</div></NodeViewWrapper>;
  }

  return (
    <NodeViewWrapper className="bookmark">
      {metadata?.open_graph?.images?.[0] && (
        <img src={metadata.open_graph.images[0].url} alt="" />
      )}
      <div>
        <h4>{metadata?.title || node.attrs.url}</h4>
        <p>{metadata?.description}</p>
        <a href={node.attrs.url}>{node.attrs.url}</a>
      </div>
    </NodeViewWrapper>
  );
}
```

### Pattern 5: Theme-Aware Styling (NeXTSTEP + Modern)
**What:** Use CSS custom properties from `index.css` for theme compatibility
**When to use:** ALL new block components
**Example:**
```css
/* In component-specific CSS or index.css */
.callout {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  padding: 1rem;
  margin: 1rem 0;
}

.callout--info {
  border-left: 4px solid hsl(var(--primary));
}

.callout--warning {
  border-left: 4px solid hsl(var(--destructive));
}

/* NeXTSTEP theme uses raised/sunken shadows */
:root {
  --shadow-raised: inset -1px -1px 0 rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.5);
  --shadow-sunken: inset 1px 1px 0 rgba(0,0,0,0.3), inset -1px -1px 0 rgba(255,255,255,0.5);
}

.callout {
  box-shadow: var(--shadow-raised);  /* Respect NeXTSTEP aesthetic */
}
```

### Anti-Patterns to Avoid
- **Hardcoded colors:** Don't use `#0055ff` - use `hsl(var(--primary))` to respect themes
- **Inline styles in React:** Use className with CSS custom properties instead
- **Synchronous unfurl calls:** Always wrap URL fetching in async/await with loading states
- **Missing NodeViewWrapper:** React node views MUST wrap content in `<NodeViewWrapper>`
- **Forgetting NodeViewContent:** Editable blocks need `<NodeViewContent>` for user input area

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL metadata extraction | Custom Open Graph parser | unfurl.js | Handles Open Graph, Twitter Cards, oEmbed, HTML fallbacks - 100+ edge cases |
| Collapsible blocks | Custom toggle logic | @tiptap/extension-details (Pro) | Manages open/closed state, keyboard nav, accessibility, persistence |
| Horizontal rule | Custom divider node | @tiptap/extension-horizontal-rule | Built-in, zero config, Markdown support (---) |
| Slash menu UI | Custom popover | @tiptap/suggestion (existing) | Already integrated, handles positioning, keyboard nav, filtering |

**Key insight:** TipTap's extension ecosystem handles the hard parts (contentEditable quirks, selection management, undo/redo, Markdown serialization). Focus on business logic (callout types, bookmark styling) and let TipTap handle the editor plumbing.

## Common Pitfalls

### Pitfall 1: Forgetting to Delete Range Before Inserting
**What goes wrong:** Slash command text `/callout` remains in document after command executes
**Why it happens:** Slash commands trigger when user types, but text isn't auto-deleted
**How to avoid:** ALWAYS call `editor.chain().focus().deleteRange(range)` before inserting content
**Warning signs:** User sees "/callout" text followed by the callout block
```typescript
// BAD
action: ({ editor, range }) => {
  editor.commands.setCallout({ type: 'info' }); // Range not deleted!
}

// GOOD
action: ({ editor, range }) => {
  editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
}
```

### Pitfall 2: Missing NodeViewWrapper in React Components
**What goes wrong:** React node view doesn't render, console shows ProseMirror errors
**Why it happens:** TipTap requires wrapper for proper DOM integration
**How to avoid:** Every React node component MUST return content wrapped in `<NodeViewWrapper>`
**Warning signs:** "Invalid node view" errors, node appears as empty div
```tsx
// BAD
export function CalloutNode() {
  return <div className="callout">Content</div>; // Missing wrapper!
}

// GOOD
export function CalloutNode() {
  return (
    <NodeViewWrapper>
      <div className="callout">Content</div>
    </NodeViewWrapper>
  );
}
```

### Pitfall 3: Blocking the UI with Synchronous Unfurl
**What goes wrong:** Editor freezes when inserting bookmark while fetching URL metadata
**Why it happens:** Network requests are slow, blocking main thread
**How to avoid:** Always use async/await, show loading state, handle errors gracefully
**Warning signs:** Editor becomes unresponsive for 2-5 seconds after `/bookmark` command
```tsx
// BAD - Blocks UI
export function BookmarkNode({ node }: NodeViewProps) {
  const metadata = fetchSync(node.attrs.url); // Doesn't exist in JS, but illustrates point
  return <div>{metadata.title}</div>;
}

// GOOD - Async with loading state
export function BookmarkNode({ node }: NodeViewProps) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unfurl(node.attrs.url)
      .then(setMetadata)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [node.attrs.url]);

  if (loading) return <div>Loading...</div>;
  return <div>{metadata?.title || 'Untitled'}</div>;
}
```

### Pitfall 4: Hardcoding Theme Colors
**What goes wrong:** Callout blocks look correct in NeXTSTEP theme but broken in Modern theme
**Why it happens:** CSS uses hardcoded hex colors instead of custom properties
**How to avoid:** ALWAYS use `hsl(var(--custom-property))` for colors, borders, shadows
**Warning signs:** User switches theme, blocks don't update colors
```css
/* BAD */
.callout--info {
  background: #ebebeb;
  border: 1px solid #0055ff;
}

/* GOOD */
.callout--info {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--primary));
}
```

### Pitfall 5: Not Handling Empty Bookmark URL
**What goes wrong:** Bookmark node renders with broken metadata when URL is invalid/empty
**Why it happens:** User might insert bookmark before pasting URL, or URL fetch fails
**How to avoid:** Validate URL before fetching, show helpful placeholder, allow editing
**Warning signs:** Bookmark shows "undefined" or blank card
```tsx
// BAD - Crashes on empty URL
useEffect(() => {
  unfurl(node.attrs.url).then(setMetadata); // Throws if url is empty
}, [node.attrs.url]);

// GOOD - Validates first
useEffect(() => {
  if (!node.attrs.url) {
    setMetadata({ title: 'Paste a URL to load preview' });
    return;
  }

  try {
    new URL(node.attrs.url); // Validates URL format
    unfurl(node.attrs.url).then(setMetadata).catch(() => {
      setMetadata({ title: 'Failed to load preview', url: node.attrs.url });
    });
  } catch {
    setMetadata({ title: 'Invalid URL' });
  }
}, [node.attrs.url]);
```

## Code Examples

Verified patterns from official sources:

### Heading Slash Commands (SLASH-01)
```typescript
// Pattern: Use built-in setHeading command with level attribute
// Source: TipTap Heading extension docs - https://tiptap.dev/docs/editor/extensions/nodes/heading
{
  id: 'h1',
  label: 'Heading 1',
  description: 'Large section heading',
  category: 'format',
  shortcut: 'h1',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
  },
},
{
  id: 'h2',
  label: 'Heading 2',
  description: 'Medium section heading',
  category: 'format',
  shortcut: 'h2',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
  },
},
// Repeat for h3-h6 with levels 3-6
```

### Callout Block Extension (SLASH-02, BLOCK-01)
```typescript
// CalloutExtension.ts
// Source: TipTap custom node docs - https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutNode } from '../nodes/CalloutNode';

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-type') || 'info',
        renderHTML: (attributes) => ({ 'data-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-callout': '' }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNode);
  },

  addCommands() {
    return {
      setCallout: (attributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
          content: [{ type: 'paragraph' }],
        });
      },
    };
  },
});
```

```tsx
// CalloutNode.tsx
// Source: TipTap React node views - https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { NodeViewProps } from '@tiptap/core';

const CALLOUT_TYPES = {
  info: { icon: '💡', label: 'Info' },
  warning: { icon: '⚠️', label: 'Warning' },
  tip: { icon: '✨', label: 'Tip' },
  error: { icon: '❌', label: 'Error' },
};

export function CalloutNode({ node, updateAttributes }: NodeViewProps) {
  const type = node.attrs.type as keyof typeof CALLOUT_TYPES;
  const config = CALLOUT_TYPES[type] || CALLOUT_TYPES.info;

  return (
    <NodeViewWrapper className={`callout callout--${type}`}>
      <div className="callout__header">
        <span className="callout__icon">{config.icon}</span>
        <select
          className="callout__type-selector"
          value={type}
          onChange={(e) => updateAttributes({ type: e.target.value })}
        >
          {Object.entries(CALLOUT_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <NodeViewContent className="callout__content" />
    </NodeViewWrapper>
  );
}
```

```css
/* Callout styling - respects theme variables */
.callout {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  box-shadow: var(--shadow-raised); /* NeXTSTEP theme compatibility */
}

.callout__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.callout--info { border-left: 4px solid hsl(var(--primary)); }
.callout--warning { border-left: 4px solid hsl(var(--destructive)); }
.callout--tip { border-left: 4px solid hsl(var(--accent)); }
.callout--error { border-left: 4px solid hsl(var(--destructive)); }
```

### Toggle/Collapsible Block (SLASH-03, BLOCK-02)
```typescript
// Using TipTap Pro Details extension
// Source: TipTap Details docs - https://tiptap.dev/docs/editor/extensions/nodes/details
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';

// In editor extensions:
const editor = useEditor({
  extensions: [
    Details.configure({
      persist: false,          // Don't persist open/closed state in document
      openClassName: 'is-open', // CSS class when expanded
    }),
    DetailsSummary,
    DetailsContent,
  ],
});

// Slash command:
{
  id: 'toggle',
  label: 'Toggle',
  description: 'Collapsible section',
  category: 'format',
  shortcut: 'toggle',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setDetails().run();
  },
}
```

### Divider (SLASH-04, BLOCK-03)
```typescript
// Using built-in HorizontalRule extension
// Source: TipTap HorizontalRule docs - https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';

// Slash command:
{
  id: 'divider',
  label: 'Divider',
  description: 'Horizontal line separator',
  category: 'format',
  shortcut: 'divider',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHorizontalRule().run();
  },
}
```

### Bookmark URL Preview (SLASH-08, BLOCK-04)
```typescript
// BookmarkExtension.ts
// Pattern: Async node with external data fetching
// Source: Inspired by GitHub discussion - https://github.com/ueberdosis/tiptap/discussions/3552
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BookmarkNode } from '../nodes/BookmarkNode';

export const BookmarkExtension = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true, // Not editable inline

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-bookmark': '' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNode);
  },

  addCommands() {
    return {
      setBookmark: (url: string) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { url },
        });
      },
    };
  },
});
```

```tsx
// BookmarkNode.tsx
import { useState, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { NodeViewProps } from '@tiptap/core';
import { unfurl } from 'unfurl.js';

interface UnfurlMetadata {
  title?: string;
  description?: string;
  favicon?: string;
  open_graph?: {
    images?: Array<{ url: string }>;
  };
}

export function BookmarkNode({ node, updateAttributes }: NodeViewProps) {
  const [metadata, setMetadata] = useState<UnfurlMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isEditing, setIsEditing] = useState(!node.attrs.url);

  useEffect(() => {
    if (!node.attrs.url || isEditing) {
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        const result = await unfurl(node.attrs.url);
        setMetadata(result);
        setError(false);
      } catch (err) {
        console.error('Failed to unfurl URL:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [node.attrs.url, isEditing]);

  if (isEditing) {
    return (
      <NodeViewWrapper className="bookmark bookmark--editing">
        <input
          type="url"
          placeholder="Paste URL..."
          defaultValue={node.attrs.url}
          onBlur={(e) => {
            updateAttributes({ url: e.target.value });
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateAttributes({ url: e.currentTarget.value });
              setIsEditing(false);
            }
          }}
          autoFocus
        />
      </NodeViewWrapper>
    );
  }

  if (loading) {
    return (
      <NodeViewWrapper className="bookmark bookmark--loading">
        <div>Loading preview...</div>
      </NodeViewWrapper>
    );
  }

  if (error || !metadata) {
    return (
      <NodeViewWrapper className="bookmark bookmark--error">
        <div>Failed to load preview for: {node.attrs.url}</div>
        <button onClick={() => setIsEditing(true)}>Edit URL</button>
      </NodeViewWrapper>
    );
  }

  const imageUrl = metadata.open_graph?.images?.[0]?.url;

  return (
    <NodeViewWrapper className="bookmark">
      <a href={node.attrs.url} target="_blank" rel="noopener noreferrer">
        {imageUrl && <img src={imageUrl} alt="" className="bookmark__image" />}
        <div className="bookmark__content">
          {metadata.favicon && <img src={metadata.favicon} alt="" className="bookmark__favicon" />}
          <h4 className="bookmark__title">{metadata.title || node.attrs.url}</h4>
          {metadata.description && <p className="bookmark__description">{metadata.description}</p>}
          <span className="bookmark__url">{node.attrs.url}</span>
        </div>
      </a>
    </NodeViewWrapper>
  );
}
```

```css
/* Bookmark styling */
.bookmark {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 1rem 0;
  box-shadow: var(--shadow-raised);
}

.bookmark a {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  text-decoration: none;
  color: inherit;
}

.bookmark__image {
  width: 120px;
  height: 120px;
  object-fit: cover;
  flex-shrink: 0;
}

.bookmark__content {
  flex: 1;
  min-width: 0; /* Prevent text overflow */
}

.bookmark__favicon {
  width: 16px;
  height: 16px;
  margin-right: 0.5rem;
  display: inline-block;
}

.bookmark__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  color: hsl(var(--foreground));
}

.bookmark__description {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin: 0 0 0.5rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bookmark__url {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.bookmark--loading,
.bookmark--error,
.bookmark--editing {
  padding: 1rem;
}
```

### Quote Block (SLASH-05)
```typescript
// Using built-in Blockquote extension
// Source: TipTap Blockquote docs - https://tiptap.dev/docs/editor/extensions/nodes/blockquote
import { Blockquote } from '@tiptap/extension-blockquote';

// Slash command:
{
  id: 'quote',
  label: 'Quote',
  description: 'Insert blockquote',
  category: 'format',
  shortcut: 'quote',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setBlockquote().run();
  },
}
```

### Image/File/Date/Mention Commands (SLASH-06 through SLASH-10)
```typescript
// These follow the same pattern - extend SLASH_COMMANDS array
// Image and File will need custom file picker integration
// Date will use browser date input
// Mention will query sql.js for card titles (similar to template picker)

{
  id: 'image',
  label: 'Image',
  description: 'Upload or embed image',
  category: 'format',
  shortcut: 'image',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    // Dispatch event to open file picker
    window.dispatchEvent(new CustomEvent('isometry:insert-image'));
  },
},
{
  id: 'mention',
  label: 'Mention Card',
  description: 'Link to another card',
  category: 'format',
  shortcut: 'mention',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    // Open card picker modal (similar to template picker from Phase 95)
    window.dispatchEvent(new CustomEvent('isometry:open-card-picker', {
      detail: { editor, insertPosition: editor.state.selection.from }
    }));
  },
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual ProseMirror plugins | TipTap Node extensions | 2020+ | Declarative API, React integration, Markdown support |
| Custom popover libraries | @tiptap/suggestion | 2021+ | Built-in positioning, keyboard nav, filtering |
| DIY Open Graph parsers | unfurl.js / metascraper | 2019+ | Handles 100+ edge cases, oEmbed, Twitter Cards |
| Custom toggle state management | TipTap Pro Details extension | 2024+ | Accessibility, persistence, keyboard nav |

**Deprecated/outdated:**
- **ProseMirror direct usage:** TipTap wraps ProseMirror with better DX - use TipTap Node.create() instead
- **Synchronous URL fetching:** Modern browsers require async/await for network requests
- **Inline node state in attributes:** React node views handle ephemeral UI state (loading, error) in component state, not node attributes

## Open Questions

1. **TipTap Pro License**
   - What we know: Details/DetailsSummary/DetailsContent are Pro extensions
   - What's unclear: Whether project has Pro subscription or needs custom toggle implementation
   - Recommendation: Check with user before planning Phase 96. If no Pro license, build custom toggle node (1-2 hours extra work)

2. **URL Unfurling Backend Requirements**
   - What we know: unfurl.js is a Node.js library, won't run in browser
   - What's unclear: Whether to add backend endpoint or use browser-compatible alternative
   - Recommendation: Use `metascraper` with browser build OR add simple Express endpoint for unfurling. Verify CORS policies if using external service.

3. **Image Upload Storage**
   - What we know: /image and /file commands need file handling
   - What's unclear: Where to store uploaded files (base64 in DB? Local file system? CDN?)
   - Recommendation: Phase 96 focuses on block types. Image/file upload can be placeholder commands that show "Coming in Phase 98" message. Full implementation deferred.

4. **Slash Command Menu Positioning**
   - What we know: @tiptap/suggestion handles positioning but may need tuning for notebook layout
   - What's unclear: Whether current slash menu positioning works in three-canvas layout
   - Recommendation: Test early in implementation. Suggestion plugin has `placement` option if adjustments needed.

## Sources

### Primary (HIGH confidence)
- [TipTap Node API Documentation](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node) - Custom node creation
- [TipTap React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) - React integration patterns
- [TipTap HorizontalRule Extension](https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule) - Built-in divider
- [TipTap Details Extension](https://tiptap.dev/docs/editor/extensions/nodes/details) - Pro toggle/collapsible blocks
- [TipTap Admonition/Callout Guide](https://tiptap.dev/docs/editor/markdown/guides/create-a-admonition-block) - Callout block example

### Secondary (MEDIUM confidence)
- [TipTap Notion-like Template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor) - Notion-style editor reference
- [GitHub: Link Preview Discussion](https://github.com/ueberdosis/tiptap/discussions/3552) - Bookmark node implementation example
- [unfurl.js npm package](https://www.npmjs.com/package/unfurl.js) - URL metadata extraction library
- [TipTap GitHub Repository](https://github.com/ueberdosis/tiptap) - Source code and community discussions

### Tertiary (LOW confidence)
- BlockNote library - Alternative approach, not recommended for single-feature use
- Community TipTap extensions - Various GitHub repos, quality varies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official TipTap docs, proven patterns in codebase
- Architecture: HIGH - React node views documented, slash command pattern already working
- Pitfalls: MEDIUM - Based on TipTap docs and common React patterns, not project-specific testing

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - TipTap stable, minor version updates expected)

**Key risks:**
- TipTap Pro license verification (BLOCKER if not available - custom toggle needed)
- URL unfurling backend requirements (MEDIUM - alternative approaches available)
- Theme styling integration (LOW - CSS custom properties well-established)
