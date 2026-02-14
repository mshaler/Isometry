# Roadmap: Capture Writing Surface v6.2

## Overview

The Capture Writing Surface milestone transforms Isometry's TipTap editor into a world-class writing environment combining Apple Notes keyboard fluency (53 shortcuts), Notion slash commands (30+ block types), Obsidian knowledge management (backlinks, templates, inline properties), and Isometry-native live view embeds. This roadmap delivers zero-friction capture where formatting aids thought without interrupting flow, starting with critical foundation fixes and building incrementally toward unique differentiators like live SuperGrid embeds within notes.

## Milestones

- ✅ **v6.0 Interactive Shell** - Phases 85-88 (in progress)
- 🚧 **v6.1 SuperStack Enhancement** - Phases 89-93 (paused)
- 📋 **v6.2 Capture Writing Surface** - Phases 94-98 (this roadmap)

## Phases

**Phase Numbering:**
- Integer phases (94, 95, 96, 97, 98): Planned milestone work
- Decimal phases (e.g., 94.1, 94.2): Urgent insertions (marked with INSERTED)

### Phase 94: Foundation & Critical Fixes
**Goal**: Fix existing data loss bugs (Markdown serialization), add security hardening (paste sanitization), and deliver Apple Notes keyboard fluency before building advanced features on lossy foundation.

**Depends on**: Phase 93 (v6.1 SuperStack Polish)

**Requirements**: FOUND-01, FOUND-02, FOUND-03, KEYS-01, KEYS-02, KEYS-03, KEYS-04, KEYS-05, KEYS-06, POLISH-01, POLISH-02

**Success Criteria** (what must be TRUE):
  1. User can save card, close editor, reopen, and all formatting (bold, lists, links) persists without loss
  2. User can paste HTML from external sources and malicious scripts are sanitized (no XSS execution)
  3. User can switch between cards 20+ times without memory growth (Tippy.js instances cleaned up)
  4. User can toggle checklist with Cmd+Shift+L, set headings with Cmd+1-6, indent with Tab, insert rule with Cmd+Shift+H, strikethrough with Cmd+Shift+X
  5. User can type `- ` and get bullet list, `1. ` and get numbered list, `[ ]` and get checkbox without manual formatting

**Plans**: TBD

Plans:
- [ ] 94-01: Migrate from getText() to @tiptap/markdown serialization
- [ ] 94-02: DOMPurify paste sanitization integration
- [ ] 94-03: Tippy.js cleanup in SlashCommands/WikiLink extensions
- [ ] 94-04: Apple Notes keyboard shortcuts extension (30+ shortcuts)
- [ ] 94-05: Smart formatting input rules (auto-lists, auto-checkboxes)
- [ ] 94-06: Word/character count status bar (@tiptap/extension-character-count)

---

### Phase 95: Data Layer & Backlinks
**Goal**: Establish template storage infrastructure (sql.js templates table) and backlinks UI (query existing edge data) that later phases depend on for slash command workflows.

**Depends on**: Phase 94

**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, BACK-01, BACK-02, BACK-03, BACK-04

**Success Criteria** (what must be TRUE):
  1. User can type `/template` and see picker with 4+ built-in templates (Meeting Notes, Task, Daily Note, Project)
  2. User can select template from picker and content inserts into editor at cursor position
  3. User can create custom template from current card content and it persists across sessions
  4. User can see backlinks panel showing all cards that reference current card (via WikiLink or GRAPH edges)
  5. User can click backlink entry and navigate to that card in Capture editor

**Plans**: TBD

Plans:
- [ ] 95-01: sql.js templates table schema migration
- [ ] 95-02: Template CRUD operations (TemplateContext)
- [ ] 95-03: Built-in template seeding (4 templates)
- [ ] 95-04: Template picker UI component (modal with preview)
- [ ] 95-05: Backlinks panel component (queries edges + WikiLink text search)
- [ ] 95-06: Backlinks click navigation

---

### Phase 96: Block Types & Slash Commands
**Goal**: Expand slash command vocabulary to Notion parity (20+ commands) with custom block types (callout, toggle, divider, quote) after template system can use them.

**Depends on**: Phase 95

**Requirements**: SLASH-01, SLASH-02, SLASH-03, SLASH-04, SLASH-05, SLASH-06, SLASH-07, SLASH-08, SLASH-09, SLASH-10, BLOCK-01, BLOCK-02, BLOCK-03, BLOCK-04

**Success Criteria** (what must be TRUE):
  1. User can insert headings via `/h1` through `/h6` and they render at correct size with theme styling
  2. User can insert callout via `/callout`, select type (info/warning/tip/error), and it renders with colored background and icon
  3. User can insert toggle via `/toggle` and content is collapsible with click or keyboard (Space/Enter)
  4. User can insert divider via `/divider` and horizontal line renders with theme styling
  5. User can insert image via `/image` (file picker or drag-drop), file via `/file`, bookmark via `/bookmark` (fetches URL metadata), date via `/date` (date picker), mention via `/mention` (card picker)

**Plans**: TBD

Plans:
- [ ] 96-01: Heading slash commands (/h1-/h6) using StarterKit
- [ ] 96-02: Callout custom node with ReactNodeViewRenderer
- [ ] 96-03: Toggle custom node (@tiptap/extension-details integration)
- [ ] 96-04: Divider, Quote, Code slash commands
- [ ] 96-05: Image/File handlers (@tiptap/extension-file-handler)
- [ ] 96-06: Bookmark preview node (URL metadata fetch)
- [ ] 96-07: Date picker slash command
- [ ] 96-08: Mention/card picker slash command

---

### Phase 97: Inline Properties & Advanced Sync
**Goal**: Deliver Obsidian-style inline property syntax (`@key: value`, `#tag`) with bidirectional PropertyEditor sync after all other systems stable (most complex state management).

**Depends on**: Phase 96

**Requirements**: PROP-01, PROP-02, PROP-03, PROP-04

**Success Criteria** (what must be TRUE):
  1. User can type `@status: in-progress` in editor and it renders as colored inline property mark
  2. User can see inline properties reflected in PropertyEditor panel without manual sync
  3. User can type `#meeting` and autocomplete shows existing tags from database
  4. User can see hashtags reflected in PropertyEditor tags field

**Plans**: TBD

Plans:
- [ ] 97-01: InlineProperty mark extension with input rules
- [ ] 97-02: HashTag mark extension with autocomplete
- [ ] 97-03: PropertyEditor bidirectional sync (editor → panel)
- [ ] 97-04: Prevent save race conditions with isPropertyUpdateRef guard

---

### Phase 98: Isometry Embeds & Polish
**Goal**: Deliver Isometry's unique differentiator — live SuperGrid/Network/Timeline embeds within notes with LATCH filtering and view transitions — plus final performance polish.

**Depends on**: Phase 97

**Requirements**: EMBED-01, EMBED-02, EMBED-03, EMBED-04, EMBED-05, EMBED-06, POLISH-03

**Success Criteria** (what must be TRUE):
  1. User can type `/supergrid` and insert live SuperGrid with LATCH filter parameter (e.g., `folder=work`)
  2. User can interact with embedded SuperGrid (zoom, pan, select cells) and it respects filter boundaries
  3. User can type `/network` and `/timeline` and corresponding D3.js views embed inline
  4. User can use embed toolbar to switch between grid/kanban/network/timeline views (same data, different projections)
  5. User can edit card data elsewhere and embedded views update automatically
  6. Editor maintains 60fps performance with 10,000+ character documents and 3+ live embeds

**Plans**: TBD

Plans:
- [ ] 98-01: D3.js + NodeView integration spike (validation)
- [ ] 98-02: Embed filter parsing utilities
- [ ] 98-03: EmbedSuperGrid extension + NodeView component
- [ ] 98-04: EmbedNetwork extension + NodeView component
- [ ] 98-05: EmbedTimeline extension + NodeView component
- [ ] 98-06: Embed toolbar (view switcher) component
- [ ] 98-07: Performance optimization (lazy loading, Intersection Observer)
- [ ] 98-08: Embed lifecycle cleanup (destroy D3.js renderers)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 94 → 95 → 96 → 97 → 98

| Phase | Requirements | Plans Complete | Status | Completed |
|-------|--------------|----------------|--------|-----------|
| 94. Foundation & Critical Fixes | 11 | 0/6 | Not started | - |
| 95. Data Layer & Backlinks | 9 | 0/6 | Not started | - |
| 96. Block Types & Slash Commands | 14 | 0/8 | Not started | - |
| 97. Inline Properties | 4 | 0/4 | Not started | - |
| 98. Isometry Embeds & Polish | 7 | 0/8 | Not started | - |

**Total:** 45 requirements, 32 plans (estimated), 5 phases

---

## Research Flags

**Phase 95:** Template picker UX (modal vs dropdown vs sidebar) — Start with modal (simpler), iterate if needed

**Phase 97:** Bidirectional property sync — Start one-way (editor → PropertyEditor), defer reverse sync if complex

**Phase 98:** D3.js + TipTap NodeView integration — **DEEP RESEARCH NEEDED**. Plan 98-01 is validation spike. Pattern unproven. Fallback: read-only embeds with "Open in Preview" button.

---

*Roadmap created: 2026-02-14*
*Next step: `/gsd:plan-phase 94`*
