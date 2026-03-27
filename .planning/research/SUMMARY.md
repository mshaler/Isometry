# Project Research Summary

**Project:** Isometry v10.0 — Smart Defaults + Layout Presets + Guided Tour
**Domain:** Additive UX milestone on existing TypeScript/D3.js/sql.js platform
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

This milestone adds three complementary features to the fully-shipped Isometry platform: dataset-aware smart defaults (auto-selecting the right view and axis configuration on first import), named layout presets (user-saveable panel/view/axis snapshots), and an in-app guided tour. All three are purely additive — no existing source file APIs change, no schema migrations are required, and all persistence routes through the existing `ui_state` key-value store via established `bridge.send('ui:set', ...)` patterns. Two new npm packages are needed (`driver.js` for tour rendering and `@floating-ui/dom` for preset picker positioning), totaling ~11 KB gzipped. Everything else extends what already exists.

The recommended approach is to build in dependency order: per-dataset state isolation and smart defaults first (they are prerequisites for everything else), then the named preset save/restore system, then the guided tour as an independent parallel track. The architecture introduces three new classes (`ViewDefaultsRegistry`, `LayoutPresetManager`, `TourEngine`) and makes targeted additions to four existing classes (`PAFVProvider`, `StateManager`, `WorkbenchShell`, `ViewManager`). All new code follows established codebase patterns: key-based serialization to `ui_state`, SchemaProvider-validated axis assignments, and `data-*` attribute targeting for DOM references.

The primary risks are all well-understood from prior Isometry milestones: schema mismatch when hardcoding field names in defaults (the pre-v5.3 mistake), provider teardown races when applying presets mid-view-switch (the v4.2 bug pattern), and tour overlay breakage after view switches. Each has a concrete prevention strategy documented in PITFALLS.md. None require new architectural patterns — they all apply existing Isometry solutions (SchemaProvider validation, `isSwitching` guard, selector-based DOM targeting).

---

## Key Findings

### Recommended Stack

The stack addition is minimal. Two runtime npm packages are needed and all other implementation extends existing patterns. `driver.js` (MIT, ~5 KB gzipped, last published November 2025) is the correct tour library — it is vanilla TypeScript with zero dependencies, targets any CSS selector, and has an imperative API that integrates cleanly with the existing `ShortcutRegistry`. The AGPL-licensed `intro.js` is incompatible with a commercial StoreKit 2 app and must be avoided. `@floating-ui/dom` (~3 KB gzipped) handles viewport-aware preset picker positioning in WKWebView where CSS anchor positioning is not yet available.

**Core technologies:**
- **driver.js 1.4.0:** In-app guided tour — MIT, vanilla TypeScript, zero dependencies, imperative API, WKWebView-compatible
- **@floating-ui/dom 1.7.5:** Preset picker popover positioning — zero dependencies, ResizeObserver-based, Safari 17+ compatible
- **ViewConfigRegistry (no install):** Static `Map<SourceType, ViewConfig>` lookup — compile-time constants, zero runtime overhead
- **PresetManager (no install):** Thin wrapper over existing `bridge.send('ui:set', ...)` — no new bridge message types

Key constraint: do NOT use `localStorage` for preset storage. Isometry uses `sql.js` as the system of record; splitting persistence across `sql.js` and `localStorage` creates two sources of truth that desync on CloudKit restore.

### Expected Features

This milestone is additive on a shipped product. The feature set is well-scoped with clear MVP boundaries.

**Must have (table stakes):**
- Per-dataset state isolation — namespaced `ui_state` keys (`pafv:{datasetId}:rowAxes`), required prerequisite for all other features; includes migration for existing flat keys
- Heuristic view selection on first import — `source_type` lookup table (~50 lines) using existing `SchemaProvider` and `CatalogWriter` metadata
- Preset PAFV axis defaults on first activation — same lookup table, calls `PAFVProvider.setState()`; must NOT overwrite existing user-configured axes
- Save named layout preset — snapshot panel states + view type + PAFV axes to `ui_state` under `preset:name:{presetName}` key
- Restore named layout preset — read from `ui_state`, apply to shell + providers; validate axis fields against current dataset's schema
- 2-3 built-in starter presets — hard-coded JSON objects (Focused / Analysis / Overview); ship alongside user preset system
- Preset list in command palette — new "Presets" category in existing Cmd+K fuzzy search
- Preset export/import as JSON file — safety valve given no CloudKit preset sync

**Should have (differentiators):**
- Dataset-type inference from `CatalogWriter` `source_type` metadata — stronger signal than field-name heuristics alone
- Presets that include PAFV axis configuration — captures "what am I analyzing," not just panel positions
- Preset validation toast on restore — reuses `StateManager._migrateState()` logic; shows "N fields not available" if axes are dropped
- "Apply as default for this dataset type" option — marks a preset with `defaultForSourceType: string[]` metadata
- Tour with state-aware step skipping — `skipIf: () => boolean` predicate per step

**Defer (v2+):**
- Preset sync via CloudKit — requires new CKRecord zone and conflict resolution; disproportionate scope for a preset feature
- Preset sharing / marketplace — needs server infrastructure; file-based export/import is sufficient for local-first philosophy
- AI-suggested axis configuration — rule-based `SchemaProvider` heuristics cover the 90% case without LLM latency or privacy concerns
- Hierarchical preset folders — flat list is sufficient; add folders only if users report having 10+ presets
- Auto-launch tour on every first session — opt-in tour via welcome panel CTA outperforms forced tours; research confirms lower completion rates for forced tours

### Architecture Approach

All new components integrate at the main-thread layer sitting above the existing provider stack. Three new classes own distinct concerns with no cross-wiring: `ViewDefaultsRegistry` is a pure lookup table (no async, no DOM, testable in unit tests); `LayoutPresetManager` orchestrates panel and provider changes on user gesture; `TourEngine` is the only component that touches DOM outside its own element (isolated in `src/tour/`). Four existing classes receive targeted additions: `PAFVProvider` gets `applyDefaults()` (non-persisting setter that routes through validated setters); `StateManager` gets `loadPreset()` (bulk-restore in single transaction); `WorkbenchShell` gets `presetSectionOrder()` (DOM reparenting by `storageKey`); `ViewManager` gets post-`switchTo()` defaults hook.

**Major components:**
1. `ViewDefaultsRegistry` — maps `source_type` to `{viewType, pafvConfig, suggestedPreset}`; pure data, no DOM; called by `ViewManager` on first import only
2. `LayoutPresetManager` — applies a named preset by calling `WorkbenchShell.presetSectionOrder()` + `PAFVProvider.applyDefaults()` + `bridge.send('ui:set', ...)`
3. `TourEngine` — DOM overlay step sequencer; reads `tour:progress` from `ui_state`; selector-based element targeting (never holds live DOM references)
4. `PAFVProvider.applyDefaults()` — sets axes via existing validated setters without triggering `StateManager` dirty-mark path
5. `WorkbenchShell.presetSectionOrder()` — DOM reparenting by `storageKey`; requires `getStorageKey()` and `getRootEl()` accessors on `CollapsibleSection` (one-line additions)

**State persistence map:**

| State | Storage | Key |
|-------|---------|-----|
| Active preset name | `ui_state` | `layout:preset` |
| Section order | `ui_state` | `layout:section-order` |
| Tour progress | `ui_state` | `tour:progress` |
| View defaults applied flag | `ui_state` | `view:defaults:applied:{datasetId}` |
| PAFVProvider axes | `ui_state` | `axis` (unchanged) |
| Section collapse state | `localStorage` | `workbench:{storageKey}` (unchanged) |

### Critical Pitfalls

1. **Schema mismatch in defaults** — Hardcoding field names like `card_type` or `folder` in preset axis configs silently breaks Reminders, Calendar, and plain Markdown imports that lack those fields. Prevention: every axis assignment routes through `PAFVProvider.applyDefaults()` which calls `schemaProvider.isValidColumn()` before setting; invalid fields are dropped or substituted by family fallback. This is the pre-v5.3 mistake — do not repeat it.

2. **Array-indexed preset panel serialization** — Storing panel states as `boolean[]` indexed by position breaks when any section is added, removed, or reordered in `SECTION_CONFIGS`. Prevention: serialize as `Record<storageKey, SectionState>` keyed by `storageKey`; deserialize by key lookup, ignoring unknown keys (forward compat) and using `defaultCollapsed` for missing keys (backward compat). Write a migration test before shipping.

3. **Provider teardown race during preset apply + view switch** — Calling `PAFVProvider.setColAxes()` while `ViewManager.switchTo()` is in progress causes `StateCoordinator` to fire a re-render against a partially mounted view. Prevention: `ViewManager` needs an `_isSwitching` flag; `LayoutPresetManager.apply()` checks `viewManager.isSwitching()` and defers via `queueMicrotask()` if switching is in progress.

4. **Tour overlay breaks after view switch** — Tour stores a live DOM reference to the highlighted element; `ViewManager.destroy()` clears `innerHTML`, leaving the spotlight pointing to `{top: 0, left: 0}`. Prevention: `TourEngine` must re-query by selector (`document.querySelector(step.targetSelector)`) on each step render; subscribe to `viewManager.onViewSwitch` to trigger re-query; enter "waiting" state if selector returns null.

5. **StateManager preset key collision** — A preset stored under a key that matches an existing registered provider key (e.g., `pafv`) causes `StateManager.restore()` to feed preset-format data into `PAFVProvider.setState()`, silently resetting the provider to defaults. Prevention: all preset keys use `preset:name:{presetName}` namespace; add an assertion in `StateManager.registerProvider()` that rejects keys starting with `preset:`.

6. **Smart defaults fire before SchemaProvider initialized after dataset switch** — `getDefaults()` called during dataset eviction uses the previous dataset's schema. Prevention: smart-default application subscribes to `SchemaProvider.subscribe()` and fires only after `SchemaProvider` emits its notification; never wire to the dataset-eviction event directly.

---

## Implications for Roadmap

Based on research, the dependency graph is clear: per-dataset isolation is the foundational structural change that must land first, smart defaults build on it, named presets build on defaults, and the tour is fully independent and can be parallelized. Suggested 3-phase structure:

### Phase 1: Foundation — Per-Dataset Isolation + Smart Defaults
**Rationale:** Per-dataset state isolation (namespaced `ui_state` keys with migration) is a prerequisite for all other features. Smart defaults ride on the same infrastructure and are low-complexity (~50-line lookup table). Shipping both together delivers the highest user-facing value per unit of risk. This phase must include the schema-aware field resolver to prevent Pitfall 1.
**Delivers:** Dataset-aware view selection on first import; per-dataset axis/view persistence; `ViewDefaultsRegistry` + modified `ViewManager` + modified `PAFVProvider`
**Addresses:** Per-dataset state isolation (HIGH value, HIGH complexity), heuristic view selection (HIGH value, LOW complexity), preset PAFV axis defaults (HIGH value, LOW complexity)
**Avoids:** Pitfall 1 (schema mismatch), Pitfall 6 (SchemaProvider race on dataset switch)
**Research flag:** Standard patterns — SchemaProvider introspection and PAFVProvider setState() are well-documented existing paths. Skip `/gsd:research-phase`.

### Phase 2: Named Layout Presets
**Rationale:** The preset system (save/restore/list/export/import + built-in presets) is self-contained once per-dataset isolation is in place. The `preset:name:{presetName}` key convention must be established before any preset is written to `ui_state` (Pitfall 5). Panel serialization must use key-based dict from day one (Pitfall 2). View-switch guard must land in this phase (Pitfall 3).
**Delivers:** Save/restore named presets; 3 built-in presets (Data Integration / Writing / LATCH Analytics); preset list in Cmd+K; JSON export/import; "Apply as default for dataset type" option
**Uses:** `@floating-ui/dom` for preset picker popover positioning; `LayoutPresetManager` + modified `WorkbenchShell` + modified `StateManager`
**Implements:** Pattern 2 (declarative section configurations), Pattern 4 (non-persisting `applyDefaults()`), Pattern 5 (DOM reparenting)
**Avoids:** Pitfall 2 (array-indexed serialization), Pitfall 3 (provider teardown race), Pitfall 5 (key collision)
**Research flag:** Standard patterns — preset serialization and WorkbenchShell panel manipulation follow established Isometry conventions. Skip `/gsd:research-phase`.

### Phase 3: Guided Tour
**Rationale:** The tour is fully independent of presets and defaults — it has no provider dependencies and persists only one `ui_state` key. It can be developed in parallel with Phase 2 or after, but is sequenced last because the tour highlights the preset picker UI (the tour's final step points to the preset feature). Ships with `driver.js` installed.
**Delivers:** 4-5 state-aware tour steps anchored to real DOM elements; opt-in launch from welcome empty state + command palette; `tour:completed:v1` persistence; step counter; non-blocking dismissal with Escape
**Uses:** `driver.js 1.4.0` (MIT, ~5 KB gzipped); `TourEngine` class; `data-tour-target` attributes on 6-8 existing DOM elements
**Implements:** Pattern 3 (pure DOM overlay with selector-based targeting)
**Avoids:** Pitfall 4 (tour overlay breaks after view switch)
**Research flag:** driver.js integration is well-documented. The view-switch recovery pattern is Isometry-specific. Confirm whether `ViewManager` currently exposes a subscription API before Phase 3 implementation.

### Phase Ordering Rationale

- Per-dataset isolation must precede presets: changing the `ui_state` key convention from flat to namespaced affects all provider serialization. Presets that capture PAFV state must use the new namespaced keys from the start.
- Smart defaults and presets are complementary: the `ViewDefaultsRegistry` provides the `suggestedPreset` field that `LayoutPresetManager` uses on first import. Building them in the same milestone ensures the integration is designed in.
- The tour is parallelizable: `TourEngine` has no dependency on the preset system except that one tour step highlights the preset picker. The `data-tour-target` attributes can be added to existing elements in Phase 2 as forward-compat prep.
- Preset batching prevents triple-flash: all provider mutations (PAFVProvider + FilterProvider + SuperDensityProvider) must be batched to avoid three sequential re-renders on preset apply.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (SchemaProvider subscribe ordering):** Verify the exact ordering of events in the v7.0 dataset eviction pipeline against current source before writing the `SchemaProvider.subscribe()` wiring. Low risk but worth confirming.
- **Phase 3 (ViewManager subscription API):** Confirm whether `ViewManager` currently exposes a view-switch subscription API for `TourEngine`. If not, a small addition to `ViewManager` is needed before tour implementation.

Phases with standard patterns (skip research-phase):
- **Phase 2 (preset serialization):** WorkbenchShell patterns and `ui_state` key conventions are thoroughly documented in existing codebase and PITFALLS.md.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Both new packages verified against official docs, npm, and codebase compatibility. Alternatives explicitly ruled out (intro.js AGPL, Popper.js deprecated, CSS anchor positioning not Safari 17 compatible). |
| Features | HIGH | Grounded in direct codebase inspection (PROJECT.md, StateManager, PAFVProvider, SchemaProvider) plus VS Code, Photoshop, Notion, and product tour UX literature. |
| Architecture | HIGH | Full codebase read across all affected files. Patterns derived from existing Isometry conventions — no speculative design. |
| Pitfalls | HIGH | Each pitfall is traced to a specific prior Isometry bug or architectural gap (v5.3 hardcoded fields, v4.2 ViewManager race, v7.0 dataset eviction pipeline). |

**Overall confidence:** HIGH

### Gaps to Address

- **StateCoordinator.pauseNotifications() API:** PITFALLS.md references batching all provider mutations on preset apply to prevent triple-flash. Confirm whether `StateCoordinator` currently has a `pauseNotifications()` method or whether it needs to be added before Phase 2 implementation.
- **CollapsibleSection collapse state storage:** Architecture shows section collapse states live in `localStorage` under `workbench:{storageKey}`. Presets that capture collapse state may need to read/write `localStorage` directly or add a `getCollapsed()` accessor. Confirm the current persisted shape before writing preset serialization.
- **ViewManager.onViewSwitch subscription:** TourEngine requires subscribing to view-switch events. Verify whether `ViewManager` currently exposes a subscription API or only notifies `StateCoordinator`.

---

## Sources

### Primary (HIGH confidence)
- Isometry `src/database/schema.sql` — `datasets.source_type` enum, `ui_state` schema, no new table needed
- Isometry `src/providers/StateManager.ts` — `bridge.send('ui:set', ...)` persistence API, `_migrateState()` key-based routing
- Isometry `src/providers/PAFVProvider.ts` — `_getSupergridDefaults()` schema-aware fallback pattern, validated setters
- Isometry `src/ui/WorkbenchShell.ts` — `SECTION_CONFIGS`, `getSectionStates()` / `restoreSectionStates()` session-state pattern
- Isometry `src/views/ViewManager.ts` — `switchTo()` destroy-before-mount, `loadingTimer` cancellation, `_isSwitching` gap
- Isometry `package.json` — confirmed neither `driver.js` nor `@floating-ui/dom` are installed
- [driver.js GitHub](https://github.com/kamranahmedse/driver.js) — v1.4.0, MIT, zero dependencies, ~5 KB gzipped
- [Floating UI docs](https://floating-ui.com/docs/getting-started) — `@floating-ui/dom` v1.7.5, 3 KB gzipped
- [VS Code Custom Layout docs](https://code.visualstudio.com/docs/configure/custom-layout) — named workspace save/restore patterns
- [Notion Views docs](https://www.notion.com/help/views-filters-and-sorts) — view defaults per property type

### Secondary (MEDIUM confidence)
- [Appcues Product Tour UX Patterns](https://www.appcues.com/blog/product-tours-ui-patterns) — 3-step completion rates, opt-in vs forced tour research
- [WhatFix Product Tours 2025](https://whatfix.com/product-tour/) — 3-5 step tours, progressive disclosure
- [npm comparison: driver.js vs intro.js vs shepherd.js](https://npm-compare.com/driver.js,intro.js,shepherd.js) — bundle size comparison
- [intro.js licensing](https://introjs.com/) — AGPL confirmed, incompatible with StoreKit 2 commercial app
- [CSS anchor positioning caniuse](https://caniuse.com/css-anchor-positioning) — partial Safari 18.2+ support, not viable for iOS 17 minimum target

### Tertiary (LOW confidence)
- Isometry `.planning/MVP-GAP-ANALYSIS.md` — onboarding gap context; welcome sheet vs. guided tour decision (internal planning doc)

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
