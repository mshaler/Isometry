# Phase 49: Theme System - Research

**Researched:** 2026-03-07
**Domain:** CSS custom properties theming, native/web appearance synchronization
**Confidence:** HIGH

## Summary

Phase 49 adds a three-way theme toggle (Light, Dark, System) to Isometry. The web runtime currently has a single dark theme defined via ~40 CSS custom properties in `design-tokens.css`. All 9 views already reference these tokens for backgrounds, text, borders, and accents. The architecture decision to use `[data-theme]` attribute (not CSS `light-dark()`) is locked for iOS 17.0 compatibility.

The work decomposes into four concerns: (1) restructure `design-tokens.css` to define dark and light token palettes under `[data-theme="dark"]` and `[data-theme="light"]`, with `[data-theme="system"]` delegating to `prefers-color-scheme`; (2) migrate the ~15 remaining hardcoded colors in TypeScript and CSS to CSS custom property references; (3) create a `ThemeProvider` (Tier 2 PersistableProvider) that persists the user's choice via the existing `StateManager` + `ui_state` table and applies it by setting `data-theme` on `<html>`; (4) sync the native SwiftUI shell appearance with the web content theme via `evaluateJavaScript` for Swift-to-JS communication and `.preferredColorScheme()` for SwiftUI-side coordination.

**Primary recommendation:** Use the existing `[data-theme]` attribute approach with CSS selector scoping. Define the dark palette as the `:root` default (preserving current behavior), duplicate tokens under `[data-theme="light"]` with light-appropriate values, and implement `[data-theme="system"]` via two nested `@media (prefers-color-scheme: ...)` blocks. The `ThemeProvider` follows the identical pattern as `FilterProvider`/`PAFVProvider` -- a Tier 2 `PersistableProvider` registered with `StateManager`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| THME-01 | 3-way toggle (Light/Dark/System) in settings UI | ThemeProvider state + SettingsView UI (Standard Stack, Architecture Patterns) |
| THME-02 | ~40 CSS design tokens with light-background values | Light palette definition in design-tokens.css (Architecture Pattern 1) |
| THME-03 | System mode follows macOS/iOS via prefers-color-scheme | `@media (prefers-color-scheme)` inside `[data-theme="system"]` selector (Architecture Pattern 2) |
| THME-04 | Theme preference persists via StateManager (Tier 2) | ThemeProvider implements PersistableProvider (Architecture Pattern 3) |
| THME-05 | All D3 SVG elements reference CSS custom properties | Hardcoded hex migration in audit-colors.ts, SuperGrid, NetworkView (Pitfall 1) |
| THME-06 | Native SwiftUI shell syncs theme with WKWebView | `.preferredColorScheme()` + evaluateJavaScript bridge (Architecture Pattern 4) |
| THME-07 | 200ms transition on theme toggle | CSS `transition` on `background-color` and `color` for `[data-theme]` changes (Code Example 4) |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | CSS3 | Token-based theming | Native browser feature, zero runtime, composable with D3 SVG `var()` |
| `window.matchMedia` | Web API | Detect system appearance changes | Standard API for `prefers-color-scheme` media query observation |
| `@AppStorage` | SwiftUI | Persist theme preference natively | UserDefaults-backed, survives app restart, no additional framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `StateManager` (existing) | n/a | Persist theme to ui_state table | Web-side persistence across sessions |
| `evaluateJavaScript` | WKWebView | Push theme from Swift to JS | When user changes theme via native Settings |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `[data-theme]` attribute | CSS `light-dark()` function | `light-dark()` requires iOS 17.5+ / Safari 17.5+ -- project targets iOS 17.0 |
| `@media (prefers-color-scheme)` only | Always use media query | Cannot support explicit Light/Dark override independent of system setting |
| JavaScript-driven CSS variable replacement | Runtime `setProperty()` on every token | 40+ calls vs 1 attribute change; attribute selector is declarative and cacheable |

**Installation:**
```bash
# No new packages required -- pure CSS + existing infrastructure
```

## Architecture Patterns

### Recommended File Structure
```
src/
├── styles/
│   └── design-tokens.css     # Restructured: dark default + [data-theme="light"] + [data-theme="system"]
├── providers/
│   └── ThemeProvider.ts       # New: PersistableProvider for theme state
├── main.ts                    # Wire ThemeProvider + StateManager
native/Isometry/Isometry/
├── SettingsView.swift         # Add Appearance picker section
├── ContentView.swift          # Apply .preferredColorScheme() modifier
└── WebViewContainer.swift     # (may need updateNSView/updateUIView for theme push)
```

### Pattern 1: CSS Token Restructuring with `[data-theme]` Selectors

**What:** Restructure `design-tokens.css` to scope dark tokens under `[data-theme="dark"]` and define a parallel light token set under `[data-theme="light"]`. System mode uses nested `@media` queries.

**When to use:** This is the core pattern for the entire theme system.

**Example:**
```css
/* Dark theme (default and explicit) */
:root,
[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #1e1e2e;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0b0;
  /* ... all ~40 tokens ... */
}

/* Light theme (explicit) */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-card: #ffffff;
  --text-primary: #1a1a2e;
  --text-secondary: #4a4a5a;
  /* ... all ~40 tokens ... */
}

/* System theme: delegate to OS preference */
[data-theme="system"] {
  /* Inherits dark by default (from :root) */
}
@media (prefers-color-scheme: light) {
  [data-theme="system"] {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    /* ... same light values ... */
  }
}
```

**Why this works:** The `:root` block guarantees backward compatibility -- the app looks identical to today without any JS changes. The `[data-theme]` attribute on `<html>` is set by `ThemeProvider` at init time.

### Pattern 2: System Theme with matchMedia Listener

**What:** When the user selects "System" theme, attach a `matchMedia` change listener so the app recolors in real time when macOS/iOS switches between light and dark appearance.

**When to use:** THME-03 requirement.

**Example:**
```typescript
// In ThemeProvider
private _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

private _onSystemChange = (): void => {
  if (this._theme === 'system') {
    // The CSS @media block handles recoloring automatically
    // But we need to notify subscribers so views can update
    // SVG elements that read resolved colors at render time
    this._notify();
  }
};

connect(): void {
  this._mediaQuery.addEventListener('change', this._onSystemChange);
}

disconnect(): void {
  this._mediaQuery.removeEventListener('change', this._onSystemChange);
}
```

**Key insight:** With `[data-theme="system"]` + `@media (prefers-color-scheme: light)` CSS, the browser handles the recoloring automatically. The JS listener is only needed to notify subscribers (for audit-colors.ts which reads resolved colors from getComputedStyle) and to inform the native shell.

### Pattern 3: ThemeProvider as PersistableProvider (Tier 2)

**What:** A minimal provider following the exact same pattern as `FilterProvider`, `PAFVProvider`, and `DensityProvider`.

**When to use:** THME-04 requirement.

**Example:**
```typescript
export type ThemeMode = 'light' | 'dark' | 'system';

export class ThemeProvider implements PersistableProvider {
  private _theme: ThemeMode = 'dark'; // default matches current app
  private _subscribers: Set<() => void> = new Set();

  get theme(): ThemeMode { return this._theme; }

  setTheme(mode: ThemeMode): void {
    if (this._theme === mode) return;
    this._theme = mode;
    this._applyTheme();
    this._notify();
  }

  private _applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this._theme);
  }

  // PersistableProvider interface
  toJSON(): string { return JSON.stringify({ theme: this._theme }); }
  setState(state: unknown): void {
    const s = state as { theme?: string };
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') {
      this._theme = s.theme;
      this._applyTheme();
    }
  }
  resetToDefaults(): void {
    this._theme = 'dark';
    this._applyTheme();
  }

  subscribe(cb: () => void): () => void {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  private _notify(): void {
    for (const cb of this._subscribers) cb();
  }
}
```

### Pattern 4: Native Shell Theme Sync

**What:** SwiftUI shell must match the web content theme. Two directions: (a) when user changes theme in web Settings, notify Swift; (b) when Swift needs to know current theme, read from JS.

**When to use:** THME-06 requirement.

**Approach:**
```swift
// SettingsView.swift — add Appearance picker
struct SettingsView: View {
    @AppStorage("theme") private var theme: String = "dark"

    // Picker with 3 options: Light, Dark, System
    Picker("Appearance", selection: $theme) {
        Text("Light").tag("light")
        Text("Dark").tag("dark")
        Text("System").tag("system")
    }
}

// ContentView.swift — apply .preferredColorScheme based on stored theme
.preferredColorScheme(preferredScheme)

var preferredScheme: ColorScheme? {
    switch theme {
    case "light": return .light
    case "dark": return .dark
    default: return nil  // System default
    }
}

// Push theme to JS when native picker changes
.onChange(of: theme) { _, newTheme in
    let js = "window.__isometry?.themeProvider?.setTheme('\(newTheme)')"
    Task { try? await bridgeManager.webView?.evaluateJavaScript(js) }
}
```

**Bidirectional sync:** When the user changes theme from the web-side settings (future command palette), the ThemeProvider can post a bridge message to notify Swift. However, in v4.4 the toggle only exists in the native SettingsView, so the flow is one-directional (Swift -> JS). A web-side toggle can be added later if needed.

### Anti-Patterns to Avoid

- **Per-element JavaScript color setting:** Do not iterate DOM elements and call `element.style.color = ...`. Use CSS custom properties exclusively so one attribute change recolors everything.
- **Duplicating token values in TypeScript constants:** The `audit-colors.ts` file already duplicates CSS token values. This phase should migrate those to `getComputedStyle()` reads or CSS `var()` references, not add more duplication.
- **Using `@media (prefers-color-scheme)` at the `:root` level:** This would override explicit user choice. System mode must be opt-in via `[data-theme="system"]`.
- **Blocking render on theme load:** Theme must be applied synchronously before first paint. Set `data-theme` attribute from `@AppStorage` or `localStorage` before main JS executes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color palette design | Manual hex value guessing | Systematic token derivation from dark palette | Ensures contrast ratios and visual harmony |
| System appearance detection | Custom Swift-to-JS polling | `window.matchMedia('(prefers-color-scheme: dark)')` | Standard API, fires change events automatically |
| Theme persistence (web) | Custom localStorage wrapper | Existing `StateManager` + `ui_state` table | Already built, tested, and handles debounced writes |
| Theme persistence (native) | Custom file I/O | `@AppStorage` | Built-in SwiftUI UserDefaults binding |
| CSS variable scoping | JavaScript `setProperty()` loops | CSS `[data-theme]` selector blocks | Declarative, no JS execution needed for recolor |

**Key insight:** The existing design token system and StateManager infrastructure handle 80% of this phase. The novel work is defining the light palette and wiring the native-web sync.

## Common Pitfalls

### Pitfall 1: Hardcoded Hex Colors in TypeScript

**What goes wrong:** `audit-colors.ts` has 12 hardcoded hex colors (`AUDIT_COLORS` + `SOURCE_COLORS`) that SVG views read at render time. These won't change when the theme switches because they bypass CSS custom properties.

**Why it happens:** The file was created when SVG `attr('fill')` didn't reliably accept `var()` references. Modern browsers (Safari 15.4+) do support `var()` in SVG attributes.

**How to avoid:** Migrate `audit-colors.ts` to read resolved colors from `getComputedStyle(document.documentElement).getPropertyValue('--audit-new')` at render time, or switch SVG attr calls to use `var(--audit-new)` directly. The CSS audit overlay (`.audit-mode .card[data-audit="new"]`) already uses `var()` -- only the SVG path (CardRenderer.ts lines 148-167) uses the JS constants.

**Warning signs:** Audit stripes that look correct in dark mode but invisible or clashing in light mode.

### Pitfall 2: NetworkView d3.schemeCategory10 Palette

**What goes wrong:** `NetworkView.ts:284` uses `d3.scaleOrdinal(d3.schemeCategory10)` which is a fixed 10-color palette designed for white backgrounds. Several of these colors (especially #1f77b4, #ff7f0e) have poor contrast on dark backgrounds, and the palette won't adapt to theme changes.

**Why it happens:** D3's categorical palettes are static -- they don't respond to CSS custom properties.

**How to avoid:** Replace `d3.schemeCategory10` with a custom ordinal scale that references CSS custom properties for card type colors, matching the approach already used in `TreeView.ts` (`CARD_TYPE_COLORS` map using `var(--source-*)` tokens). This also unifies the color language across views.

**Warning signs:** Network node colors that clash with the background or are hard to distinguish in one theme but not the other.

### Pitfall 3: Flash of Wrong Theme (FOWT)

**What goes wrong:** If theme is applied after the page renders, users see a brief flash of dark-themed content before light theme applies (or vice versa).

**Why it happens:** The `ThemeProvider` initializes asynchronously after `StateManager.restore()` completes, which requires a Worker round-trip.

**How to avoid:** Apply the theme attribute synchronously before first paint. Two approaches:
1. **Native shell:** Inject `data-theme` as a WKWebView user script (`.atDocumentStart`) that reads from `@AppStorage`.
2. **Web dev:** Use a `<script>` tag in `<head>` (before CSS loads) that reads `localStorage.getItem('isometry-theme')` and sets `document.documentElement.dataset.theme`.

The native approach is preferred because the app runs in WKWebView and `@AppStorage` is the source of truth.

**Warning signs:** Momentary dark flash on launch when user has selected light theme.

### Pitfall 4: Inline rgba() Values in CSS Files

**What goes wrong:** Several CSS files have inline `rgba()` values that won't adapt to theme changes. Examples:
- `help-overlay.css:16` -- `rgba(0, 0, 0, 0.6)` backdrop
- `help-overlay.css:99` -- `rgba(255, 255, 255, 0.1)` kbd border
- `import-toast.css:75` -- `rgba(0, 0, 0, 0.2)` error detail background
- `action-toast.css:24` -- `rgba(74, 158, 255, 0.3)` border (should be `var(--accent-border)`)

**Why it happens:** These were written when only dark theme existed, so opacity-based colors looked correct.

**How to avoid:** Replace with CSS custom property references. The `--overlay-bg`, `--overlay-shadow`, `--border-subtle` tokens already exist for most of these cases. Add new tokens for any remaining gaps.

**Warning signs:** Dark overlay backgrounds that are too dark or light on the wrong theme.

### Pitfall 5: SuperGrid Inline Drag-Over Color

**What goes wrong:** `SuperGrid.ts:3665` sets `backgroundColor = 'rgba(0, 150, 136, 0.18)'` inline for drag-over state. This won't adapt to theme.

**Why it happens:** Intentionally distinct from `--selection-bg` for drag feedback.

**How to avoid:** Add a `--drag-over-bg` token to `design-tokens.css` with theme-appropriate values.

### Pitfall 6: Body/HTML Background Color Mismatch

**What goes wrong:** If `index.html` `<body>` has no explicit background-color, the browser default (white) shows through during loading or behind transparent areas.

**Why it happens:** The current app relies on `--bg-primary` on `#app` but `<body>` itself may not be styled.

**How to avoid:** Set `body { background-color: var(--bg-primary); color: var(--text-primary); }` in `design-tokens.css`.

## Code Examples

### Example 1: Light Token Palette

Values designed for white-background readability while maintaining the same semantic structure as the dark palette:

```css
[data-theme="light"] {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f7f7f8;
  --bg-card: #ffffff;
  --bg-surface: #eeeeef;

  /* Text */
  --text-primary: #1a1a2e;
  --text-secondary: #5a5a6e;
  --text-muted: #9a9aaa;

  /* Accent (can remain similar -- blue on white has good contrast) */
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --danger: #dc2626;

  /* Derived -- adjusted for light backgrounds */
  --danger-bg: rgba(220, 38, 38, 0.08);
  --danger-border: rgba(220, 38, 38, 0.25);
  --accent-bg: rgba(37, 99, 235, 0.08);
  --accent-border: rgba(37, 99, 235, 0.25);
  --border-subtle: rgba(0, 0, 0, 0.1);
  --border-muted: rgba(0, 0, 0, 0.15);
  --overlay-bg: rgba(0, 0, 0, 0.3);
  --overlay-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  --overlay-shadow-heavy: 0 4px 12px rgba(0, 0, 0, 0.15);
  --cell-hover: rgba(0, 0, 0, 0.04);
  --cell-alt: rgba(0, 0, 0, 0.02);
  --cell-empty-bg: rgba(0, 0, 0, 0.02);
  --selection-bg: rgba(37, 99, 235, 0.1);
  --selection-outline: #2563eb;
  --search-highlight: rgba(245, 158, 11, 0.3);
  --search-match-outline: rgba(245, 158, 11, 0.7);

  /* Audit -- slightly saturated for visibility on white */
  --audit-new: #16a34a;
  --audit-modified: #ea580c;
  --audit-deleted: #dc2626;

  /* Source provenance -- darker variants for light background */
  --source-apple-notes: #d97706;
  --source-markdown: #7c3aed;
  --source-csv: #059669;
  --source-json: #2563eb;
  --source-excel: #0d9488;
  --source-html: #db2777;
  --source-native-reminders: #9333ea;
  --source-native-calendar: #ca8a04;
  --source-native-notes: #ea580c;
}
```

**Note:** These values need manual contrast ratio verification during implementation (A11Y-01 comes in Phase 50, but baseline readability is a Phase 49 success criterion).

### Example 2: FOWT Prevention Script (Native Shell)

```swift
// In ContentView.setupWebView() — inject before page load
let savedTheme = UserDefaults.standard.string(forKey: "theme") ?? "dark"
let themeScript = WKUserScript(
    source: "document.documentElement.setAttribute('data-theme', '\(savedTheme)');",
    injectionTime: .atDocumentStart,
    forMainFrameOnly: true
)
config.userContentController.addUserScript(themeScript)
```

### Example 3: Migrating audit-colors.ts to CSS var() References

```typescript
// BEFORE: hardcoded hex
export const AUDIT_COLORS = {
  new: '#4ade80',
  modified: '#fb923c',
  deleted: '#f87171',
};

// AFTER: CSS custom property references (works in SVG attr('fill'))
export const AUDIT_COLORS = {
  new: 'var(--audit-new)',
  modified: 'var(--audit-modified)',
  deleted: 'var(--audit-deleted)',
};
```

This works because modern Safari (15.4+, project targets iOS 17 = Safari 17) supports `var()` in SVG presentation attributes set via D3's `.attr()`. The CSS-side tokens already exist.

### Example 4: Theme Transition CSS

```css
/* Smooth transition on theme change -- THME-07 */
:root {
  --theme-transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, fill 200ms ease, stroke 200ms ease;
}

body,
.card,
.data-cell,
.view-toolbar,
.audit-toggle-btn,
.audit-legend,
.help-overlay__card,
.import-toast,
.action-toast {
  transition: var(--theme-transition);
}

/* Disable transition on first paint to prevent flash */
.no-theme-transition,
.no-theme-transition * {
  transition: none !important;
}
```

The `.no-theme-transition` class is added to `<html>` on load, then removed after a single rAF tick to prevent the initial paint from animating.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate CSS files per theme | CSS custom properties with attribute selectors | CSS Custom Properties (2017+) | No file swapping, instant toggle, works with SVG |
| `@media (prefers-color-scheme)` only | `data-theme` attribute + media query fallback | Common pattern since 2020 | Supports explicit user override of system preference |
| JavaScript `setProperty()` loops | Single attribute change triggers CSS cascade | Always preferred | O(1) operation vs O(n) token updates |
| `light-dark()` CSS function | `[data-theme]` selector blocks | `light-dark()` Safari 17.5 (2024) | Project targets iOS 17.0 = Safari 17 -- cannot use `light-dark()` |

**Deprecated/outdated:**
- `prefers-color-scheme` as sole mechanism: Does not allow explicit Light/Dark user override
- CSS `light-dark()` function: Requires Safari 17.5+ (iOS 17.5+), project targets iOS 17.0

## Open Questions

1. **Light palette exact values**
   - What we know: Dark palette tokens are defined; light values need to provide adequate contrast on white backgrounds
   - What's unclear: Exact hex values for source provenance colors that remain distinguishable on light backgrounds
   - Recommendation: Start with the values in Code Example 1 (derived from Tailwind's 600 shade for light mode). Validate contrast during implementation. Phase 50 (Accessibility) will do formal WCAG AA audit.

2. **Theme toggle location in web UI**
   - What we know: Native shell has SettingsView with a natural place for the picker. Web (dev mode) has no settings panel.
   - What's unclear: Whether a web-side toggle is needed for the Vite dev server workflow.
   - Recommendation: Add a minimal keyboard shortcut (e.g., Cmd+Shift+T or register in existing ShortcutRegistry) for web dev mode. Full web settings panel is not in scope for Phase 49.

3. **NetworkView ordinal color scale**
   - What we know: `d3.schemeCategory10` is hardcoded and theme-unaware. TreeView already uses CSS var() references for card type colors.
   - What's unclear: Whether to unify NetworkView with TreeView's color approach or keep a separate ordinal scale.
   - Recommendation: Unify to the `CARD_TYPE_COLORS` pattern using `var(--source-*)` tokens. This makes NetworkView theme-aware and visually consistent with TreeView.

## Sources

### Primary (HIGH confidence)

- **Codebase audit** -- All CSS files in `src/styles/`, all view renderers in `src/views/`, native Swift files in `native/Isometry/Isometry/`
- `src/styles/design-tokens.css` -- Current token system (~40 tokens, dark-only)
- `src/providers/types.ts` -- `PersistableProvider` interface definition
- `src/providers/StateManager.ts` -- Existing Tier 2 persistence mechanism
- `src/audit/audit-colors.ts` -- Hardcoded hex colors needing migration
- `native/Isometry/Isometry/SettingsView.swift` -- Existing settings UI (add theme picker here)
- `native/Isometry/Isometry/ContentView.swift` -- WKWebView setup + evaluateJavaScript patterns

### Secondary (MEDIUM confidence)

- CSS `[data-theme]` pattern is well-established industry standard (Tailwind, Radix, Shadcn all use this approach)
- `var()` in SVG presentation attributes supported since Safari 15.4 (2022) -- project targets iOS 17 (Safari 17), safely above the threshold
- `@AppStorage` for SwiftUI persistence is standard Apple pattern since iOS 14

### Tertiary (LOW confidence)

- Light palette exact hex values (Code Example 1) -- derived from Tailwind shade conventions, need manual verification during implementation
- The `200ms` transition timing for THME-07 -- this is the requirement spec value; may need adjustment for perceptual smoothness

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- pure CSS custom properties + existing provider infrastructure, no new dependencies
- Architecture: HIGH -- `[data-theme]` pattern is locked decision (STATE.md), `PersistableProvider` interface is proven, native bridge patterns are established
- Pitfalls: HIGH -- codebase audit identified all hardcoded colors (audit-colors.ts, SuperGrid drag-over, NetworkView schemeCategory10, 4 inline rgba() in CSS)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain -- CSS custom properties and SwiftUI are mature)
