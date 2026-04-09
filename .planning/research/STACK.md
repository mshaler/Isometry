# Stack Research — v11.0 Navigation Bar Redesign

## Summary

Zero new npm packages needed. All four capabilities — dock layout, minimap thumbnails, 3-state collapse animations, and iOS Stories splash — are achievable with platform APIs already within the iOS 17+/Safari 17+ baseline.

## Dock Layout

- Pure CSS Flexbox — no new primitives needed
- Existing CSS custom property design token system handles theming
- Dock labels: inline below icons (CSS-only) preferred over floating overlays

## Minimap Thumbnails

Hybrid strategy required:
- **SVG-heavy views** (Network, Timeline, Calendar): `XMLSerializer` + `URL.createObjectURL` for SVG serialization
- **HTML-based views** (Grid, List, Kanban, SuperGrid): Simplified D3 micro-render to `OffscreenCanvas`
- **NOT recommended:** `html2canvas`, `html-to-image` — unreliable on WKWebView mixed SVG+HTML content
- All APIs confirmed available in Safari 16.4+ / iOS 17+

## 3-State Collapse Animations

- Replace existing `max-height: 0 → 500px` magic-number hack with CSS `grid-template-rows: 0fr → 1fr` trick
- Properly animates `height: auto` — available in Safari 16+ (within iOS 17 target)
- Zero JS changes needed; existing `data-state` attribute contract preserved

## View Transitions API

**Must NOT be used.** `document.startViewTransition()` requires Safari 18+; app targets iOS 17 (Safari 17 engine). Hard constraint.

## iOS Stories Splash

- SwiftUI `TabView(selection:).tabViewStyle(.page)` — built-in, hardware-accelerated, iOS 14+
- `fullScreenCover` gated on `@AppStorage("hasSeenWelcome")`
- No Lottie, no third-party carousel needed

## Existing Dependencies Available

- `@floating-ui/dom` v1.7.5 (from v10.0) — available if needed for dock tooltip positioning, but may not be needed if labels are inline

## What NOT to Add

- No React/framework — pure TypeScript + D3/DOM constraint preserved
- No html2canvas or html-to-image
- No View Transitions API polyfill
- No Lottie or animation libraries
- No carousel libraries for iOS Stories

## Open Questions

1. Whether dock labels appear inline below icons (CSS-only) or as floating overlays (needs @floating-ui/dom)
2. Whether minimap thumbnails update in real-time or only on view activation — affects debounce strategy
