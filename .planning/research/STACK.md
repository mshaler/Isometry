# Stack Research

**Domain:** Smart defaults + layout presets + in-app guided tour — additive features on existing TypeScript/D3.js/sql.js platform
**Researched:** 2026-03-27
**Confidence:** HIGH (driver.js, @floating-ui/dom, zero-dependency approach), HIGH (preset serialization via existing ui_state), HIGH (dataset-to-config mapping via existing datasets table)

---

## Context: What Already Exists (DO NOT RE-RESEARCH)

The Isometry platform already has:
- **ui_state table** (key TEXT PRIMARY KEY, value TEXT) — Tier 2 persistence via `bridge.send('ui:set', { key, value })` and `bridge.send('ui:getAll', {})`
- **StateManager** — registered-provider auto-persist with debounced dirty marking; `_persist(key, provider)` writes JSON-serialized provider state
- **datasets table** — `source_type TEXT NOT NULL` column (`'apple_notes'`, `'csv'`, `'json'`, `'excel'`, `'markdown'`, `'html'`, `'sample'`) and `is_active` flag; already tracks which dataset is loaded
- **PAFVProvider, FilterProvider, SchemaProvider, SuperDensityProvider** — all expose `serialize()` / `deserialize()` round-trip; StateManager already persists them
- **CommandPalette** — fuzzy search, keyboard navigation, category grouping; already wired to `ShortcutRegistry`
- **CollapsibleSection explorer panels** — sidebar panels already use 3-state (hidden/visible/collapsed) with Tier 2 persistence
- **ThemeProvider** — CSS custom property palettes; not related to layout presets
- **DOMPurify** ^3.3.2 — already installed for XSS sanitization

**New additions are purely additive.** No existing source file API changes. Persistence uses the existing ui_state `bridge.send` pattern.

---

## Recommended Stack — New Additions Only

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **driver.js** | 1.4.0 | In-app guided tour with spotlight highlighting and annotated popovers | Written in Vanilla TypeScript, zero external dependencies, 5 KB gzipped. MIT license. No DOM framework assumptions — manipulates the DOM directly and can target any CSS selector or element reference. Exposes `driver({ steps: [...] })` with `drive()` / `moveNext()` / `movePrevious()` / `destroy()` imperative API that integrates cleanly with the existing `ShortcutRegistry`-based keyboard handling. Supports async steps (needed to wait for view transitions between tour steps). Last published November 2025 at 1.4.0. |
| **@floating-ui/dom** | 1.7.5 | Popover and tooltip positioning for layout preset picker UI | 3 KB gzipped, zero dependencies, framework-agnostic DOM API. Handles viewport collision detection, scroll-aware repositioning, and flip/shift middleware out of the box — critical for the sidebar preset picker which can overflow the viewport depending on panel state. `computePosition(reference, floating, options)` returns `{ x, y }` synchronously. Used internally by driver.js itself for tour popover positioning, but the dom package is also needed standalone for the preset picker UI (not part of any tour flow). |

### No-Install Additions (Extend Existing Patterns)

These features require ZERO new npm packages. They extend existing architecture.

| Feature | Implementation | Existing Anchors |
|---------|---------------|-----------------|
| **Dataset-to-view-config mapping** | `ViewConfigRegistry` class: a `Map<SourceType, ViewConfig>` where `SourceType` mirrors the datasets `source_type` enum. On dataset activation (`is_active = 1`), query the registry and apply defaults via existing provider setters. | `datasets.source_type` column already exists in schema; `SchemaProvider` introspects PRAGMA at runtime; `PAFVProvider.setRowAxes()` / `setColAxes()` already accept validated arrays |
| **Named layout presets** | `PresetManager` class: serialize the current state of PAFVProvider + FilterProvider + SuperDensityProvider + sidebar panel visibility (3-state toggles) into a single JSON blob, store under `preset:{name}` key in ui_state via existing `bridge.send('ui:set', ...)`. List available presets via `bridge.send('ui:getAll', {})` then filter keys matching the `preset:` prefix. | ui_state table already provides key-value store; StateManager's `_persist` pattern is the serialization template |
| **Tour completion state** | Store `tour:completed:{tourId}` boolean in ui_state. No new table or bridge message type needed. | Same ui_state pattern used by all other Tier 2 persistence |
| **Tour step targeting** | Use existing `data-*` attributes already on DOM elements (e.g., `data-view`, `data-explorer-panel`, `data-col-start`). No new attribute conventions required. | data-attribute-over-has is already an established pattern in this codebase (from v6.1 Test Harness) |

---

## Preset Serialization Format

Named presets serialize to a single JSON object stored in ui_state under the key `preset:{name}`.

```typescript
// Stored at ui_state key: "preset:Research View"
interface LayoutPreset {
  version: 1;
  name: string;
  createdAt: string;           // ISO 8601
  // Provider snapshots — same shape already produced by each provider's serialize()
  pafv: PAFVState;             // row/col/filter/page axes
  density: DensityState;       // 4-level Janus density
  filters: FilterState;        // active LATCH filters
  // Sidebar panel visibility (3-state per CollapsibleSection)
  panels: Record<PanelId, 'hidden' | 'visible' | 'collapsed'>;
  // Active view
  viewType: ViewType;
}
```

The `preset:` key prefix acts as a namespace within ui_state. Listing presets:
```typescript
const allState = await bridge.send('ui:getAll', {});
const presets = Object.entries(allState)
  .filter(([key]) => key.startsWith('preset:'))
  .map(([, value]) => JSON.parse(value) as LayoutPreset);
```

This requires no new bridge message types, no schema migrations, and no new Worker handlers.

---

## Dataset-to-Config Mapping Strategy

The datasets table already has `source_type` as a non-null enum. The mapping strategy is a static registry (no database storage needed for defaults — they are compile-time constants).

```typescript
// src/providers/ViewConfigRegistry.ts (new file, ~80 LOC)
type SourceType = 'apple_notes' | 'csv' | 'json' | 'excel' | 'markdown'
                | 'html' | 'sample' | 'apple_reminders' | 'apple_calendar'
                | 'directory' | string;  // open for future types

interface ViewConfig {
  viewType: ViewType;
  pafvDefaults: Partial<PAFVState>;     // which axes to assign
  densityDefault: DensityLevel;
  panelDefaults: Partial<Record<PanelId, 'hidden' | 'visible' | 'collapsed'>>;
}

const DEFAULTS: Record<string, ViewConfig> = {
  apple_calendar: { viewType: 'calendar', ... },
  apple_reminders: { viewType: 'kanban',  ... },
  apple_notes:     { viewType: 'list',    ... },
  csv:             { viewType: 'supergrid', ... },
  excel:           { viewType: 'supergrid', ... },
  markdown:        { viewType: 'gallery',  ... },
  // etc.
};
```

**Fallback chain:** user-defined preset (if one is pinned to this dataset_id) → source_type default → global default (list view). Never throws; always falls back gracefully.

---

## Tour Integration Architecture

driver.js integrates at the `main.ts` / app initialization layer. The tour controller reads from ui_state (`tour:completed:onboarding`) to skip if already seen.

```typescript
// src/ui/tour/TourController.ts (new file)
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export class TourController {
  private driverInstance = driver({ /* global options */ });

  async maybeStartOnboardingTour(): Promise<void> {
    const completed = await bridge.send('ui:getAll', {});
    if (completed['tour:completed:onboarding']) return;
    this.driverInstance.setSteps([...]);
    this.driverInstance.drive();
  }
}
```

driver.js injects a single `<div id="driver-wrapper">` into the document body. It does NOT modify the existing DOM — it only adds a transparent overlay and positions popovers next to the highlighted element. This is safe with the D3 data-join architecture because it never touches SVG nodes or existing HTML structure.

**CSS isolation:** Import `driver.js/dist/driver.css` through the Vite entry point. driver.js CSS uses the `.driver-*` namespace — no conflict with the existing `--sg-*`, `--text-*`, `--latch-*` token namespaces. Override driver's default highlight color via CSS custom properties it exposes.

---

## Installation

```bash
# Tour library (new runtime dependency)
npm install driver.js

# Floating UI DOM (new runtime dependency for preset picker positioning)
npm install @floating-ui/dom
```

No devDependencies additions. No Vite config changes — both packages are ESM-first and import from the main thread only (no Worker involvement).

Type declarations: driver.js bundles its own TypeScript declarations. `@floating-ui/dom` bundles its own TypeScript declarations. No separate `@types/*` installs required.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| driver.js 1.4.0 | Intro.js | Intro.js is AGPL-licensed (requires commercial license for proprietary apps — this is a paid StoreKit 2 app). It is also 498 KB unpacked vs driver.js's ~5 KB gzipped. Intro.js makes sense only for open-source projects where the AGPL poses no problem. |
| driver.js 1.4.0 | Shepherd.js | Shepherd.js uses Floating UI internally (same dependency as driver.js) but adds Popper.js and a React wrapper. It's 3x the bundle size. Use Shepherd only if the tour needs deeply customized step components built with a framework. |
| driver.js 1.4.0 | Custom overlay (no library) | A hand-rolled spotlight overlay is ~100 LOC but requires manual viewport boundary calculation, scroll tracking, and resize observer wiring. driver.js handles all of this. At 5 KB gzipped, the tradeoff is not worth avoiding. |
| @floating-ui/dom 1.7.5 | Popper.js | Popper.js is the predecessor to Floating UI — same team, deprecated. Floating UI supersedes it with a smaller bundle, better tree-shaking, and a cleaner API. |
| @floating-ui/dom 1.7.5 | CSS anchor positioning | CSS anchor positioning (Level 1) is not yet in Safari 18 (partial support in Safari 18.2+ for `anchor-name` but not `position-anchor`). Cannot rely on it for the native WKWebView target (iOS 17+). Use when Safari 19+ becomes minimum target. |
| ui_state for presets | Separate presets table | A dedicated `layout_presets` table would require a schema migration and new Worker message types (`preset:list`, `preset:save`, `preset:delete`). The ui_state key-prefix approach requires zero schema changes and uses proven bridge messaging. Migrate to a dedicated table only if preset count exceeds ~50 (unlikely for a desktop app). |
| Static ViewConfigRegistry | ML-based view recommendation | A trained content-signal classifier requires training data, inference runtime (onnxruntime-web ~2 MB), and ongoing maintenance. The static registry covers 100% of known source types with zero runtime overhead. Add content-signal heuristics (card_type distribution, column count, date field presence) as a second-pass override if the static defaults prove insufficient. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `intro.js` | AGPL license is incompatible with a commercial iOS/macOS app (StoreKit 2 paywalled tiers). Using AGPL code in a paid app requires a commercial license. | `driver.js` (MIT) |
| `shepherd.js` | Bundles React support and Popper.js even when unused. 15+ KB gzipped vs driver.js's 5 KB. No functional advantage for this use case. | `driver.js` (MIT, zero dependencies) |
| `tourguide-js` | Requires `@floating-ui/dom` as a peer dependency (adds the same dep as direct floating-ui usage anyway) and has 1/10th the download count of driver.js. Less battle-tested. | `driver.js` |
| React-based tour libraries (reactour, react-joyride, etc.) | This codebase is pure TypeScript + D3/DOM. No React. These libraries require ReactDOM and JSX compilation. | `driver.js` |
| Separate `presets` DB table | Requires a schema migration, new Worker handlers, and new bridge message types. The existing ui_state key-value store handles presets with zero schema changes. | `preset:` key prefix in existing ui_state |
| `localStorage` for preset storage | Isometry already uses sql.js as the system of record. Splitting persistence across sql.js and localStorage creates two sources of truth that go out of sync on database restore from CloudKit or checkpoint. All persistence goes through ui_state. | ui_state via existing `bridge.send('ui:set', ...)` |
| Storing ViewConfigRegistry defaults in the database | Defaults are compile-time constants, not user data. Putting them in the DB means migrations on every default change. Keep in `src/providers/ViewConfigRegistry.ts` as a TypeScript const. | Static TypeScript `Map` in ViewConfigRegistry.ts |

---

## Bundle Size Impact

| Package | Chunk | Gzipped Size | Notes |
|---------|-------|-------------|-------|
| driver.js 1.4.0 | Main thread | ~5 KB | Import only in `TourController.ts` — Vite tree-shakes unused options |
| driver.js CSS | Main thread | ~2 KB | Import via Vite entry point; overridable with CSS custom properties |
| @floating-ui/dom 1.7.5 | Main thread | ~3 KB | Import only in preset picker UI component |
| ViewConfigRegistry | Main thread | <1 KB | Static map literal, no runtime cost |
| PresetManager | Main thread | <1 KB | Thin wrapper over existing bridge.send calls |

Total new main-thread weight: **~11 KB gzipped**. No Worker chunk changes.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| driver.js@1.4.0 | TypeScript ^5.9.3 | Bundles its own `.d.ts` declarations; no `@types/driver.js` exists or is needed |
| driver.js@1.4.0 | Vite ^7.3.1 | ESM exports only; Vite 7's ESM-first bundling handles it without config changes |
| driver.js@1.4.0 | WKWebView (Safari 17+) | Pure DOM manipulation; no Web Components or experimental APIs |
| @floating-ui/dom@1.7.5 | TypeScript ^5.9.3 | Bundles its own declarations |
| @floating-ui/dom@1.7.5 | Vite ^7.3.1 | ESM-first; compatible |
| @floating-ui/dom@1.7.5 | Safari 17+ / iOS 17+ | Uses ResizeObserver and MutationObserver — both available since Safari 13.1+ |

---

## Sources

- [driver.js GitHub](https://github.com/kamranahmedse/driver.js) — version 1.4.0, MIT license, zero dependencies, ~5 KB gzipped, TypeScript source confirmed (HIGH confidence)
- [driver.js npm](https://www.npmjs.com/package/driver.js) — last published November 2025 at 1.4.0 (HIGH confidence)
- [Floating UI getting-started docs](https://floating-ui.com/docs/getting-started) — version 1.7.5, `@floating-ui/dom` package for vanilla JS, 3 KB gzipped (HIGH confidence — official docs)
- [npm comparison: driver.js vs intro.js vs shepherd.js](https://npm-compare.com/driver.js,intro.js,shepherd.js,vue-tour) — bundle size comparison, dependency list (MEDIUM confidence — third-party aggregator, consistent with official sources)
- [intro.js licensing](https://introjs.com/) — AGPL confirmed (HIGH confidence — official site)
- Isometry `src/database/schema.sql` — `datasets.source_type` enum values, `ui_state` key-value schema, no new table needed (HIGH confidence — read directly)
- Isometry `src/providers/StateManager.ts` — `bridge.send('ui:set', ...)` persistence API, `preset:` key-prefix pattern viable (HIGH confidence — read directly)
- Isometry `package.json` — current dependency list; neither driver.js nor @floating-ui/dom installed (HIGH confidence — read directly)
- [CSS anchor positioning Safari compatibility](https://caniuse.com/css-anchor-positioning) — partial Safari 18.2+ support, not viable for iOS 17 minimum target (MEDIUM confidence — verified rationale for floating-ui choice)

---
*Stack research for: Smart defaults + layout presets + in-app guided tour (additive features on Isometry TypeScript/D3.js platform)*
*Researched: 2026-03-27*
