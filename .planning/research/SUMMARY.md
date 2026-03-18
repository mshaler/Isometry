# Project Research Summary

**Project:** Isometry — Notebook Card Editor (v7.1)
**Domain:** Card editor with typed property editing, inline creation, and multi-density rendering inside an existing local-first data projection app
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

This milestone adds a full card editor to the existing Isometry Workbench. The product already has 90 phases of battle-tested infrastructure: MutationManager as the sole write gate, SelectionProvider for ephemeral card selection, WorkerBridge for typed async sql.js RPC, and a 5-panel WorkbenchShell. The card editor is not a greenfield build — it is a carefully scoped integration that wires two new UI components (`CardEditorPanel`, `CardPropertyFields`) into existing provider infrastructure. No new runtime dependencies are required. All new features compose existing capabilities using native HTML inputs, existing D3 patterns, and established mutation/selection patterns already present in the codebase.

The recommended approach is a shadow-buffer architecture: on card selection, capture a `_snapshot` of the full card row, maintain a mutable `_buffer` in memory as the user edits, and commit a single `updateCardMutation(id, snapshot, diff)` on session end (blur, card-switch, or Cmd+S). This is a deliberate deviation from the existing NotebookExplorer's 500ms debounce-to-`ui_state` pattern — MutationManager's 100-step undo history cannot absorb per-keystroke or per-debounce mutations. The existing NotebookExplorer must also be migrated from `ui_state` to `cards.content` in this milestone; that migration is non-deferrable and ships as the first implementation step.

The highest risks center on three invariants that must not be violated: (1) `createCardMutation` must not fire until a non-empty name is committed — not on first keystroke — requiring a three-state machine (`idle → buffering → editing`); (2) `SelectionProvider.select(newCardId)` must be called explicitly after card creation since MutationManager has no selection awareness; and (3) the `mutated` CloudKit changeset must be dispatched after every card-writing mutation or new cards will silently fail to sync to other devices. All three are entirely preventable with correct sequencing established before any `input` handler is wired.

---

## Key Findings

### Recommended Stack

No new npm dependencies are needed. The implementation is additive and uses only what is already in the codebase. Native HTML inputs (`<input type="date">`, `<input type="number">`, `<input type="text">`, `<select>`) handle all property editor affordances — WKWebView on macOS 14+ / iOS 17+ renders native date pickers and number spinners without a library. Card dimension scaling (1x/2x/5x/10x) uses CSS `transform: scale()` with `[data-card-size]` attribute toggling — GPU-accelerated, zero D3 layout math changes.

**Core technologies:**
- Native HTML inputs — typed property editors — zero bundle cost, WKWebView-native affordances for all field types
- `createCardMutation` / `updateCardMutation` (existing) — undo-safe card writes — the only correct write path through MutationManager
- `bridge.send('card:get')` (existing) — before-state capture for mutation inverse — fast in-memory sql.js lookup (~1ms)
- CSS `transform: scale()` + `[data-card-size]` attribute — card dimension rendering — GPU-composited layer, no D3 layout changes required
- `ui_state` key convention (`dimension:{cardId}`) — dimension persistence — avoids schema migration, consistent with existing Tier 2 pattern

### Expected Features

The Card schema has 26 columns covering all editor needs. The property editor is constrained to existing columns — no schema changes required for v1.

**Must have (table stakes):**
- Title inline edit — read-only title is a dead end; foundational for any card editor
- Content markdown editor — reuse NotebookExplorer textarea+preview directly (zero new code for the core editor)
- Properties panel (mapped to existing columns) — expose url, due_at, event_start, event_end, location_name, status, priority, folder, tags via typed inputs
- Card type display + preset property list — show type-relevant fields per card_type; type is immutable after creation
- Card delete from editor — soft delete via MutationManager; undo restores via existing undeleteCard inverse
- 1x and 2x card dimensions — compact row and icon+preview sizes for list/gallery views
- Save feedback — ActionToast "Saved" flash on flush

**Should have (competitive):**
- Start-typing card creation — ghost input at top; first committed name creates card via state machine
- Tag chip editor — chips are polish over plain comma-separated text input
- 5x card tile — medium-density tile with content preview (50-100 chars, markdown-stripped)
- Card type-contextual property presets — auto-populate relevant fields per card_type, reducing decision fatigue

**Defer (v2+):**
- 10x hero / full-page editor — requires WorkbenchShell panel zone changes; scope too large for this milestone
- Freeform custom properties — schema migration required; breaks FTS and SuperGrid axis assignment
- card_type mutation after creation — architectural invariant; use copy+delete workaround if needed

### Architecture Approach

The architecture extends the existing selection-driven panel binding pattern. `CardEditorPanel` subscribes to `SelectionProvider`, captures a `_snapshot` on card load, accumulates edits in a `_buffer`, and commits via `MutationManager.execute()` on session end. `NotebookExplorer` gains a `MutationManager` constructor injection (currently absent) and migrates from `ui_state`-backed persistence to `cards.content`-backed persistence. Both panels own distinct field sets — NotebookExplorer owns `content`; CardEditorPanel owns all other fields — with independent snapshots and buffers per field set.

**Major components:**
1. `CardEditorPanel` (NEW) — full property editor for 26-column schema; subscribes to SelectionProvider; shadow-buffer + session-commit pattern; draft buffer for new card creation
2. `CardPropertyFields` (NEW) — typed input widgets: tag pill editor, ISO date input, card_type/status select, priority stepper; can be built and unit-tested in isolation
3. `NotebookExplorer` (MODIFIED) — inject MutationManager; replace 500ms-debounce-to-ui_state with shadow-buffer; implement one-time legacy migration from `notebook:{cardId}` keys to `cards.content`
4. `WorkbenchShell` (POSSIBLY MODIFIED) — may need new CollapsibleSection entry for CardEditorPanel (currently 5 sections)
5. `main.ts` (MODIFIED) — inject mutationManager into NotebookExplorer (currently absent); mount CardEditorPanel in WorkbenchShell

### Critical Pitfalls

1. **Start-typing fires `createCardMutation` on first keystroke** — define a three-state machine (`idle → buffering → editing`) before writing any `input` handler; only call `createCardMutation` when `name.trim() !== ''` at commit time (blur/Cmd+S), never on the raw `input` event. Prevents ghost cards, IME composition cards, and undo-stack corruption.

2. **Stale `before` snapshot in `updateCardMutation` corrupts undo inverse** — capture `_snapshot = card` in `_onSelectionChange()` the moment the card loads, not at commit time. Use a mutation sequencer (`_mutationQueue` Promise chain) to ensure each mutation builds its `before` state after the prior `execute()` has fully resolved. Silent NULL restoration of unrelated fields is the failure signature.

3. **`ui_state` notebook content survives migration, overwriting `cards.content`** — run a one-time `notebook:migration:v1` sentinel-guarded migration on NotebookExplorer mount: read all `ui_state` rows with `key LIKE 'notebook:%'`, write `cards.content` via `updateCardMutation` if NULL, then DELETE the `ui_state` rows. Non-deferrable — must ship in Phase 1.

4. **`SelectionProvider` not updated after `createCardMutation`** — MutationManager has no selection awareness. After `await execute(createMutation)`, explicitly call `selection.select(newCardId)`. Use a `buildCreateCardMutation(input)` factory that returns `{ mutation, cardId }` so the card UUID is available before `execute()` is called.

5. **CloudKit changeset not dispatched after card writes** — MutationManager sets the dirty flag but does NOT send the `mutated` bridge message. After every card-writing `execute()`, dispatch `mutated` with the card changeset. A shared `dispatchMutation(cardId)` helper must be extracted and reused — do not inline changeset construction per-editor. New cards silently invisible on other devices is the failure signature.

---

## Implications for Roadmap

Based on research, three phases emerge naturally from the dependency structure and pitfall mapping. Phase 1 is the foundation; Phases 2 and 3 can proceed sequentially after it.

### Phase 1: MutationManager Integration + Notebook Migration

**Rationale:** The most foundational and highest-risk work. Establishes all shared infrastructure that Phases 2 and 3 depend on. The `ui_state` migration is non-deferrable — it must ship before any property editor reads `cards.content`. The three-state card creation state machine, stale snapshot serializer, SelectionProvider wiring after creation, and CloudKit changeset dispatch helper must all be established here. All ten pitfalls have their critical prevention steps here or here-adjacent.

**Delivers:** NotebookExplorer migrated to MutationManager + `cards.content`; legacy `notebook:{cardId}` ui_state content migrated; `buildCreateCardMutation` factory pattern; start-typing card creation state machine (`idle → buffering → editing`); `dispatchMutation` CloudKit helper; MutationManager subscriber in NotebookExplorer for undo-delete safety; seam tests for the full creation and migration paths.

**Addresses:** Title inline edit (P1), Content markdown editor (P1), Card delete (P1), Start-typing card creation (P2), Save feedback (P1)

**Avoids:** Pitfalls 1, 2, 3, 6, 7, 10

### Phase 2: CardEditorPanel + Typed Property Fields

**Rationale:** Depends on Phase 1 infrastructure (MutationManager injection, shadow-buffer pattern, `buildCreateCardMutation` factory). `CardPropertyFields` can be built and unit-tested in isolation before wiring into CardEditorPanel. The `coerceCardField` utility and full-card `_snapshot` caching established here prevent the type coercion and partial-before-state pitfalls that would otherwise cause silent data corruption on undo (fields not explicitly captured get NULLed on undo).

**Delivers:** `CardPropertyFields` typed input widgets (tag pill, ISO date, select, stepper); `CardEditorPanel` with all 26-column field support; `CardEditorState` snapshot caching; `coerceCardField` utility for numeric fields; WorkbenchShell integration; unit tests verifying single-field undo does not NULL other fields.

**Addresses:** Properties panel (P1), Card type display (P1), Add/remove visible properties (P2), Tag chip editor (P2), Card type-contextual presets (P2)

**Avoids:** Pitfalls 4, 8

### Phase 3: Card Dimension Rendering (1x/2x/5x/10x)

**Rationale:** Independent of Phases 1 and 2 — no dependency on CardEditorPanel or the mutation refactor. Can be planned as a parallel track or as a follow-on after Phase 2 ships. Must establish `ui_state` key convention (`dimension:{cardId}`) before any dimension UI is built to prevent the parallel-state pitfall (D-005 violation — no module-level Map). CSS `transform: scale()` approach requires zero D3 layout changes, making this the lowest-risk phase.

**Delivers:** 1x/2x/5x/10x CSS dimension system; `[data-card-size]` attribute propagation in CardRenderer and views; `ui_state`-backed dimension persistence per card; dimension selector UI in Workbench toolbar or view tab bar; 5x card tile with markdown-stripped content preview.

**Addresses:** 1x/2x card dimensions (P1), 5x card tile (P2)

**Avoids:** Pitfall 9

### Phase Ordering Rationale

- Phase 1 before Phase 2: `CardEditorPanel` requires MutationManager injection in `main.ts` and the `buildCreateCardMutation` factory established in Phase 1. The `ui_state` migration must complete before CardEditorPanel reads `cards.content` — a half-migrated state creates a dual-source read conflict.
- Phase 1 before Phase 2: The shadow-buffer pattern (snapshot → buffer → commit) must be validated in NotebookExplorer before being replicated in CardEditorPanel; having a working reference reduces risk.
- Phase 3 is genuinely independent — no Phase 1 or 2 runtime dependency — but the `ui_state` key convention document (`dimension:{cardId}`) should be pre-committed as a decision record in Phase 1 to prevent parallel-state drift.
- Build order within Phase 2: `CardPropertyFields` (isolated, unit-testable, no external deps) → `CardEditorPanel` (wires fields to mutation layer) → WorkbenchShell integration (mounts panel in rail).

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** All patterns are established in the existing codebase. Shadow-buffer, selection-binding, MutationManager wiring all have direct precedents in NotebookExplorer, KanbanView, and PropertiesExplorer. Migration pattern is fully specified in Architecture research with code-level detail.
- **Phase 2:** `CardPropertyFields` typed inputs follow established HTML patterns. `CardEditorState` is a straightforward snapshot-cache class. No novel patterns.
- **Phase 3:** CSS `transform: scale()` with `[data-card-size]` is a two-line CSS pattern. `ui_state` key convention matches 12+ existing conventions in the codebase.

No phases require `/gsd:research-phase` — all integration points are verified from direct codebase inspection at HIGH confidence.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All conclusions from direct codebase inspection. No new dependencies. Existing dependency versions confirmed from package.json. WKWebView date input compatibility confirmed via WebKit changelog. |
| Features | HIGH | Derived from 26-column Card schema, existing mutations, Figma spec cross-reference, and authoritative industry sources (NNGroup, MDN, Cloudscape). |
| Architecture | HIGH | All integration points verified from reading actual source files (MutationManager.ts, inverses.ts, NotebookExplorer.ts, protocol.ts, WorkbenchShell.ts, main.ts). Shadow-buffer and selection-binding patterns have direct codebase precedents. |
| Pitfalls | HIGH | All 10 pitfalls derived from direct inspection of MutationManager, inverses.ts, schema.sql, SelectionProvider, BridgeManager.swift. Every pitfall includes a detection signature and recovery strategy. |

**Overall confidence:** HIGH

### Gaps to Address

- **card_type display vs mutation UX:** `updateCard()` explicitly forbids `card_type` changes by contract. The Figma spec shows a type selector. Clarify before Phase 2 whether the selector is display-only for existing cards (recommended) or whether a copy+delete flow should be exposed as a UI affordance.
- **WorkbenchShell panel slot:** Architecture research notes CardEditorPanel "may need" a new CollapsibleSection entry. Inspect the WorkbenchShell `SECTION_CONFIGS` before Phase 2 implementation to determine whether CardEditorPanel is a 6th section, replaces a section, or nests within the Notebook section.
- **Dimension granularity — per-card vs per-view:** Architecture research recommends `dimension:{cardId}` keyed per-card. Stack research suggests `view:card-size:{viewType}` for a global per-view toggle. Decide which granularity is correct before Phase 3 — per-card enables per-item control; per-view is consistent with how SuperDensityProvider works and is simpler to implement.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/mutations/MutationManager.ts`, `src/mutations/inverses.ts`, `src/ui/NotebookExplorer.ts`, `src/providers/SelectionProvider.ts`, `src/database/schema.sql`, `src/database/queries/types.ts`, `src/main.ts`, `src/ui/WorkbenchShell.ts`, `native/Isometry/Isometry/BridgeManager.swift`
- `.planning/TODOS.md` — captured UAT gap: "NotebookExplorer should support creating new cards" (2026-03-18)
- `package.json` — confirmed dependency versions (marked 17.0.4, dompurify 3.3.2, d3 7.9.0, sql.js 1.14.0)
- MDN `<input type="date">` — WKWebView compatibility; native picker available macOS 14+ / iOS 17+; returns YYYY-MM-DD string
- Project decisions D-001 through D-011 — `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- [Cloudscape Inline Edit](https://cloudscape.design/patterns/resource-management/edit/inline-edit/) — blur-commit pattern validation; AWS design system
- [Nielsen Norman Group — Date Input UX](https://www.nngroup.com/articles/date-input/) — display-friendly format vs ISO storage convention
- [InPlace Editor pattern — ui-patterns.com](https://ui-patterns.com/patterns/InplaceEditor) — community pattern library, inline edit design pattern
- Project memory (MEMORY.md) — milestone history, locked architectural decisions, known technical debt

---

*Research completed: 2026-03-18*
*Ready for roadmap: yes*
