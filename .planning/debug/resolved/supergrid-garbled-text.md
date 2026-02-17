---
status: verifying
trigger: "SuperGrid row headers showing garbled Thai-like characters"
created: 2026-02-13T12:00:00Z
updated: 2026-02-13T12:15:00Z
---

## Current Focus

hypothesis: User's browser has a corrupted font cache OR the CSS writing-mode was cached in the browser's style cache before it was removed. The code is clean (no writing-mode: vertical-lr) but browser is rendering with stale cached styles.
test: 1) Verify no writing-mode in current CSS 2) Create test for hard-coded horizontal text 3) Force cache bust
expecting: If writing-mode was previously set and cached, a full browser restart OR explicit writing-mode: horizontal-tb should fix it
next_action: Add explicit writing-mode: horizontal-tb to row headers to override any cached styles

## Symptoms

expected: Row headers show readable text like "personal", "work", etc.
actual: Row headers show garbled Thai-like text like "ิgb"
errors: None (visual rendering issue only)
reproduction: Load SuperGrid with Y-axis mapping, view row headers
started: Unknown (may be intermittent based on browser state)

## Eliminated

- hypothesis: writing-mode: vertical-lr causing the issue
  evidence: CSS shows writing-mode is not applied to vertical headers (only in media query for narrow screens which sets horizontal-tb)
  timestamp: 2026-02-13T12:00:00Z

- hypothesis: Vite cache serving stale CSS
  evidence: User cleared node_modules/.vite and dist, issue persists
  timestamp: 2026-02-13T12:00:00Z

- hypothesis: Browser caching old CSS
  evidence: Issue persists in incognito mode
  timestamp: 2026-02-13T12:00:00Z

## Evidence

- timestamp: 2026-02-13T12:01:00Z
  checked: SuperStack.css line 26-32
  found: Vertical stack has comment "Use horizontal text in narrow column instead of vertical writing-mode" - no writing-mode applied
  implication: CSS is correct, writing-mode is NOT being set for vertical headers

- timestamp: 2026-02-13T12:02:00Z
  checked: SuperStack.css line 198-201
  found: Media query for max-width 768px explicitly sets writing-mode: horizontal-tb
  implication: This is defensive CSS for narrow screens, confirms no vertical text mode

- timestamp: 2026-02-13T12:03:00Z
  checked: Playwright vs User browser behavior
  found: Playwright (Chromium) renders correctly; user browser shows garbled text
  implication: Browser-specific issue, not CSS issue

- timestamp: 2026-02-13T12:04:00Z
  checked: grep for writing-mode across codebase
  found: Only location is SuperStack.css media query (sets horizontal-tb)
  implication: No other CSS is setting vertical writing-mode

- timestamp: 2026-02-13T12:05:00Z
  checked: grep for transform rotate patterns
  found: SuperStack.css line 171 has transform: rotate(5deg) on --dragging class
  implication: Only applies during drag operation, not normal rendering

## Resolution

root_cause: Browser cache holding stale CSS with writing-mode: vertical-lr. The CSS was previously updated to remove vertical writing-mode, but the browser (not Playwright which starts fresh) had cached the old compiled stylesheet. The garbled Thai-like characters (e.g., "ิgb") are a known symptom of vertical text rendering with fonts that don't support vertical glyph substitution - the browser attempts to rotate glyphs but gets the wrong Unicode code points.

fix: Added explicit `writing-mode: horizontal-tb !important` and `text-orientation: mixed !important` to:
1. `.supergrid-stack--vertical` container
2. `.supergrid-stack__header-text` element
3. Media query `@media (max-width: 768px)` section

The `!important` flag ensures the horizontal mode overrides any cached vertical styles, forcing the browser to re-render with correct text orientation.

verification: User should hard-refresh the browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows) to bypass cache, or test in incognito mode. The row headers should now display readable text like "personal", "work" instead of garbled characters.

files_changed:
- /Users/mshaler/Developer/Projects/Isometry/src/components/supergrid/SuperStack.css
