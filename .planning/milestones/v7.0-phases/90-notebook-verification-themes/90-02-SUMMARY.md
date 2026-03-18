---
phase: 90-notebook-verification-themes
plan: "02"
subsystem: theme-system
tags: [themes, css, accessibility, ui, aria]
dependency_graph:
  requires: []
  provides: [nextstep-theme, material3-theme, theme-picker-ui, instant-theme-switching]
  affects: [src/providers/ThemeProvider.ts, src/providers/types.ts, src/styles/design-tokens.css, src/ui/CommandBar.ts, src/styles/workbench.css, src/main.ts]
tech_stack:
  added: []
  patterns: [CSS custom properties, ARIA radiogroup pattern, no-theme-transition class, requestAnimationFrame flush]
key_files:
  created: []
  modified:
    - src/providers/types.ts
    - src/providers/ThemeProvider.ts
    - src/styles/design-tokens.css
    - src/ui/CommandBar.ts
    - src/styles/workbench.css
    - src/main.ts
    - tests/providers/ThemeProvider.test.ts
    - tests/ui/CommandBar.test.ts
    - tests/ui/WorkbenchShell.test.ts
    - tests/seams/ui/command-bar-subtitle.test.ts
    - tests/seams/ui/command-bar-destroy.test.ts
    - tests/seams/ui/workbench-shell.test.ts
decisions:
  - "nextstep/material themes return 'light' from resolvedTheme — fixed palettes don't have a dark counterpart, downstream consumers that check resolvedTheme get a safe value"
  - "no-theme-transition class added BEFORE setAttribute for instant switching — previous implementation only removed the class after first paint, not on mid-session toggles"
  - "THEME_OPTIONS constant lives at file scope (before class) — visible to mount() without class state"
  - "dataset['theme'] bracket notation over dot notation — project tsconfig strict mode requires index signature access with brackets"
metrics:
  duration: "9m"
  completed: "2026-03-18"
  tasks_completed: 2
  files_modified: 12
---

# Phase 90 Plan 02: Three Named Design Themes with 5-Option Picker Summary

Ship three named design themes (NeXTSTEP, Modern, Material 3) with a unified 5-option theme picker and instant mid-session switching.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend ThemeMode + NeXTSTEP + Material 3 CSS palettes + lag fix | 31c6b008 | types.ts, ThemeProvider.ts, design-tokens.css |
| 2 | Theme picker UI in settings dropdown + command palette label + announcer | b1d28fa1 | CommandBar.ts, workbench.css, main.ts, 6 test files |

## What Was Built

### Task 1: Type Extension + CSS Palettes + Lag Fix

**ThemeMode extended** from `'light' | 'dark' | 'system'` to `'light' | 'dark' | 'system' | 'nextstep' | 'material'`.

**ThemeProvider changes:**
- `resolvedTheme`: nextstep/material return `'light'` (fixed palettes, no dark variant)
- `_applyTheme()`: now adds `no-theme-transition` BEFORE `setAttribute('data-theme')`, then removes it in `requestAnimationFrame` — this suppresses CSS transitions on mid-session toggles (THME-04)
- `setState()`: validation extended to accept nextstep/material values

**NeXTSTEP theme** (`[data-theme="nextstep"]`): authentic gray palette (#838383 bg-primary), navy accent (#0000aa), sharp corners (--radius-sm: 0px, --radius-md: 2px, --radius-lg: 2px), 3D bevel tokens (`--nextstep-bevel: inset 1px 1px 0 #d4d4d4, inset -1px -1px 0 #555555`), black SuperGrid headers.

**Material 3 theme** (`[data-theme="material"]`): pastel purple tonal surface (#fffbfe bg, #6750a4 accent), generous radii (--radius-lg: 16px), Roboto font family override.

### Task 2: Theme Picker UI

**CommandBarConfig interface** redesigned:
- `onCycleTheme: () => void` → `onSetTheme: (theme: string) => void`
- `getThemeLabel: () => string` → `getTheme: () => string`

**Settings dropdown restructured**: single theme menuitem replaced with:
1. `div.workbench-settings-heading` ("Appearance" label)
2. `div[role="radiogroup"][aria-labelledby="theme-picker-label"]` with 5 `button[role="radio"][aria-checked]` options

**5 theme options**: Modern Dark, Modern Light, Modern System, NeXTSTEP, Material 3.

**Arrow key navigation**: ArrowDown/Right advances, ArrowUp/Left retreats, Escape closes dropdown.

**workbench.css additions**: `.workbench-settings-heading`, `.workbench-theme-picker`, `.workbench-theme-option` (border-left: 3px solid transparent), `.workbench-theme-option--active` (border-left-color: var(--accent), font-weight: 600).

**main.ts changes**: `onSetTheme` callback calls `announcer.announce('Theme changed to {label}')`. Command palette registration updated: label `'Change Appearance'` (was `'Cycle Theme (Dark / Light / System)'`), cycles all 5 modes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ThemeProvider test mock missing classList.add**
- **Found during:** Task 1 verification
- **Issue:** ThemeProvider test stubbed `document.documentElement.classList` with only `{ remove: vi.fn() }` — the new `_applyTheme()` calls `classList.add('no-theme-transition')` first, causing 17 test failures
- **Fix:** Added `add: vi.fn()` to the classList mock in `tests/providers/ThemeProvider.test.ts`
- **Files modified:** tests/providers/ThemeProvider.test.ts
- **Commit:** b1d28fa1

**2. [Rule 1 - Bug] CommandBar test mock used old API names**
- **Found during:** Task 2 verification
- **Issue:** 6 test files (CommandBar.test.ts, WorkbenchShell.test.ts, workbench-shell.test.ts, command-bar-subtitle.test.ts, command-bar-destroy.test.ts) provided `onCycleTheme`/`getThemeLabel` in mock configs — TypeScript and runtime failures
- **Fix:** Updated all mock factories to use `onSetTheme: vi.fn()` and `getTheme: () => 'dark'`
- **Files modified:** 5 test files
- **Commit:** b1d28fa1

**3. [Rule 1 - Bug] CommandBar test indices stale after theme menuitem removal**
- **Found during:** Task 2 verification
- **Issue:** Tests used items[1]=density, items[2]=help, items[3]=about (old layout had theme at items[0]). After converting theme to radiogroup, `.workbench-settings-item` elements are density=0, help=1, about=2
- **Fix:** Updated 4 index references + `≥4` count to `≥3` in CommandBar.test.ts
- **Files modified:** tests/ui/CommandBar.test.ts
- **Commit:** b1d28fa1

**4. [Rule 2 - Missing] dataset.theme bracket notation for strict TypeScript**
- **Found during:** Task 2 TypeScript check
- **Issue:** `btn.dataset.theme` triggers TS4111 (index signature must use bracket notation) in project's tsconfig strict mode
- **Fix:** Changed to `btn.dataset['theme']` in both the setter and getter
- **Files modified:** src/ui/CommandBar.ts
- **Commit:** b1d28fa1

### Pre-existing Failures (Out of Scope)

- `tests/ui/CommandBar.test.ts > command input placeholder` (3 tests): These test for `.workbench-command-bar__input` — a design concept that was never implemented in CommandBar. Pre-existing before this plan.
- `tests/seams/ui/dataset-eviction.test.ts` (4 tests): Pre-existing failures unrelated to theme work.

## Self-Check: PASSED

- src/providers/types.ts: FOUND
- src/providers/ThemeProvider.ts: FOUND
- src/styles/design-tokens.css: FOUND
- src/ui/CommandBar.ts: FOUND
- src/styles/workbench.css: FOUND
- Commit 31c6b008: FOUND
- Commit b1d28fa1: FOUND
