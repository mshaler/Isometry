---
status: diagnosed
phase: 90-notebook-verification-themes
source: [90-01-SUMMARY.md, 90-02-SUMMARY.md]
started: 2026-03-18T20:00:00Z
updated: 2026-03-18T20:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the application from scratch. App boots without errors in console, WebView loads, and a primary view renders with no crashes.
result: pass

### 2. Recent Cards List Appears in DB Utilities
expected: Open the Data Explorer sidebar. Expand the DB Utilities section. Below the existing card count and connection count stats, a "Recent Cards" heading appears with a list of up to 8 cards showing title, source, and date. If no cards are loaded, it shows "No cards yet".
result: issue
reported: "I wrote in Notebook and no card was saved? No cards yet"
severity: major

### 3. Recent Card Click Selects Card
expected: Click on any row in the Recent Cards list. The card becomes selected — NotebookExplorer (if visible) shows that card's notebook content, and SuperGrid highlights the corresponding row.
result: skipped
reason: No cards showing in Recent Cards list — blocked by test 2 issue

### 4. Recent Cards Update After Import
expected: Import a dataset (via Command-K or file import). After import completes, the Recent Cards list updates to show the newly imported cards (most recent first by created date).
result: issue
reported: "Imported Meryl Streep sample dataset and still No cards yet"
severity: major

### 5. NeXTSTEP Theme Visual Fidelity
expected: Open settings dropdown (gear icon). The Appearance section shows 5 radio options: Modern Dark, Modern Light, Modern System, NeXTSTEP, Material 3. Select NeXTSTEP. The entire UI switches to an authentic retro gray palette — medium gray backgrounds (#838383-ish), navy blue accents, sharp corners (no rounding), beveled 3D border effects on panels/buttons, black SuperGrid headers.
result: pass

### 6. Material 3 Theme Visual Fidelity
expected: Select Material 3 from the theme picker. The UI switches to a Google Material You style — light pastel purple surfaces, rounded corners (visibly generous radius), purple accent color, potentially Roboto font family.
result: pass

### 7. Modern Theme Unchanged
expected: Select Modern Dark, then Modern Light, then Modern System. Each sub-mode looks exactly the same as before this update — no visual regressions. Modern is just a rename of the existing palette.
result: pass

### 8. Theme Switching Is Instant (No Lag)
expected: Rapidly switch between all 5 theme options. Each switch feels instant — no visible 200ms fade/transition on backgrounds, text, or borders. The previous lag on mid-session theme toggling is gone.
result: pass

### 9. Theme Picker Keyboard Navigation
expected: Focus the theme picker with Tab. Use Arrow Down/Right to move between options. Use Arrow Up/Left to go back. Each arrow key press switches the active theme immediately. Press Escape to close the settings dropdown.
result: pass

### 10. Theme Persists Across Reload
expected: Select NeXTSTEP theme. Reload the page (or restart the app). The NeXTSTEP theme is still active — it persisted via StateManager/ui_state.
result: issue
reported: "NeXTSTEP theme did not persist: reverted to Modern"
severity: major

### 11. Screen Reader Announces Theme Changes
expected: With VoiceOver or a screen reader active, switch themes. The screen reader announces "Theme changed to [theme name]" on each switch.
result: pass

### 12. Command Palette Theme Cycling
expected: Open Command Palette (Cmd+K or equivalent). Search for "Appearance" or "Theme". A "Change Appearance" command appears. Activating it cycles through all 5 themes in order. Cmd+Shift+T shortcut also cycles all 5 themes.
result: pass

## Summary

total: 12
passed: 8
issues: 3
pending: 0
skipped: 1

## Gaps

- truth: "Recent Cards list shows up to 8 cards with title, source, and date in DB Utilities"
  status: failed
  reason: "User reported: I wrote in Notebook and no card was saved? No cards yet"
  severity: minor
  test: 2
  root_cause: "NotebookExplorer saves notes to ui_state (notebook:{cardId}), not cards table. Writing in Notebook does not create new cards — this is a mental model mismatch, not a bug. Recent Cards correctly queries the cards table."
  artifacts:
    - path: "src/ui/NotebookExplorer.ts"
      issue: "Saves to ui_state via ui:set, not cards table"
  missing:
    - "Clarify to user that Notebook is per-card notes, not card creation"
  debug_session: ""

- truth: "Recent Cards list updates after importing a dataset"
  status: failed
  reason: "User reported: Imported Meryl Streep sample dataset and still No cards yet"
  severity: major
  test: 4
  root_cause: "onLoadSample() in main.ts (line ~869-900) never calls refreshDataExplorer() after sample import. File-drop and native import paths both call refreshDataExplorer(), but the Command-K sample load path omits it."
  artifacts:
    - path: "src/main.ts"
      issue: "onLoadSample handler missing refreshDataExplorer() call after sample load"
  missing:
    - "Add void refreshDataExplorer() after coordinator.scheduleUpdate() in onLoadSample"
  debug_session: ""

- truth: "NeXTSTEP theme persists across page reload via StateManager/ui_state"
  status: failed
  reason: "User reported: NeXTSTEP theme did not persist: reverted to Modern"
  severity: major
  test: 10
  root_cause: "ThemeProvider is registered with StateCoordinator (line 189) but NOT with StateManager. Only providers registered via sm.registerProvider() participate in ui_state persistence. The line sm.registerProvider('theme', theme) is missing from main.ts around line 224."
  artifacts:
    - path: "src/main.ts"
      issue: "ThemeProvider not registered with StateManager — only with StateCoordinator"
  missing:
    - "Add sm.registerProvider('theme', theme) after existing sm.registerProvider calls in main.ts"
  debug_session: ""
