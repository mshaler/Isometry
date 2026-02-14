# Capture Writing Surface Research Summary

**Project:** Isometry v6.2 Capture Writing Surface Enhancement
**Domain:** Rich text editing with Apple Notes fluency, Notion commands, Obsidian power features
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

The Capture Writing Surface milestone extends Isometry's existing TipTap-based editor with keyboard-driven fluency, block-based commands, and knowledge management features from best-in-class note-taking apps. Research shows that Apple Notes (53 keyboard shortcuts), Notion (30+ slash commands), and Obsidian (2700+ plugins) all prioritize zero-friction capture workflows and keyboard-driven interfaces. The key insight: **users expect instant formatting response, discoverable commands via slash menu, and bidirectional linking without leaving the keyboard.**

The recommended approach leverages Isometry's existing TipTap 3.19.0 foundation, which already implements the performance-critical pattern (`shouldRerenderOnTransaction: false`) required for large documents. New features integrate cleanly through TipTap's extension API: keyboard shortcuts as pure extensions, templates via React components + sql.js storage, backlinks as UI queries against existing edge data, and custom block types via NodeView renderers. **No architectural changes needed** — this is additive enhancement, not replacement.

Critical risks center on state management complexity (inline property sync with PropertyEditor) and security (paste XSS vulnerability, Markdown serialization currently lossy). The current implementation uses `editor.getText()` which **loses all formatting** — migrating to `@tiptap/markdown` storage is a **Phase 1 blocker**. Other pitfalls (z-index conflicts, memory leaks in Tippy.js, save race conditions) are manageable with established patterns. The biggest unknown is D3.js embed integration within TipTap NodeViews — recommend a 1-day spike before committing to full implementation.

## Key Findings

### Recommended Stack

The existing TipTap 3.19.0 foundation with StarterKit, Link, Placeholder, SlashCommands, and WikiLink extensions provides 70% of required functionality. Three official TipTap extensions are needed (`@tiptap/extension-details` for toggles, `@tiptap/extension-character-count` for word count, `@tiptap/extension-file-handler` for attachments), plus 8 custom extensions (keyboard shortcuts, callout blocks, inline properties, D3.js embeds).

**Core technologies to add:**
- **@tiptap/extension-details** (v3.4.2): Notion-style toggle/collapsible blocks — recently moved to open source, actively maintained, proven API
- **@tiptap/extension-character-count**: Word/character count for status bar — passive extension, no conflicts
- **@tiptap/extension-file-handler**: Detect file drops/pastes for image/file upload — pairs with existing Image extension
- **@tiptap/markdown**: Markdown serialization (CRITICAL FIX) — currently using lossy `getText()`, must migrate to preserve formatting
- **DOMPurify**: Paste sanitization to prevent XSS — security requirement for any user-generated HTML

**Custom extensions to build:**
- **AppleNotesKeys**: Keyboard shortcut overrides (Cmd+Shift+L for checklist, etc.) — pure TipTap extension, no UI
- **Callout**: Notion-style callout blocks with type/icon — custom Node + ReactNodeViewRenderer
- **InlineProperty**: Obsidian-style `[key:: value]` syntax — custom Mark extension with input rules
- **IsometryEmbed**: SuperGrid/Network/Timeline embeds — custom Node + D3.js renderer integration

**Do NOT install:**
- TipTap Pro subscription (Details extension is now free)
- Community columns packages (unmaintained, build custom with PAFV awareness)
- Competing editors (Draft.js, Slate)

### Expected Features

Research identified **21 table stakes features** that users expect from any rich text editor. Isometry currently has 14/21 (67%), missing: undo/redo UI, attachments, copy/paste formatting, expanded keyboard shortcuts, and full slash command parity.

**Must have (table stakes):**
- Auto-save — Already implemented with debounce
- Undo/redo — TipTap has this, need UI exposure
- Bold/italic/underline/headings — Already via StarterKit
- Lists (bullet/numbered/checklist) — Already via StarterKit
- Links and internal links (WikiLinks) — Already implemented
- Code blocks and blockquotes — Already via StarterKit
- Tables — Basic table editing needed (TipTap extension available)
- Search — Already via FTS5
- Tags/categories — Already via PropertyEditor
- Attachments — Need FileHandler integration
- Templates — Need UI + sql.js storage
- Keyboard shortcuts — Need expansion to 30+ shortcuts (Apple Notes has 53)
- Slash commands — Have 10, need 20+ for parity

**Should have (differentiators):**
- Live SuperGrid embeds — **Unique to Isometry**, no competitor has orthogonal density + PAFV
- PAFV view transitions — Same data, polymorphic views (grid/kanban/network/timeline)
- LATCH-aware slash commands — `/meeting`, `/pafv` auto-structure cards with domain intelligence
- Graph edge creation — Create typed edges (Link/Nest/Sequence/Affinity) via UI
- Formula bar (SuperCalc) — PAFV-aware formulas like `SUMOVER()`
- Density controls in embeds — Janus model (zoom + pan independently)
- sql.js query blocks — Embed live SQL results in notes
- Property editor for cards — Structured metadata on any note

**Defer (v2+):**
- Synced blocks (Notion pattern) — High complexity, content reuse not critical for MVP
- AI autofill — LLM integration, Phase 4+ feature
- Canvas mode (Obsidian) — Infinite whiteboard, separate product direction
- Collaboration — Real-time multi-user, requires CRDT/OT, Phase 5+
- Version history — Time travel, nice-to-have
- Custom themes — CSS customization, low priority (already have NeXTSTEP/Modern themes)

### Architecture Approach

The existing architecture already implements the critical performance pattern: TipTap's `useEditor` hook with `shouldRerenderOnTransaction: false` prevents re-render lag on large documents. New features integrate through three mechanisms: (1) TipTap extensions for editor behavior, (2) React components for UI chrome, (3) sql.js queries for data operations. The five-layer separation (database → sql.js → D3.js → React → Swift/Tauri) remains unchanged.

**Major components:**
1. **Extension Layer** — TipTap extensions for keyboard shortcuts, block types, inline properties, embeds. Pure editor logic, no React state mutations.
2. **UI Components** — Template picker, backlinks panel, property editor enhancements. React components that query sql.js and dispatch editor commands.
3. **Data Layer** — sql.js `templates` table, backlinks query (already exists in `utils/editor/backlinks.ts`), property sync. Direct synchronous queries, no bridge overhead.
4. **Integration Points** — Slash command registry (extend existing `SLASH_COMMANDS` array), PropertyEditor sync (bidirectional state management), NotebookContext methods (add `applyTemplate()`).

**Build order (dependency-driven):**
1. Foundation (keyboard shortcuts, smart formatting) — No dependencies, pure extensions
2. Data layer (templates table, backlinks query) — Minimal UI dependencies
3. UI components (template picker, backlinks panel) — Depends on Phase 2 data
4. Advanced extensions (custom blocks, inline properties) — Depends on all previous
5. Embeds (SuperGrid/Network/Timeline) — Most complex, depends on everything

### Critical Pitfalls

Research identified 17 pitfalls ranging from critical (data corruption, security) to minor (UX polish). The top 5 that could derail implementation:

1. **Markdown Serialization Loss** — Current implementation uses `editor.getText()` which **loses all formatting** (bold, links, lists). Migration to `@tiptap/markdown` is **Phase 1 blocker**. Test with round-trip: TipTap → Markdown → TipTap. Confidence: HIGH (TODO comments in code acknowledge this).

2. **Paste XSS Vulnerability** — Pasting HTML from clipboard can execute arbitrary JavaScript via `onload` attributes. TipTap's default paste handling trusts clipboard content. **Security gap** requires DOMPurify sanitization. Test: paste `<img src=x onerror="alert('XSS')">` — if alert fires, vulnerability exists. Confidence: HIGH (verified CVEs in similar editors).

3. **Memory Leak in Extensions** — Tippy.js instances in SlashCommands and WikiLink extensions may not clean up on editor destroy. Browser memory balloons after 10-15 card switches, eventually crashing. Verify cleanup in `onExit` lifecycle hooks. Confidence: HIGH (GitHub issue #5654 documents root cause).

4. **Save Race Condition** — Switching cards before debounced save completes causes content from Card A to overwrite Card B. Currently prevented by synchronous save before card switch (lines 129-150 in CaptureComponent.tsx), but property updates may bypass this guard. Verify `propertyUpdateCount` state gates TipTap saves. Confidence: MEDIUM (pattern exists, edge cases unclear).

5. **Z-Index Conflicts** — Slash command menu appears behind modals or PropertyEditor due to competing z-index hierarchies (TipTap BubbleMenu uses z-index 1, Tippy uses 3-4, MUI Dialog uses 1300). Set explicit Tippy z-index to 1400. Test with all panes/modals open. Confidence: MEDIUM (common pattern, specific to Isometry's layout).

**Secondary pitfalls to monitor:**
- Keyboard shortcut conflicts (Cmd+K for link vs browser search) — Use priority system, document unavailable shortcuts
- Slash menu broken inside code blocks/blockquotes — Check `allow` function in suggestion config
- Undo/redo confusion after slash commands — Add `addToHistory: true` metadata to force boundaries
- FTS5 query lag on 10K+ cards for WikiLink suggestions — Add LIMIT 10, verify index usage
- D3.js embed lifecycle issues — Guard with `if (!db) return <LoadingSpinner />`, watch filters in useEffect

## Implications for Roadmap

Based on dependencies and complexity, recommend **5-phase structure** totaling 16-23 days (3-4.5 weeks).

### Phase 1: Foundation & Critical Fixes (1-2 days)
**Rationale:** Fix existing data loss bugs and add zero-dependency features before building on top.
**Delivers:**
- Markdown serialization (migrate from `getText()` to `@tiptap/markdown`)
- Paste sanitization (DOMPurify integration)
- Apple Notes keyboard shortcuts (30+ shortcuts)
- Smart formatting (auto-lists, auto-checkboxes via StarterKit config)
**Addresses:**
- Table stakes: Undo/redo, keyboard shortcuts
- Pitfalls: #1 (Markdown loss), #4 (XSS)
**Avoids:** Building features on a lossy storage foundation
**Research flag:** None — straightforward TipTap extension work

### Phase 2: Data Layer & Backlinks (3-4 days)
**Rationale:** Establish template storage and backlinks infrastructure that later phases depend on.
**Delivers:**
- `templates` table in sql.js with migration
- Template CRUD operations (TemplateContext)
- Backlinks panel component (queries existing edge data)
- Built-in template seeding
**Uses:**
- sql.js for template storage
- Existing `queryBacklinks()` from utils/editor/backlinks.ts
- PropertyEditor component pattern for collapsible panel
**Implements:** Data layer for templates, UI for backlinks
**Addresses:**
- Table stakes: Templates
- Differentiators: Backlinks panel (Obsidian pattern)
**Avoids:** Building UI before data exists
**Research flag:** Template picker UX needs design iteration (modal vs dropdown vs sidebar)

### Phase 3: Block Types & Slash Commands (2-3 days)
**Rationale:** Expand slash command vocabulary with Notion-style blocks after template system can use them.
**Delivers:**
- Enhanced slash commands (/h1, /h2, /h3, /callout, /divider, /quote, /code)
- Custom nodes (Callout, Divider via ReactNodeViewRenderer)
- Template picker UI (modal with preview)
- Template editor (create/edit custom templates)
**Uses:**
- TipTap StarterKit commands (setHeading, toggleBlockquote)
- ReactNodeViewRenderer for custom blocks
- Template data from Phase 2
**Implements:** Notion-style editing experience
**Addresses:**
- Table stakes: Slash command parity (20+ commands)
- Nice-to-have: Custom block types
**Avoids:** Slash command formatting interference (Pitfall #8) by tracking menu state
**Research flag:** None — proven slash command pattern from existing implementation

### Phase 4: Inline Properties & Advanced Sync (3-4 days)
**Rationale:** Most complex state sync, needs all other systems stable first.
**Delivers:**
- InlineProperty mark extension (`@status: in-progress` syntax)
- HashTag mark extension (`#tag` syntax)
- PropertyEditor bidirectional sync
- Input rules for auto-conversion
**Uses:**
- TipTap Mark API with input rules
- PropertyEditor component (modify for sync)
- ProseMirror state inspection
**Implements:** Obsidian power features
**Addresses:**
- Differentiators: Property editor for cards with inline syntax
**Avoids:**
- Double-save thrashing (Pitfall #16) via `isPropertyUpdateRef`
- State desync by making editor content single source of truth
**Research flag:** State sync architecture needs careful design — most complex feature

### Phase 5: Isometry Embeds (5-7 days)
**Rationale:** Most complex integration, Isometry's unique differentiator, depends on all previous systems.
**Delivers:**
- Embed infrastructure (filter parsing utilities, NodeView base)
- EmbedSuperGrid extension + NodeView component
- EmbedNetwork extension + NodeView component
- EmbedTimeline extension + NodeView component
- Slash commands (/supergrid, /network, /timeline)
**Uses:**
- Existing SuperGridRenderer, NetworkRenderer, TimelineRenderer (D3.js)
- ReactNodeViewRenderer pattern from Phase 3
- sql.js queries for filtered data
- LATCH filter context
**Implements:** Live polymorphic view embeds — **no competitor has this**
**Addresses:**
- Differentiators: Live SuperGrid embeds, PAFV view transitions, density controls
**Avoids:**
- Performance issues (Pitfall #2) via lazy loading and Intersection Observer
- Memory leaks by cleaning up D3.js renderers in destroy() lifecycle
**Research flag:** **DEEP RESEARCH NEEDED** — D3.js + TipTap NodeView integration unproven. Recommend 1-day spike to validate pattern before committing to full implementation.

### Phase Ordering Rationale

- **Sequential dependencies:** Templates (Phase 2) must exist before template picker (Phase 3). Custom blocks (Phase 3) must work before embeds (Phase 5) because embeds use ReactNodeViewRenderer pattern.
- **Risk management:** Critical fixes (Phase 1) prevent building on lossy foundation. Data layer (Phase 2) before UI (Phase 3) prevents thrashing. Most complex feature (embeds) comes last when all other systems are stable.
- **Incremental value:** Each phase delivers user-visible improvements. Phases 1-3 reach table stakes parity. Phase 4 adds Obsidian power. Phase 5 delivers Isometry differentiation.
- **Pitfall avoidance:** Markdown serialization (Phase 1) gates everything. State sync complexity (Phase 4) comes after simpler features prove the patterns. Embed spike (Phase 5) validates before committing.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2:** Template picker UX — Modal vs dropdown vs sidebar panel? Start with modal (simpler), iterate if needed.
- **Phase 4:** State sync architecture — Bidirectional or one-way? Recommend one-way (editor → PropertyEditor) for MVP, defer reverse sync.
- **Phase 5:** D3.js + NodeView integration — **1-day spike required** to prove D3.js rendering inside TipTap NodeView works. Pattern is unproven. If spike fails, fallback to read-only embeds with "Open in Preview" button.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Keyboard shortcuts — Official TipTap pattern, StarterKit commands already available
- **Phase 3:** Block types — Slash command pattern proven in existing implementation
- **Phase 2:** Backlinks — Query already exists (`utils/editor/backlinks.ts`), just needs UI

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official TipTap extensions verified via npm, custom extension patterns documented in TipTap official guides |
| Features | HIGH | Apple Notes (53 shortcuts), Notion (30+ commands), Obsidian (2700+ plugins) all extensively documented with official sources |
| Architecture | HIGH | Existing implementation already uses performance-critical patterns, new features integrate cleanly via TipTap extension API |
| Pitfalls | HIGH | 17 pitfalls sourced from TipTap GitHub issues (4491, 5031, 5654, 2547), CVEs, and bounty reports with concrete reproduction steps |

**Overall confidence:** HIGH

The research is based on official documentation (TipTap, Apple, Notion, Obsidian), verified npm packages, real-world GitHub issues with reproduction steps, and direct code review of Isometry's existing implementation. The only MEDIUM-confidence area is D3.js embed integration (unproven pattern), hence the recommendation for a validation spike.

### Gaps to Address

**Gap 1: D3.js rendering lifecycle inside TipTap NodeViews**
- **Issue:** TipTap NodeViews render inside editor DOM. D3.js renderers expect to control an SVG element. Lifecycle conflicts (mount/unmount, re-render triggers) are unknown.
- **Validation:** 1-day spike in Phase 5 to build minimal proof-of-concept: single SuperGrid embed with static data, no interactions.
- **Fallback:** If spike fails, embeds become read-only with "Expand to Preview" button instead of inline interaction.

**Gap 2: Template picker UX design**
- **Issue:** Modal vs dropdown vs sidebar placement unclear without user testing.
- **Validation:** Start with modal (simpler to implement), gather feedback, iterate to sidebar if needed in Phase 6+.
- **Acceptance:** Template insertion works, even if UX isn't optimal for MVP.

**Gap 3: Bidirectional property sync**
- **Issue:** Editing properties in PropertyEditor should update inline marks, AND editing inline marks should update PropertyEditor. Circular update risk.
- **Validation:** Start with one-way sync (editor → PropertyEditor) in Phase 4. Defer reverse sync to Phase 6+ after validating pattern.
- **Acceptance:** Read-only property display in panel is sufficient for MVP.

**Gap 4: File upload backend**
- **Issue:** `/file` and `/image` slash commands need storage. Base64 in markdown (bloats documents), local filesystem via Tauri (not available yet), or CloudKit (future feature).
- **Validation:** Phase 1 uses base64 data URLs for simplicity. Phase 6+ migrates to Tauri FS after desktop build ships.
- **Acceptance:** Images work, even if stored inefficiently in MVP.

**Gap 5: Mobile keyboard behavior**
- **Issue:** Native text selection handles (iOS/Android) appear above slash menu, blocking interaction. No CSS can override mobile browser z-index.
- **Validation:** Desktop-first for MVP. Mobile support deferred to separate phase.
- **Acceptance:** Desktop experience complete, mobile is known limitation.

## Sources

### Primary (HIGH confidence)

**TipTap Official Documentation:**
- [Extensions API](https://tiptap.dev/docs/editor/core-concepts/extensions) — Extension system, priority ordering
- [Keyboard Shortcuts](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts) — Shortcut API, conflict resolution
- [Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension) — Custom nodes with React components
- [React Integration](https://tiptap.dev/docs/editor/getting-started/install/react) — ReactNodeViewRenderer, useEditor hook
- [Performance Guide](https://tiptap.dev/docs/guides/performance) — `shouldRerenderOnTransaction: false` pattern
- [Markdown Support](https://tiptap.dev/docs/editor/markdown) — Markdown serialization API

**npm Package Verification:**
- [@tiptap/extension-details v3.4.2](https://www.npmjs.com/package/@tiptap/extension-details) — Toggle blocks, published 2026-02-13
- [@tiptap/extension-character-count v3.19.0](https://www.npmjs.com/package/@tiptap/extension-character-count) — Word/character count
- [@tiptap/extension-file-handler v3.19.0](https://www.npmjs.com/package/@tiptap/extension-file-handler) — File drop/paste detection

**Apple Notes:**
- [Keyboard Shortcuts and Gestures](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac) — Official Apple documentation, 53 shortcuts
- [Smart Folders](https://support.apple.com/guide/notes/use-smart-folders-apd58edc7964/mac) — Tag-based filters

**Notion:**
- [Using Slash Commands](https://www.notion.com/help/guides/using-slash-commands) — Official documentation, 30+ commands
- [Relations & Rollups](https://www.notion.com/help/relations-and-rollups) — Database features
- [Notion AI Autofill](https://www.notion.com/help/autofill) — AI features (deferred to Phase 4+)

**Obsidian:**
- [Graph View](https://help.obsidian.md/plugins/graph) — Network visualization
- [Canvas](https://help.obsidian.md/plugins/canvas) — Infinite whiteboard (deferred)
- [Dataview Plugin](https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/) — Inline property syntax

### Secondary (MEDIUM confidence)

**TipTap GitHub Issues:**
- [#4491: Editor notoriously slow with large content](https://github.com/ueberdosis/tiptap/issues/4491) — Performance patterns
- [#5031: Performance issue with large documents](https://github.com/ueberdosis/tiptap/issues/5031) — Re-render lag
- [#5654: Memory leak when discarding editors](https://github.com/ueberdosis/tiptap/issues/5654) — Cleanup patterns
- [#2547: Potential memory leak with mentions](https://github.com/ueberdosis/tiptap/issues/2547) — Extension leaks
- [#265: LinkBubbleMenu not displayed in MUI Dialog](https://github.com/sjdemartini/mui-tiptap/issues/265) — Z-index conflicts

**Security Research:**
- [Joplin CVE: XSS when pasting HTML](https://github.com/laurent22/joplin/security/advisories/GHSA-m59c-9rrj-c399) — Paste vulnerability
- [$1,000 Bounty: Stored XSS in Trix Editor](https://medium.com/h7w/1-000-bounty-stored-xss-in-trix-editor-v2-1-1-via-malicious-paste-payload-4fa413fcde28) — Real exploit

**Community Resources:**
- [Obsidian Must-Have Plugins for 2026](https://www.dsebastien.net/the-must-have-obsidian-plugins-for-2026/) — Plugin ecosystem analysis
- [BlockNote - Notion-style Editor on TipTap](https://github.com/TypeCellOS/BlockNote) — Reference implementation

### Tertiary (LOW confidence)

**UX Research:**
- [Why ContentEditable is Terrible](https://medium.engineering/why-contenteditable-is-terrible-122d8a40e480) — Mobile keyboard issues
- [React Folder Structure Best Practices 2025](https://www.robinwieruch.de/react-folder-structure/) — Component organization

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
*Phase count: 5 phases (16-23 days)*
*Critical blockers: Markdown serialization (Phase 1), D3.js embed spike (Phase 5)*
