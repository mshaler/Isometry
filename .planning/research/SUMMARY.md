# Project Research Summary

**Project:** Three-Canvas Notebook Integration for Isometry v4
**Domain:** Knowledge Management with Polymorphic Data Visualization
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

Isometry v4 already has a substantial Three-Canvas Notebook implementation (~10,554 lines). The foundation is operational: NotebookLayout with resize dividers, NotebookContext with full state management, CaptureComponent with MDEditor and slash commands, PreviewComponent with SuperGrid integration, and GSD GUI components. The challenge is not building from scratch, but completing the remaining 30-40% of functionality to reach production quality.

Research reveals three critical gaps: (1) Shell integration needs real Claude Code process spawning and WebSocket routing (currently stubs), (2) PreviewComponent needs multi-visualization support beyond SuperGrid (Network, Data Inspector tabs are 5% complete), and (3) cross-canvas data flow needs live synchronization (currently requires manual refresh). The stack is proven (TipTap v3.19.0, xterm.js v6.0.0, Anthropic SDK v0.74.0), but implementation requires careful attention to six critical pitfalls, particularly TipTap re-render performance (`shouldRerenderOnTransaction: false`), Claude API rate limiting with queue-based architecture, and context cascade re-renders via split Context pattern.

The roadmap should prioritize completing Shell integration (40% of remaining work), then enhancing Preview visualizations (30%), then live data synchronization (20%), and finally polish (10%). This order matches dependency chains: Shell completion unblocks GSD workflow integration, Preview enhancements validate PAFV projections for notebook cards, and live sync requires both to be stable.

## Key Findings

### Recommended Stack (Additions Only)

The base stack (React 18, sql.js, D3.js v7, shadcn/ui) is validated and operational. Research identifies targeted additions for completing notebook functionality:

**Core technologies:**
- **@tiptap/react v3.19.0**: Block editor for Capture pane — headless architecture with ProseMirror foundation, officially maintained. TipTap integration is already started (MDEditor currently used), but TipTap provides better extensibility for slash commands and custom blocks. The February 2026 v3 release improved Markdown support specifically for AI use cases.
- **@anthropic-ai/sdk v0.74.0**: Claude API integration for Shell AI tab — official TypeScript SDK with MCP helpers, streaming support, comprehensive error handling. Released Feb 7, 2026. Infrastructure exists but no real process spawning yet.
- **@xterm/xterm v6.0.0**: Terminal emulator (UPGRADE from current v5.5.0) — GPU-accelerated renderer, TypeScript-native, zero dependencies. v6 released Dec 2025 with synchronized output support. ShellComponent terminal tab is 60% done, needs completion.

**Supporting libraries:**
- **@harshtalks/slash-tiptap**: Lightweight slash command extension using cmdk (already in shadcn/ui stack). For Notion-style `/` command palette.
- **@xterm/addon-webgl v0.19.0**: WebGL2 renderer for better terminal performance. Fallback to existing canvas addon if unsupported.
- **@tiptap/extension-markdown v3.19.0**: Bidirectional Markdown support for `.md` import/export. Early v3 release, test thoroughly for edge cases.

**What NOT to add:**
- Y.js/CRDT (real-time collab) — not needed for single-user local-first, adds 200KB+ bundle for unused features
- Lexical/Slate alternatives — TipTap's ProseMirror foundation is more mature
- xterm-for-react wrapper — use xterm.js directly with React hooks (cleaner, better control)

### Expected Features

**Already implemented (DO NOT reimplement):**
- Three-pane layout with resize dividers
- NotebookContext state management (card CRUD, templates)
- CaptureComponent with MDEditor and slash commands
- PreviewComponent SuperGrid tab integration
- GSD GUI Dashboard and Command Builder
- Template system (6 built-in templates)
- Keyboard shortcuts

**Must complete for v1 (table stakes):**
- **TipTap editor upgrade**: Replace MDEditor with TipTap for better extensibility and performance (`shouldRerenderOnTransaction: false` critical for >1,000 char documents)
- **Bidirectional links `[[page]]`**: Create LPG edges on save, autocomplete on `[[` input
- **Shell Claude Code integration**: Real process spawning, WebSocket routing, copy/paste support
- **Shell Claude AI tab**: Streaming API integration with MCP, rate limit queue architecture
- **Preview Network tab**: D3 network visualization for graph relationships
- **Preview Data Inspector tab**: SQL query interface, table view, data export
- **Live data sync**: Auto-refresh Preview when Capture saves, bidirectional selection sync

**Should have (competitive advantage):**
- **Notebook cards in PAFV grid**: Notes participate in SuperGrid projections (schema already supports this, just needs LEFT JOIN in D3 queries)
- **Shell output → card capture**: `@save-card` annotation captures terminal output as nodes
- **Properties panel LATCH integration**: Tag/folder/priority mapping to LATCH axes for filtering

**Defer to v2+ (premature):**
- D3 visualization blocks in editor (high complexity, unclear demand)
- Formula bar with PAFV functions (already planned for SuperCalc Phase 45)
- GSD GUI rich output parsing (depends on Claude Code integration patterns)
- Version history per block (complex conflict UI)

### Architecture Approach

Integration follows provider composition pattern — existing providers (FilterContext, PAFVContext, SelectionContext) remain unchanged. NotebookContext joins at the same level, managing `notebook_cards` table while leveraging existing LATCH filtering infrastructure.

**Major components (existing, need completion):**
1. **CaptureComponent** (70% done) — Replace MDEditor with TipTap, add bidirectional links autocomplete, integrate properties panel with FilterContext
2. **ShellComponent** (35% done) — Terminal tab needs copy/paste and real Claude Code WebSocket. Claude AI tab needs streaming API integration. GSD GUI tab needs execution routing (currently 70% UI-only).
3. **PreviewComponent** (50% done) — SuperGrid tab works. Network and Data Inspector tabs are stubs (5% complete). Need tab-specific D3 renderer routing via ViewEngine.
4. **NotebookContext** (90% done) — Core CRUD operations implemented. Needs integration testing with sql.js triggers and FTS5 search for `notebook_cards` table.

**Key pattern: React controls, D3 renders**
React renders one `<div ref={containerRef} />`. D3 populates it with data via `.join()`. React never touches data DOM elements. This pattern is proven in existing SuperGrid, must maintain for Network/Timeline views.

**Critical integration point: notebook_cards in PAFV projections**
`notebook_cards` table extends `nodes` with notebook-specific metadata via one-to-one `node_id` join. D3 renderers must use LEFT JOIN to include notebook cards in all visualizations. Bidirectional sync trigger propagates SuperGrid LATCH edits back to `notebook_cards.properties`.

### Critical Pitfalls

Research identified 6 critical and 5 moderate pitfalls. Top 5 for completion work:

1. **TipTap re-renders on every keystroke** — Default behavior re-renders on every transaction, causing severe lag with >1,000 characters. **Prevention:** Set `shouldRerenderOnTransaction: false` in `useEditor` config. Isolate editor with `React.memo` to prevent parent re-renders cascading. Test with 10,000 character documents.

2. **Claude API rate limit cascading failures** — Multiple Shell tabs making concurrent requests hit 429 errors without exponential backoff, triggering acceleration limits that persist for hours. **Prevention:** Queue-based architecture with proactive header monitoring (throttle at <5 requests remaining). Implement prompt caching (5x effective throughput). Test with 5 concurrent Shell tabs.

3. **Three-pane context cascade re-renders** — Capture edit triggers NotebookContext update → re-renders Shell and Preview → D3 re-initializes → loses zoom state, re-queries database → 500ms-2s freeze. **Prevention:** Split NotebookContext into NotebookDataContext (changes frequently), NotebookAPIContext (stable), NotebookLayoutContext (independent). Memoize Context Provider values. Test by editing in Capture while monitoring Shell/Preview re-renders in React DevTools.

4. **D3 memory leaks from event listeners** — Preview pane switches views, React unmounts component, but D3 event listeners persist on detached DOM nodes. After 10+ switches, browser memory grows 50-100MB. **Prevention:** Remove event listeners in `useEffect` cleanup: `svg.on('.zoom', null)`, `nodes.on('click', null)`. Test with 20 view switches and Memory Profiler.

5. **Notebook card sync conflicts with PAFV projections** — Capture creates notebook card with minimal LATCH data. SuperGrid displays it in "undefined" column. User edits LATCH in SuperGrid → updates `nodes` table → doesn't propagate to `notebook_cards.properties`. **Prevention:** Create bidirectional sync trigger. Use materialized view `notebook_nodes_view` for queries. Transaction ensures atomic node + notebook_cards creation with complete LATCH metadata.

**Security critical:**
- **xterm.js RCE via DCS sequences** — Terminal input (from AI, clipboard, data sources) can contain malicious Device Control Strings. **Prevention:** Sanitize ANSI escapes, whitelist file paths in Tauri config, disable DCS sequences entirely. Show paste preview for suspicious patterns.

## Implications for Roadmap

Based on existing implementation status, suggested completion phases:

### Phase 1: Shell Integration Completion (2 weeks)
**Rationale:** Shell is 35% complete but blocks GSD workflow integration. Terminal tab infrastructure exists, needs Claude Code WebSocket and real process spawning. Dependencies are clear (Anthropic SDK, xterm.js), patterns are proven.

**Delivers:**
- Real Claude Code process spawning via WebSocket
- Shell Terminal tab: copy/paste, command history, CWD display
- Shell Claude AI tab: streaming API integration with queue-based rate limiting
- Shell GSD GUI tab: command execution routing (currently UI-only)

**Addresses:**
- Claude API rate limit cascading failures (queue architecture)
- xterm.js security (sanitize DCS sequences, Tauri file scope restrictions)
- Terminal state isolation (CWD as ref, not state)

**Avoids:**
- Pitfall N2 (Claude API rate limits) via queue with exponential backoff
- Pitfall N3 (xterm.js RCE) via input sanitization and Tauri permissions
- Pitfall N4 (context cascade) by isolating TerminalContext as ref-based

**Research flag:** No additional research needed. Official Anthropic SDK docs and xterm.js patterns are comprehensive.

---

### Phase 2: Preview Visualization Expansion (2 weeks)
**Rationale:** Preview pane is 50% complete (SuperGrid works, other tabs are stubs). D3 renderers exist for Network and Timeline views in separate files, just need routing via PreviewComponent tab system. Depends on notebook_cards LEFT JOIN pattern.

**Delivers:**
- Preview Network tab: D3 force-directed graph for GRAPH relationships
- Preview Data Inspector tab: SQL query interface, table view, export
- Preview Timeline tab: temporal LATCH projection (due dates, event times)
- Multi-visualization tab persistence (viewport state per tab)

**Uses:**
- Existing D3.js v7 patterns (`.join()` with key functions)
- Existing ViewEngine router infrastructure
- sql.js LEFT JOIN for `notebook_cards` in all views

**Implements:**
- Preview tab routing with ViewEngine selection
- Notebook cards in PAFV projections (LEFT JOIN `notebook_cards`)
- Synchronized selection state (click in Preview → highlight in Capture)

**Avoids:**
- Pitfall N6 (D3 memory leaks) via `useEffect` cleanup for event listeners
- Pitfall N5 (notebook sync conflicts) via bidirectional trigger and materialized view
- Pitfall 4 (React-D3 DOM conflicts) by maintaining React controls/D3 renders boundary

**Research flag:** No additional research needed. D3 Network and Timeline patterns are established. Data Inspector is standard SQL interface.

---

### Phase 3: TipTap Editor Migration (1 week)
**Rationale:** CaptureComponent is 70% complete but uses MDEditor (limited extensibility). TipTap provides better slash command integration, bidirectional links, and performance for large documents. Can be done in parallel with Phase 2.

**Delivers:**
- TipTap editor with `shouldRerenderOnTransaction: false` (performance)
- Bidirectional links `[[page]]` with autocomplete
- Enhanced slash commands (`/save-card`, `/send-to-shell`, `/insert-viz`)
- Properties panel integrated with LATCH filters

**Uses:**
- @tiptap/react v3.19.0
- @harshtalks/slash-tiptap for command palette
- @tiptap/extension-markdown for import/export
- Existing NotebookContext for card CRUD

**Implements:**
- Custom TipTap extensions for bidirectional links
- Slash command system integrated with NotebookContext
- LATCH properties panel mapped to FilterContext

**Avoids:**
- Pitfall N1 (TipTap re-renders) via `shouldRerenderOnTransaction: false` config
- Pitfall N4 (context cascade) by using split NotebookAPIContext for stable callbacks

**Research flag:** Low priority. TipTap docs are comprehensive. Slash command extension is community-maintained but actively updated.

---

### Phase 4: Live Data Synchronization (1 week)
**Rationale:** Cross-canvas data flow currently requires manual refresh. Depends on Phases 1-3 being stable (Shell saves, Preview displays, Capture edits must all work reliably). Uses sql.js triggers for change notification.

**Delivers:**
- Auto-refresh Preview when Capture saves card
- Bidirectional selection sync (click in Preview → scroll to block in Capture)
- Live FTS5 search across all notebook cards
- Change notification via sql.js custom functions

**Uses:**
- sql.js triggers for INSERT/UPDATE on `notebook_cards`
- React Context for selection state propagation
- D3 `.join()` for efficient re-render on data change

**Implements:**
- DatabaseService change notification hooks
- SelectionContext integration with CaptureComponent scroll position
- FTS5 search with `notebook_cards_fts` virtual table

**Avoids:**
- Pitfall N4 (context cascade) by using memoized data subscriptions
- Pitfall N5 (sync conflicts) via bidirectional trigger (already in Phase 2)

**Research flag:** Medium priority. sql.js custom functions for change notification may need experimentation.

---

### Phase 5: Polish and Performance (1 week)
**Rationale:** All functional pieces complete, but need integration testing, performance profiling, and UX refinement. Tests 10,000+ notebook cards, validates memory usage, ensures <100ms render times.

**Delivers:**
- Performance testing with 10,000+ cards
- Memory profiling (20+ view switches, stable heap)
- UX improvements (loading states, error recovery, keyboard shortcuts)
- Documentation and onboarding templates

**Addresses:**
- All "Looks Done But Isn't" checklist items from PITFALLS.md
- Performance traps validation (TipTap with >10K chars, Claude API under load)
- Security validation (terminal input sanitization, file access restrictions)

**Research flag:** None. This is validation, not new functionality.

---

### Phase Ordering Rationale

**Sequential dependencies:**
1. Shell (Phase 1) must complete before GSD workflow integration can function
2. Preview expansion (Phase 2) depends on notebook_cards sync being proven
3. Live sync (Phase 4) requires all panes to be stable and tested

**Parallelizable:**
- TipTap migration (Phase 3) can overlap with Preview expansion (Phase 2)
- Both are isolated to their respective components with minimal cross-dependencies

**Risk mitigation:**
- Shell first minimizes Claude API integration risk early (queue architecture tested)
- Preview second validates PAFV projection patterns before adding complexity
- TipTap third ensures editor performance doesn't block other work
- Live sync fourth waits until all data sources are reliable

### Research Flags

**No additional research needed:**
- **Phase 1 (Shell):** Official Anthropic SDK docs (v0.74.0) and xterm.js security guide are comprehensive. MCP integration patterns documented.
- **Phase 2 (Preview):** D3 Network and Timeline patterns are established in existing codebase. Data Inspector is standard SQL interface.
- **Phase 5 (Polish):** Validation phase, no new domains.

**Low priority research:**
- **Phase 3 (TipTap):** Community slash command extension (@harshtalks/slash-tiptap) is actively maintained, but production-readiness should be verified during implementation. Fallback: build directly on `@tiptap/suggestion` plugin.

**Medium priority research (validation during implementation):**
- **Phase 4 (Live Sync):** sql.js custom functions for change notification may need experimentation. Documentation is sparse. Alternative: polling with debounce.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies validated in production (TipTap, xterm.js, Anthropic SDK). Versions confirmed stable (Feb 2026). |
| Features | HIGH | Existing implementation provides clear completion roadmap. Feature prioritization based on proven patterns (Notion, Obsidian, JupyterLab). |
| Architecture | HIGH | Existing NotebookContext and three-canvas layout operational. D3/React boundaries proven in SuperGrid. Provider composition pattern validated. |
| Pitfalls | HIGH | Pitfalls derived from official docs (TipTap performance guide, Claude API rate limits, xterm.js security advisory) and React Context performance research. |

**Overall confidence:** HIGH

### Gaps to Address

**Implementation validation needed:**
- **@harshtalks/slash-tiptap production-readiness:** Community package, actively maintained, but verify in testing before committing to architecture. Fallback: build slash commands directly on `@tiptap/suggestion` plugin.
- **sql.js change notification pattern:** Documentation sparse for custom functions. May need to implement polling with debounce as fallback. Test both approaches in Phase 4.
- **xterm.js v6 upgrade compatibility:** Breaking changes minimal (v5 → v6), but existing terminal integration uses v5.5.0. Verify addons compatible before upgrading.

**Technical debt to monitor:**
- **Existing MDEditor removal:** CaptureComponent uses MDEditor currently. TipTap migration (Phase 3) must preserve all existing slash commands and autosave behavior. Test migration path with real notebook data before committing.
- **GSD GUI WebSocket routing:** Infrastructure exists but no real execution. Shell completion (Phase 1) unblocks this, but GSD GUI may need refactoring if Claude Code output format differs from assumptions.

**Deferred features (revisit post-v1):**
- **D3 visualization blocks in editor:** Complex TipTap extension requiring ReactNodeViewRenderer. Unclear if users prefer inline viz vs Preview pane. Validate demand before implementing.
- **GSD GUI rich output parsing:** Depends on Claude Code integration patterns stabilizing. Parser may need redesign once real Claude Code output is tested at scale.

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) — Official docs, updated Feb 6, 2026
- [TipTap React Performance](https://tiptap.dev/docs/examples/advanced/react-performance) — `shouldRerenderOnTransaction: false` critical setting
- [Anthropic TypeScript SDK v0.74.0](https://github.com/anthropics/anthropic-sdk-typescript) — Released Feb 7, 2026
- [Claude API Rate Limits](https://platform.claude.com/docs/en/api/rate-limits) — Official rate limiting documentation
- [@xterm/xterm v6.0.0 npm](https://www.npmjs.com/@xterm/xterm) — Released Dec 22, 2025
- [xterm.js Security Guide](https://xtermjs.org/docs/guides/security/) — DCS sequence sanitization

**Feature research:**
- [Notion blocks explained](https://lilys.ai/en/notes/notion-for-beginners-20251022/notion-blocks-explained-beginners-guide) — Block-based editor UX patterns
- [Obsidian Properties documentation](https://help.obsidian.md/Editing+and+formatting/Properties) — LATCH metadata patterns
- [Obsidian Bases vs Notion databases](https://www.xda-developers.com/notion-databases-great-but-obsidian-bases-better/) — Dynamic schema comparison

**Architecture patterns:**
- [How to Handle React Context Performance Issues (2026)](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view) — Split context pattern
- [How to write performant React apps with Context](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context) — Memoization strategies

**Pitfalls research:**
- [TipTap Integration Performance](https://tiptap.dev/docs/guides/performance) — Re-render prevention
- [Claude API Rate Limits: Production Scaling Guide](https://www.hashbuilds.com/articles/claude-api-rate-limits-production-scaling-guide-for-saas) — Queue architecture
- [Don't Trust This Title: Terminal ANSI Exploits](https://www.cyberark.com/resources/threat-research-blog/dont-trust-this-title-abusing-terminal-emulators-with-ansi-escape-characters) — Security vulnerabilities
- [Pitfalls of overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/) — Context cascade patterns

### Secondary (MEDIUM confidence)

**Stack alternatives:**
- [@harshtalks/slash-tiptap npm](https://www.npmjs.com/package/@harshtalks/slash-tiptap) — Community package, actively maintained
- [TipTap Markdown Extension](https://tiptap.dev/docs/editor/markdown) — Early v3 release, may have edge cases

**Competitor analysis:**
- [JupyterLab terminal integration](https://www.programming-helper.com/tech/jupyter-2026-interactive-notebooks-data-science-python) — Terminal UX patterns
- [NotebookLM 2026 update](https://www.lbsocial.net/post/notebooklm-2026-update-knowledge-database) — Knowledge database workflows

### Tertiary (existing codebase analysis)

**Architecture validation:**
- `/Users/mshaler/Developer/Projects/Isometry/CLAUDE.md` — Existing architecture truth
- `/Users/mshaler/Developer/Projects/Isometry/src/contexts/NotebookContext.tsx` — Existing 384-line implementation
- `/Users/mshaler/Developer/Projects/Isometry/src/components/notebook/NotebookLayout.tsx` — Existing 278-line three-pane layout
- `/Users/mshaler/Developer/Projects/Isometry/src/db/schema.sql` — `notebook_cards` table schema with FTS5 triggers

**Implementation status:**
- CaptureComponent.tsx (521 lines) — 70% complete
- ShellComponent.tsx (354 lines) — 35% complete
- PreviewComponent.tsx (472 lines) — 50% complete
- GSD GUI components (~3,069 lines) — 70% UI-only, needs execution

---

*Research completed: 2026-02-10*
*Ready for roadmap: yes*
*Focus: Completion of existing implementation, not greenfield development*
