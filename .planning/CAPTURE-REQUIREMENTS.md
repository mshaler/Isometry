# Requirements: Capture Writing Surface v6.2

**Defined:** 2026-02-13
**Core Value:** Zero-friction writing with Apple Notes fluency, Notion flexibility, Obsidian power, and Isometry-native embeds

## v6.2 Requirements

Requirements for Capture Writing Surface milestone. Each maps to roadmap phases.

### Foundation (Critical Fixes)

- [ ] **FOUND-01**: Editor content persists formatting through save/load cycle (Markdown serialization fix)
- [ ] **FOUND-02**: Pasted HTML content is sanitized to prevent XSS attacks
- [ ] **FOUND-03**: Memory is properly cleaned up when switching between cards (no Tippy.js leaks)

### Keyboard Shortcuts

- [ ] **KEYS-01**: User can toggle checklist with Cmd+Shift+L
- [ ] **KEYS-02**: User can set heading levels with Cmd+1 through Cmd+6
- [ ] **KEYS-03**: User can indent/outdent with Tab/Shift+Tab
- [ ] **KEYS-04**: User can insert horizontal rule with Cmd+Shift+H
- [ ] **KEYS-05**: User can toggle strikethrough with Cmd+Shift+X
- [ ] **KEYS-06**: Smart formatting auto-converts `- ` to bullet, `1. ` to numbered list, `[ ]` to checkbox

### Slash Commands

- [ ] **SLASH-01**: User can insert headings via /h1, /h2, /h3, /h4, /h5, /h6
- [ ] **SLASH-02**: User can insert callout box via /callout with type selection (info, warning, tip, error)
- [ ] **SLASH-03**: User can insert toggle/collapsible block via /toggle
- [ ] **SLASH-04**: User can insert horizontal divider via /divider
- [ ] **SLASH-05**: User can insert quote block via /quote
- [ ] **SLASH-06**: User can insert image via /image (file picker or drag-drop)
- [ ] **SLASH-07**: User can insert file attachment via /file
- [ ] **SLASH-08**: User can insert bookmark preview via /bookmark (URL metadata fetch)
- [ ] **SLASH-09**: User can insert date via /date (date picker)
- [ ] **SLASH-10**: User can mention card via /mention (card picker)

### Block Types

- [ ] **BLOCK-01**: Callout block renders with icon and colored background based on type
- [ ] **BLOCK-02**: Toggle block can be expanded/collapsed with click or keyboard
- [ ] **BLOCK-03**: Divider block renders as horizontal line with theme styling
- [ ] **BLOCK-04**: Bookmark block renders with title, description, favicon from URL

### Templates

- [ ] **TMPL-01**: User can insert template via /template slash command
- [ ] **TMPL-02**: Template picker shows preview of template content
- [ ] **TMPL-03**: Built-in templates exist for Meeting Notes, Task, Daily Note, Project
- [ ] **TMPL-04**: User can create custom template from current card content
- [ ] **TMPL-05**: Templates persist in sql.js database

### Backlinks

- [ ] **BACK-01**: Backlinks panel shows all cards that link to current card
- [ ] **BACK-02**: Backlinks panel is collapsible (like PropertyEditor)
- [ ] **BACK-03**: Clicking backlink navigates to that card in Capture
- [ ] **BACK-04**: Backlink count badge shows in panel header

### Inline Properties

- [ ] **PROP-01**: User can type `@key: value` syntax and it renders as inline property mark
- [ ] **PROP-02**: Inline properties sync to PropertyEditor panel
- [ ] **PROP-03**: User can type `#tag` and it auto-completes from existing tags
- [ ] **PROP-04**: Tags sync to PropertyEditor tags field

### Isometry Embeds

- [ ] **EMBED-01**: User can insert live SuperGrid via /supergrid slash command
- [ ] **EMBED-02**: SuperGrid embed respects LATCH filter from embed parameters
- [ ] **EMBED-03**: User can insert live Network graph via /network slash command
- [ ] **EMBED-04**: User can insert live Timeline via /timeline slash command
- [ ] **EMBED-05**: Embeds update when underlying data changes
- [ ] **EMBED-06**: Embeds have toolbar for view switching (grid/kanban/network/timeline)

### Polish

- [ ] **POLISH-01**: Word/character count displays in editor status bar
- [ ] **POLISH-02**: Undo/redo buttons visible in toolbar
- [ ] **POLISH-03**: Editor performance maintains 60fps with 10,000+ character documents

## Future Requirements (v6.3+)

### Deferred Features

- **COLLAB-01**: Real-time multi-user editing — Requires CRDT/OT, high complexity
- **CANVAS-01**: Infinite canvas mode (Obsidian Canvas pattern) — Separate product direction
- **AI-01**: AI autofill for properties — LLM integration, Phase 4+ feature
- **VERSION-01**: Version history with time travel — Nice-to-have, not MVP

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plugin architecture | Curated feature set, not open API — maintenance burden |
| 500+ embed services (Notion pattern) | Focus on Isometry-native embeds only |
| File-per-note storage (Obsidian pattern) | Notes are rows in sql.js, not files |
| Mobile keyboard optimization | Desktop-first for MVP, mobile deferred |
| Synced blocks (Notion pattern) | High complexity, content reuse not critical |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 94 | Pending |
| FOUND-02 | Phase 94 | Pending |
| FOUND-03 | Phase 94 | Pending |
| KEYS-01 | Phase 94 | Pending |
| KEYS-02 | Phase 94 | Pending |
| KEYS-03 | Phase 94 | Pending |
| KEYS-04 | Phase 94 | Pending |
| KEYS-05 | Phase 94 | Pending |
| KEYS-06 | Phase 94 | Pending |
| SLASH-01 | Phase 96 | Pending |
| SLASH-02 | Phase 96 | Pending |
| SLASH-03 | Phase 96 | Pending |
| SLASH-04 | Phase 96 | Pending |
| SLASH-05 | Phase 96 | Pending |
| SLASH-06 | Phase 96 | Pending |
| SLASH-07 | Phase 96 | Pending |
| SLASH-08 | Phase 96 | Pending |
| SLASH-09 | Phase 96 | Pending |
| SLASH-10 | Phase 96 | Pending |
| BLOCK-01 | Phase 96 | Pending |
| BLOCK-02 | Phase 96 | Pending |
| BLOCK-03 | Phase 96 | Pending |
| BLOCK-04 | Phase 96 | Pending |
| TMPL-01 | Phase 95 | Pending |
| TMPL-02 | Phase 95 | Pending |
| TMPL-03 | Phase 95 | Pending |
| TMPL-04 | Phase 95 | Pending |
| TMPL-05 | Phase 95 | Pending |
| BACK-01 | Phase 95 | Pending |
| BACK-02 | Phase 95 | Pending |
| BACK-03 | Phase 95 | Pending |
| BACK-04 | Phase 95 | Pending |
| PROP-01 | Phase 97 | Pending |
| PROP-02 | Phase 97 | Pending |
| PROP-03 | Phase 97 | Pending |
| PROP-04 | Phase 97 | Pending |
| EMBED-01 | Phase 98 | Pending |
| EMBED-02 | Phase 98 | Pending |
| EMBED-03 | Phase 98 | Pending |
| EMBED-04 | Phase 98 | Pending |
| EMBED-05 | Phase 98 | Pending |
| EMBED-06 | Phase 98 | Pending |
| POLISH-01 | Phase 94 | Pending |
| POLISH-02 | Phase 94 | Pending |
| POLISH-03 | Phase 98 | Pending |

**Coverage:**
- v6.2 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after research synthesis*
