# Isometry UI Improvements Review

Date: 2026-03-12  
Reviewer: Codex (GPT-5)  
Scope: JavaScript/TypeScript UI layer (`src/ui`, `src/views`, `src/styles`) with focus on practical UI/UX improvements.

## Executive Summary

The UI foundation is strong and modular, but there are clear improvement opportunities in four areas:
1. Interaction completeness (keyboard and accessibility parity).
2. Integration fidelity (some visible controls are not fully wired through behavior).
3. Responsiveness/adaptivity (desktop-first layouts, minimal breakpoint behavior).
4. Maintainability/theming consistency (high inline-style surface in runtime-generated UI).

## Priority Findings and Recommendations

## P1 — Complete Projection/SuperGrid control integration

What to improve:
- Ensure all projection controls produce visible changes in SuperGrid behavior.

Why:
- UI currently exposes controls that look first-class but do not fully affect query semantics.

Evidence:
- Projection controls mutate display/aggregation:
  - [ProjectionExplorer.ts:379](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:379)
  - [ProjectionExplorer.ts:464](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:464)
- SuperGrid query payload currently omits these options:
  - [SuperGrid.ts:1255](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1255)
- Query builder already supports them:
  - [SuperGridQuery.ts:103](/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts:103)
  - [SuperGridQuery.ts:109](/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts:109)

Recommendation:
- Pass `aggregation` and `displayField` into `superGridQuery` from provider state.
- Add explicit integration tests for aggregation/display mode behavior.

## P1 — Add keyboard-complete navigation for shell menus and tabs

What to improve:
- Add arrow/home/end keyboard behavior for menu and tabs, and focus management when opening settings.

Why:
- Components declare ARIA roles (`menu`, `tablist`, `tab`) but do not fully implement expected keyboard behavior.

Evidence:
- Settings menu supports click/Escape only:
  - [CommandBar.ts:99](/Users/mshaler/Developer/Projects/Isometry/src/ui/CommandBar.ts:99)
  - [CommandBar.ts:153](/Users/mshaler/Developer/Projects/Isometry/src/ui/CommandBar.ts:153)
- Tab bar has click-only switching despite tab roles:
  - [ViewTabBar.ts:43](/Users/mshaler/Developer/Projects/Isometry/src/ui/ViewTabBar.ts:43)
  - [ViewTabBar.ts:53](/Users/mshaler/Developer/Projects/Isometry/src/ui/ViewTabBar.ts:53)

Recommendation:
- `CommandBar`: implement roving focus in menu (`ArrowUp/ArrowDown`, `Home/End`, `Enter`, `Escape`).
- `ViewTabBar`: implement keyboard tab activation (`ArrowLeft/ArrowRight`, `Home/End`, `Enter/Space`).

## P1 — Replace blocking browser dialogs with in-app UI primitives

What to improve:
- Replace `alert`/`confirm` with app-styled modal/confirm patterns.

Why:
- Native dialogs break visual consistency and feel abrupt in desktop app flows.

Evidence:
- About action uses blocking alert:
  - [CommandBar.ts:136](/Users/mshaler/Developer/Projects/Isometry/src/ui/CommandBar.ts:136)
- Reset/clear flows use confirm:
  - [PropertiesExplorer.ts:468](/Users/mshaler/Developer/Projects/Isometry/src/ui/PropertiesExplorer.ts:468)
  - [main.ts:793](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:793)

Recommendation:
- Introduce a shared lightweight `ConfirmDialog` and `InfoDialog` in `src/ui/`.
- Route these actions through that component for consistent theming and keyboard support.

## P2 — Reduce inline style sprawl in SuperGrid runtime DOM generation

What to improve:
- Move repeated `element.style` / `style.cssText` declarations into CSS classes.

Why:
- Large inline-style footprint reduces maintainability, makes theming harder, and increases visual drift risk.

Evidence:
- Extensive runtime style assignment in mount/toolbars/cells:
  - [SuperGrid.ts:615](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:615)
  - [SuperGrid.ts:661](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:661)
  - [SuperGrid.ts:754](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:754)

Recommendation:
- Extract repeated style groups into class names in `src/styles/supergrid.css`.
- Keep inline styles only for values that are truly data-driven per element (e.g., grid row/column positions).

## P2 — Add responsive behavior for explorer-heavy shell layouts

What to improve:
- Add breakpoint rules for panel rail, projection wells, toolbar controls, and tab bar density.

Why:
- Current workbench styles are largely desktop-first; there are no media queries in key shell/explorer style files.

Evidence:
- No media-query handling in core shell/explorer styles:
  - [workbench.css](/Users/mshaler/Developer/Projects/Isometry/src/styles/workbench.css)
  - [projection-explorer.css](/Users/mshaler/Developer/Projects/Isometry/src/styles/projection-explorer.css)
  - [visual-explorer.css](/Users/mshaler/Developer/Projects/Isometry/src/styles/visual-explorer.css)

Recommendation:
- Add compact breakpoint(s) for:
  - Projection wells stacking or horizontal scroll fallback.
  - Reduced command-bar chrome density.
  - Panel rail max-height tuning and optional drawer mode on narrow widths.

## P2 — Remove critical dependency on `:has(...)` selectors

What to improve:
- Replace behavior-critical `:has` selectors with class-based or ref-based alternatives.

Why:
- `:has` support has improved, but using it as a hard dependency for layout/state sync is brittle across embedded webviews.

Evidence:
- Layout-critical max-height override depends on `:has`:
  - [workbench.css:125](/Users/mshaler/Developer/Projects/Isometry/src/styles/workbench.css:125)
- Runtime state sync query also depends on `:has`:
  - [LatchExplorers.ts:695](/Users/mshaler/Developer/Projects/Isometry/src/ui/LatchExplorers.ts:695)

Recommendation:
- Use explicit classes/ref maps during mount to identify explorer/population states.
- Keep `:has` as progressive enhancement only.

## P3 — Improve LATCH error-state UX and test signal quality

What to improve:
- Surface recoverable histogram/chip-load errors in UI (not just console), and tighten tests around error pathways.

Why:
- Current behavior logs errors and silently renders fallback, which can hide degradation.

Evidence:
- Histogram fetch/render catches and logs only:
  - [HistogramScrubber.ts:157](/Users/mshaler/Developer/Projects/Isometry/src/ui/HistogramScrubber.ts:157)
  - [HistogramScrubber.ts:174](/Users/mshaler/Developer/Projects/Isometry/src/ui/HistogramScrubber.ts:174)

Recommendation:
- Add non-intrusive inline error state (`Retry` + message) for histogram blocks.
- Add test assertions for error visuals and retry path.

## P3 — Replace static “coming soon” shell defaults with runtime capability metadata

What to improve:
- Avoid shipping static stub copy in `WorkbenchShell` defaults when sections are expected to be mounted dynamically.

Why:
- Static stubs are easy to drift from actual state and can reappear in edge mount ordering scenarios.

Evidence:
- Stub text is still part of default section config:
  - [WorkbenchShell.ts:39](/Users/mshaler/Developer/Projects/Isometry/src/ui/WorkbenchShell.ts:39)
  - [WorkbenchShell.ts:45](/Users/mshaler/Developer/Projects/Isometry/src/ui/WorkbenchShell.ts:45)

Recommendation:
- Represent section status using explicit loading/ready/empty states managed by the mounted explorer.

## Suggested Implementation Order

1. P1 integration and keyboard completion (highest user-facing value).
2. P1 dialog consistency (quick UX win).
3. P2 SuperGrid style extraction and responsive pass.
4. P2 `:has` fallback hardening.
5. P3 error-state polishing and cleanup items.

## Suggested Acceptance Checks

- Keyboard-only user can fully operate view tabs and settings menu.
- Projection control changes are reflected in SuperGrid data behavior.
- No browser-native blocking dialogs remain in primary UI flows.
- Shell/explorer layout remains usable at narrow widths.
- LATCH histogram failure modes are visible and actionable in-UI.
