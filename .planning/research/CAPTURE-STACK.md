# Technology Stack: Capture Writing Surface Enhancement

**Project:** Isometry Capture Extensions
**Domain:** Rich text editing with Apple Notes fluency, Notion commands, Obsidian power features
**Researched:** 2026-02-13

## Executive Summary

This research identifies TipTap extensions needed to add Apple Notes keyboard shortcuts, Notion-style block types, and Obsidian power features to Isometry's existing Capture component. The current implementation already has TipTap 3.19.0 with StarterKit, Link, Placeholder, custom SlashCommands, and WikiLink extensions. This milestone adds fluency layers without replacing the existing foundation.

**Confidence:** MEDIUM-HIGH
- Official TipTap extensions: HIGH confidence (verified via WebFetch + npm)
- Community extensions: MEDIUM confidence (versions/maintenance vary)
- Custom implementation patterns: HIGH confidence (official docs current as of Feb 2026)

**Key Finding:** Most features require either official TipTap extensions (available) OR custom NodeView implementations (well-documented pattern). TipTap Pro extensions exist but are NOT needed for this milestone's feature set.

## Recommended Stack

### Core Extensions (Official TipTap, Open Source)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tiptap/extension-details` | 3.4.2 | Notion-style toggle/collapsible blocks | Official open source extension, active maintenance, enables `<details>` HTML tag |
| `@tiptap/extension-horizontal-rule` | 3.19.0 | Divider (`/divider` command) | Already in ecosystem (likely via StarterKit), explicit install for clarity |
| `@tiptap/extension-character-count` | 3.19.0 | Word count, character count for status bar | Provides `editor.storage.characterCount.words()` and `.characters()` |
| `@tiptap/extension-file-handler` | 3.19.0 | Detect file drops/pastes for `/file` and `/image` | Handles events, pairs with Image extension for display |

### Keyboard Shortcut Extensions

| Extension | Version | Purpose | Implementation |
|-----------|---------|---------|----------------|
| Custom keybindings | — | Apple Notes fluency (Cmd+B, Cmd+I, Cmd+Shift+L) | Use `addKeyboardShortcuts()` in custom extension to override defaults |

**Rationale:** TipTap's StarterKit already handles Cmd+B (bold) and Cmd+I (italic). Need to add Cmd+Shift+L for checklist toggle (Apple Notes standard). No new packages required, just configuration.

### Custom NodeView Extensions (Build in-house)

| Feature | Implementation | TipTap Pattern | Why Custom |
|---------|---------------|----------------|------------|
| `/callout` blocks | Custom Node + ReactNodeViewRenderer | Create `Callout` node with type/icon attributes, render with React component | No official TipTap callout extension; Notion-specific styling needed |
| `/columns` layout | Custom Node + ReactNodeViewRenderer OR `@tiptap-extend/columns` | Multi-column grid layout node | Community package exists but custom may be better for Isometry PAFV integration |
| `/bookmark` embeds | Custom Node + ReactNodeViewRenderer | Fetch URL metadata, render preview card | No official extension; requires link preview API integration |
| `/supergrid`, `/network`, `/timeline` embeds | Custom Node + ReactNodeViewRenderer | Embed Isometry view components in editor | Isometry-specific, MUST be custom |
| Obsidian inline properties | Custom Mark extension OR frontmatter parser | Parse `[key:: value]` syntax, render with data attributes | Obsidian-specific syntax, needs custom parser |

### Supporting Utilities

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `tippy.js` | 6.3.7 | Already installed for slash command popups | Reuse for callout type selector, property tooltips |
| `ReactNodeViewRenderer` | Part of `@tiptap/react` 3.19.0 | Render React components as nodes | Already available, use for custom embeds |
| `NodeViewWrapper`, `NodeViewContent` | Part of `@tiptap/react` 3.19.0 | React wrappers for custom node views | Required for all custom nodes with React |

## Community Extensions Considered (NOT Recommended)

| Package | Why Not |
|---------|---------|
| `@tiptap-extend/columns` | Unmaintained (2 years old), better to build custom with PAFV awareness |
| `@gocapsule/column-extension` | Community package, integration unclear, custom safer |
| `tiptap-extension-upload-image` | Redundant with FileHandler + Image combo, adds unnecessary dependency |
| `extension-hyperlink` (HMarzban) | Overlaps with existing Link extension + custom WikiLink, avoid duplication |

## Installation Commands

```bash
# Official TipTap extensions
npm install @tiptap/extension-details
npm install @tiptap/extension-character-count
npm install @tiptap/extension-file-handler

# Note: @tiptap/extension-horizontal-rule likely already installed via StarterKit
# Verify with: npm list @tiptap/extension-horizontal-rule
```

## Implementation Patterns

### 1. Apple Notes Keyboard Shortcuts

**File:** `src/components/notebook/editor/extensions/apple-notes-keys.ts`

```typescript
import { Extension } from '@tiptap/core';

export const AppleNotesKeys = Extension.create({
  name: 'appleNotesKeys',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => this.editor.commands.toggleTaskList(),
      // Cmd+B and Cmd+I already handled by StarterKit (Bold, Italic)
      // Add others as needed
    };
  },
});
```

**Confidence:** HIGH — TipTap's `addKeyboardShortcuts()` is well-documented, official pattern.

### 2. Notion-Style Callout Blocks

**File:** `src/components/notebook/editor/extensions/callout-node.ts`

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutComponent } from './CalloutComponent';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: { default: 'info' }, // info, warning, error, success
      icon: { default: 'ℹ️' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'callout' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },
});
```

**File:** `src/components/notebook/editor/extensions/CalloutComponent.tsx`

```tsx
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';

export const CalloutComponent = ({ node, updateAttributes }) => {
  return (
    <NodeViewWrapper className="callout" data-type={node.attrs.type}>
      <div className="callout-icon">{node.attrs.icon}</div>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  );
};
```

**Confidence:** HIGH — Official TipTap pattern for custom nodes with React components.

### 3. Toggle/Collapsible Blocks (Notion-style)

**File:** Use official `@tiptap/extension-details` directly.

```typescript
import { Details } from '@tiptap/extension-details';
import { DetailsContent } from '@tiptap/extension-details-content';
import { DetailsSummary } from '@tiptap/extension-details-summary';

// In editor setup:
extensions: [
  Details,
  DetailsContent,
  DetailsSummary,
  // ... other extensions
]
```

**Slash command:**
```typescript
{
  id: 'toggle',
  label: 'Toggle Block',
  description: 'Collapsible toggle list (like Notion)',
  category: 'format',
  shortcut: 'toggle',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setDetails().run();
  },
}
```

**Confidence:** HIGH — Official extension, npm package 3.4.2 (published Feb 13, 2026).

### 4. Isometry View Embeds (SuperGrid, Network, Timeline)

**File:** `src/components/notebook/editor/extensions/isometry-embed-node.ts`

```typescript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { IsometryEmbedComponent } from './IsometryEmbedComponent';

export const IsometryEmbed = Node.create({
  name: 'isometryEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      viewType: { default: 'supergrid' }, // supergrid, network, timeline
      filters: { default: null }, // LATCH filter JSON
      pafv: { default: null }, // PAFV projection config
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="isometry-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'isometry-embed' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(IsometryEmbedComponent);
  },
});
```

**File:** `src/components/notebook/editor/extensions/IsometryEmbedComponent.tsx`

```tsx
import { NodeViewWrapper } from '@tiptap/react';
import { SuperGridRenderer } from '@/d3/SuperGridRenderer';
import { NetworkGraph } from '@/d3/NetworkGraph';
import { Timeline } from '@/d3/Timeline';

export const IsometryEmbedComponent = ({ node }) => {
  const { viewType, filters, pafv } = node.attrs;

  const ViewComponent = {
    supergrid: SuperGridRenderer,
    network: NetworkGraph,
    timeline: Timeline,
  }[viewType];

  return (
    <NodeViewWrapper className="isometry-embed">
      <div className="embed-header">
        <span>{viewType.toUpperCase()} View</span>
      </div>
      <div className="embed-container">
        <ViewComponent filters={filters} pafv={pafv} />
      </div>
    </NodeViewWrapper>
  );
};
```

**Confidence:** HIGH — Isometry-specific, follows official TipTap NodeView pattern, integrates existing D3 renderers.

### 5. Obsidian Inline Properties

**Strategy:** Parse `[key:: value]` syntax with custom Mark extension OR use frontmatter parser.

**File:** `src/components/notebook/editor/extensions/inline-properties.ts`

```typescript
import { Mark, mergeAttributes } from '@tiptap/core';

export const InlineProperty = Mark.create({
  name: 'inlineProperty',

  addAttributes() {
    return {
      key: { default: null },
      value: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-property]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-inline-property': true }, HTMLAttributes),
      `${HTMLAttributes.key}:: ${HTMLAttributes.value}`,
    ];
  },
});
```

**Alternative:** Use input rules to detect `[key:: value]` patterns and convert to marks on-the-fly.

**Confidence:** MEDIUM — Pattern is documented, but Obsidian syntax specifics may need iteration.

### 6. Backlinks Panel (Obsidian-style)

**Strategy:** NOT an extension, but a separate React component that queries sql.js for edges.

**File:** `src/components/notebook/BacklinksPanel.tsx`

```tsx
import { useSQLite } from '@/db/SQLiteProvider';
import { useEffect, useState } from 'react';

export const BacklinksPanel = ({ cardId }: { cardId: string }) => {
  const { exec } = useSQLite();
  const [backlinks, setBacklinks] = useState([]);

  useEffect(() => {
    const results = exec(`
      SELECT n.id, n.name, e.edge_type
      FROM edges e
      JOIN nodes n ON e.source_id = n.id
      WHERE e.target_id = ? AND e.edge_type = 'LINK'
    `, [cardId]);

    setBacklinks(results[0]?.values || []);
  }, [cardId, exec]);

  return (
    <div className="backlinks-panel">
      <h3>Backlinks ({backlinks.length})</h3>
      <ul>
        {backlinks.map(([id, name]) => (
          <li key={id}>
            <a href={`#card-${id}`}>{name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**Confidence:** HIGH — Not a TipTap extension, leverages existing WikiLink edges in sql.js.

### 7. Templates System (Obsidian/Notion-style)

**Strategy:** Extend existing SlashCommands registry with template commands.

**File:** `src/components/notebook/editor/extensions/template-commands.ts`

```typescript
// Add to SLASH_COMMANDS array:
{
  id: 'template-daily-note',
  label: 'Daily Note',
  description: 'Insert daily note template',
  category: 'template',
  shortcut: 'daily',
  action: ({ editor, range }) => {
    const today = new Date().toLocaleDateString();
    editor.chain().focus().deleteRange(range).insertContent(
      `# Daily Note: ${today}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n\n`
    ).run();
  },
},
{
  id: 'template-project',
  label: 'Project Template',
  description: 'Insert project planning template',
  category: 'template',
  shortcut: 'project',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).insertContent(
      `# Project: [Name]\n\n## Objective\n\n## Key Results\n- \n\n## Milestones\n- [ ] \n\n## Resources\n\n`
    ).run();
  },
}
```

**Confidence:** HIGH — Uses existing SlashCommands infrastructure, just adds more templates.

## Integration with Existing Extensions

### Do NOT Replace
- **StarterKit:** Keep all existing functionality (bold, italic, headings, lists, code, etc.)
- **Link extension:** Keep for basic link handling
- **Placeholder extension:** Keep for empty state prompts
- **SlashCommands extension:** EXTEND with new commands, don't replace
- **WikiLink extension:** Keep for `[[backlink]]` syntax, pairs with Backlinks Panel

### Add Alongside
- **Details extension:** Works with StarterKit, no conflicts
- **CharacterCount extension:** Passive extension, no conflicts
- **FileHandler extension:** Works with Image extension from StarterKit
- **Custom nodes (Callout, IsometryEmbed, etc.):** Independent, register as new nodes

### Extend
- **SlashCommands:** Add `/callout`, `/toggle`, `/divider`, `/columns`, `/image`, `/file`, `/bookmark`, `/supergrid`, `/network`, `/timeline`, template commands
- **Keyboard shortcuts:** Add Apple Notes keybindings via custom extension

## Avoiding Bloat

### What NOT to Add

| Feature | Why NOT |
|---------|---------|
| TipTap Pro extensions (Details is free now) | Not needed; toggle/callout achievable with open source |
| `tiptap-extensions` (v1 package) | Legacy package for TipTap v1, not compatible |
| `@tiptap/extensions` (meta-package) | Too broad, install only needed extensions |
| Markdown rendering library (marked, remark) | TipTap's `@tiptap/markdown` already installed |
| Separate rich text editor (Draft.js, Slate) | TipTap is the editor, don't add competitors |
| Heavy UI frameworks for node views | Use React (already in stack), avoid Vue/Angular/Svelte |

### Performance Considerations
- **Lazy load custom node views:** Use React.lazy for IsometryEmbedComponent (SuperGrid renderer is heavy)
- **Debounce CharacterCount updates:** Avoid re-rendering status bar on every keystroke
- **Limit FileHandler file size:** Set max file size for `/image` and `/file` uploads (e.g., 10MB)
- **Virtualize backlinks panel:** If >100 backlinks, use react-virtual or tanstack-virtual (already in stack)

## Testing Strategy

### Unit Tests (Vitest)

**Test file:** `src/components/notebook/editor/extensions/__tests__/callout-node.test.ts`

```typescript
import { createEditor } from '@tiptap/core';
import { Callout } from '../callout-node';

describe('Callout Node', () => {
  it('should insert callout with default type', () => {
    const editor = createEditor({
      extensions: [Callout],
    });

    editor.commands.insertContent({
      type: 'callout',
      content: [{ type: 'paragraph', text: 'Test' }],
    });

    expect(editor.getJSON().content[0].type).toBe('callout');
    expect(editor.getJSON().content[0].attrs.type).toBe('info');
  });
});
```

### Integration Tests

**Test file:** `src/components/notebook/editor/__tests__/slash-commands.e2e.test.ts`

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TipTapEditor } from '../TipTapEditor';

describe('Slash Commands Integration', () => {
  it('should insert callout via /callout command', async () => {
    render(<TipTapEditor />);
    const editor = screen.getByRole('textbox');

    await userEvent.type(editor, '/callout');
    await userEvent.keyboard('{Enter}');

    // Verify callout node inserted
    expect(screen.getByRole('region', { name: /callout/i })).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

**Test file:** `tests/e2e/capture-editor.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('keyboard shortcuts match Apple Notes', async ({ page }) => {
  await page.goto('/notebook');

  // Focus editor
  await page.click('[role="textbox"]');

  // Test Cmd+B for bold
  await page.keyboard.type('bold text');
  await page.keyboard.press('Mod+a');
  await page.keyboard.press('Mod+b');

  // Verify bold mark applied
  await expect(page.locator('strong')).toHaveText('bold text');

  // Test Cmd+Shift+L for checklist
  await page.keyboard.press('Mod+Shift+l');
  await expect(page.locator('ul[data-type="taskList"]')).toBeVisible();
});
```

## Migration Path

### Phase 1: Core Extensions (Week 1)
1. Install official TipTap extensions (Details, CharacterCount, FileHandler)
2. Add Apple Notes keyboard shortcuts extension
3. Extend SlashCommands with `/toggle`, `/divider` commands
4. Test keyboard shortcuts match Apple Notes

### Phase 2: Custom Nodes (Week 2)
1. Build Callout node with ReactNodeViewRenderer
2. Build Columns node OR evaluate `@tiptap-extend/columns`
3. Build Bookmark node with URL preview
4. Add `/callout`, `/columns`, `/bookmark` slash commands
5. Test custom nodes in isolation

### Phase 3: Isometry Integration (Week 3)
1. Build IsometryEmbed node (SuperGrid, Network, Timeline)
2. Add `/supergrid`, `/network`, `/timeline` slash commands
3. Wire LATCH filters and PAFV projection to embed nodes
4. Test embed nodes render D3 visualizations correctly

### Phase 4: Obsidian Features (Week 4)
1. Build InlineProperty mark extension OR frontmatter parser
2. Build BacklinksPanel component (queries sql.js edges)
3. Add template slash commands (daily note, project, etc.)
4. Test inline properties and backlinks work with WikiLink extension

### Phase 5: Polish & Performance (Week 5)
1. Lazy load heavy node views (IsometryEmbedComponent)
2. Optimize CharacterCount updates (debounce)
3. Add file size limits to FileHandler
4. Virtualize backlinks panel if needed
5. Full E2E test suite

## Sources & Confidence Levels

| Finding | Source | Confidence |
|---------|--------|------------|
| Details extension is open source | [TipTap Details Docs](https://tiptap.dev/docs/editor/extensions/nodes/details) + [npm package](https://www.npmjs.com/package/@tiptap/extension-details) | HIGH |
| HorizontalRule extension usage | [TipTap HorizontalRule Docs](https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule) | HIGH |
| FileHandler + Image pattern | [TipTap FileHandler Docs](https://tiptap.dev/docs/editor/extensions/functionality/filehandler) | HIGH |
| ReactNodeViewRenderer pattern | [TipTap React NodeViews Docs](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) | HIGH |
| CharacterCount word count | [TipTap CharacterCount Docs](https://tiptap.dev/docs/editor/extensions/functionality/character-count) | HIGH |
| Apple Notes Cmd+Shift+L for checklist | [Apple Support](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac) | HIGH |
| Obsidian inline property syntax | [Dataview Docs](https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/) | MEDIUM (Obsidian-specific, not TipTap) |
| Community columns extensions | [GitHub discussions](https://github.com/ueberdosis/tiptap/discussions/6317) | MEDIUM (unmaintained packages) |
| TipTap Pro pricing | [TipTap Pricing](https://tiptap.dev/pricing) | HIGH |

## Key Decisions & Rationale

### Decision 1: Use Official Details Extension (Not Custom)
**Rationale:** Details extension moved to open source in recent TipTap pricing update. No need for Pro subscription. Package 3.4.2 published Feb 13, 2026 (today). Active maintenance.

**Verification:** WebFetch confirmed open source status, npm confirmed latest version.

### Decision 2: Build Custom Callout Node (Not Community Package)
**Rationale:** No official callout extension. Community implementations (e.g., reactjs-tiptap-editor) are unmaintained or incompatible. Callout styling needs to match Isometry themes (NeXTSTEP, Modern). Custom gives full control.

**Verification:** WebSearch found no official callout extension, only third-party implementations with unclear licensing.

### Decision 3: Build Custom Isometry Embed Nodes (Obviously)
**Rationale:** SuperGrid, Network, Timeline are Isometry-specific. Must integrate with sql.js, LATCH filters, PAFV projection. No generic "embed" extension supports this.

**Verification:** Self-evident. No external package can render Isometry views.

### Decision 4: Backlinks Panel is Component, Not Extension
**Rationale:** Backlinks are UI chrome, not editor content. Panel queries sql.js for edges created by WikiLink extension. Separate concern from TipTap.

**Verification:** TipTap docs and community discussions show no backlinks extension. Standard pattern is separate UI component.

### Decision 5: Extend SlashCommands, Don't Replace
**Rationale:** Existing SlashCommands infrastructure works. Adding 10 new commands (callout, toggle, divider, columns, image, file, bookmark, supergrid, network, timeline) requires appending to `SLASH_COMMANDS` array, not rebuilding system.

**Verification:** Existing `slash-commands.ts` file uses extensible array pattern.

### Decision 6: Apple Notes Keyboard Shortcuts via Custom Extension
**Rationale:** StarterKit handles Cmd+B (bold), Cmd+I (italic) already. Only need to add Cmd+Shift+L (checklist). TipTap's `addKeyboardShortcuts()` is official pattern for overrides.

**Verification:** [TipTap Keyboard Shortcuts Docs](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts) + Apple Support docs confirm Cmd+Shift+L.

## Open Questions & Risks

### Open Question 1: Columns Layout Implementation
**Question:** Use community `@tiptap-extend/columns` or build custom?

**Tradeoff:**
- **Community package:** Faster to implement, but 2 years old (unmaintained?), unknown PAFV integration challenges
- **Custom node:** More work, but full control, can align with Isometry grid system

**Recommendation:** Start with community package, fall back to custom if PAFV integration fails.

**Confidence:** MEDIUM — Need to test community package first.

### Open Question 2: File Upload Backend
**Question:** Where do `/file` and `/image` uploads go?

**Options:**
1. **Base64 encode in markdown:** Simple, no server, bloats document size
2. **Local file system (Tauri):** Use Tauri FS plugin, store in `.isometry/uploads/`
3. **CloudKit (future):** Server upload, sync across devices

**Recommendation:** Phase 1 uses base64 for simplicity (FileHandler → base64 data URL → Image node). Phase 2 switches to Tauri FS for desktop build.

**Confidence:** LOW — File storage strategy needs architecture decision.

### Risk 1: TipTap Pro Extension Confusion
**Risk:** Details extension documentation may still show as "Pro" in some places, causing confusion.

**Mitigation:** npm package `@tiptap/extension-details` is public. Install directly, verify no auth required. TipTap moved many Pro extensions to open source in 2026 pricing update.

**Confidence:** HIGH that Details is free, but double-check on install.

### Risk 2: React NodeView Performance
**Risk:** IsometryEmbedComponent renders heavy D3 visualizations (SuperGrid). Could slow editor typing.

**Mitigation:** Lazy load with React.lazy. Use `atom: true` on node (makes it non-editable block, D3 renders independently). Debounce re-renders.

**Confidence:** MEDIUM — Need performance testing with real data.

### Risk 3: Obsidian Syntax Compatibility
**Risk:** Obsidian's `[key:: value]` and `key:: value` syntax has nuances (bracket vs non-bracket, rendering differences).

**Mitigation:** Start with bracket syntax `[key:: value]` (easier to parse with input rules). Defer non-bracket syntax to later phase.

**Confidence:** MEDIUM — Obsidian syntax is complex, may need iteration.

## Summary

**Install these official TipTap extensions:**
```bash
npm install @tiptap/extension-details @tiptap/extension-character-count @tiptap/extension-file-handler
```

**Build these custom extensions:**
1. **AppleNotesKeys** — Keyboard shortcut overrides (Cmd+Shift+L for checklist)
2. **Callout** — Notion-style callout blocks with type/icon
3. **IsometryEmbed** — SuperGrid/Network/Timeline embeds with LATCH+PAFV
4. **InlineProperty** — Obsidian-style `[key:: value]` syntax (mark extension)

**Build these UI components (not extensions):**
1. **BacklinksPanel** — Queries sql.js for WikiLink edges, displays backlinks
2. **Template commands** — Extend SlashCommands array with daily note, project, etc.

**Do NOT install:**
- TipTap Pro subscription (not needed)
- Community columns packages (build custom OR test first)
- Legacy tiptap-extensions v1 packages
- Competing editors (Draft.js, Slate, etc.)

**Integration points:**
- Slash commands: Add 10 new commands to existing `SLASH_COMMANDS` array
- Keyboard shortcuts: Add AppleNotesKeys extension to editor
- Node views: Use ReactNodeViewRenderer with existing React setup
- Backlinks: BacklinksPanel queries edges created by WikiLink extension
- File uploads: FileHandler → base64 data URLs (Phase 1) → Tauri FS (Phase 2)

**Testing:** Unit tests for each custom node, integration tests for slash commands, E2E tests for keyboard shortcuts.

**Migration:** 5-week rollout, Core Extensions → Custom Nodes → Isometry Integration → Obsidian Features → Polish.

**Confidence:** MEDIUM-HIGH overall. Official extensions are HIGH confidence (verified). Custom nodes are HIGH confidence (official pattern). File storage and Obsidian syntax are MEDIUM (need iteration).

---

**Sources:**

- [TipTap Extensions Overview](https://tiptap.dev/docs/editor/extensions/overview)
- [Details Extension](https://tiptap.dev/docs/editor/extensions/nodes/details)
- [HorizontalRule Extension](https://tiptap.dev/docs/editor/extensions/nodes/horizontal-rule)
- [FileHandler Extension](https://tiptap.dev/docs/editor/extensions/functionality/filehandler)
- [CharacterCount Extension](https://tiptap.dev/docs/editor/extensions/functionality/character-count)
- [React NodeViews](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)
- [Keyboard Shortcuts](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts)
- [Image Extension](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Link Extension](https://tiptap.dev/docs/editor/extensions/marks/link)
- [TipTap Pro Pricing](https://tiptap.dev/pricing)
- [Apple Notes Keyboard Shortcuts](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac)
- [Obsidian Dataview Metadata](https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/)
- [Community Columns Extension Discussion](https://github.com/ueberdosis/tiptap/discussions/6317)
- [@tiptap/extension-details npm](https://www.npmjs.com/package/@tiptap/extension-details)
- [@tiptap/extension-horizontal-rule npm](https://www.npmjs.com/package/@tiptap/extension-horizontal-rule)
- [@tiptap/extension-character-count npm](https://www.npmjs.com/package/@tiptap/extension-character-count)
