# Features Research — v11.0 Navigation Bar Redesign

## Table Stakes (Must Have)

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Icon + label per dock item | LOW | iconSvg() already exists |
| Hover tooltip for icon-only mode | LOW | Native `title` attribute |
| Active state indicator | LOW | CSS class on button |
| Click-to-activate | LOW | Preserves existing callback contract |
| Dock collapse/expand toggle with mode persistence | LOW | `data-dock-mode` + ui_state |
| Keyboard accessibility preservation | LOW | Roving tabindex already exists, must not regress |
| Smooth CSS width transition between modes | LOW | `transition: width 200ms ease` |
| Live thumbnail reflecting current data state | HIGH | Hardest table-stakes item |
| Loupe/magnifier overlay on thumbnail hover | MEDIUM | Viewport indicator |
| Thumbnail border/frame | LOW | Visual container |

## Differentiators (Nice to Have)

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Live CSS-transform minimap via lazy DOM clone | HIGH | Unique to SVG/DOM-based D3 views |
| PAFV axis summary label in thumbnail | LOW | Unique to PAFV architecture |
| Verb→noun taxonomy (Integrate/Visualize/Analyze/Activate/Help) | MEDIUM | Conceptual model reorganization |
| Stub dock entries for Maps/Formulas/Stories | LOW | Placeholder UI |
| Stories Explorer as mini-app launcher | HIGH | New concept — datasets + views + controls |
| iOS splash = Stories launcher grid | HIGH | SwiftUI entry point |

## Anti-Features (Do NOT Build)

| Feature | Why Not |
|---------|---------|
| Hover-to-activate | Fires during transit, triggers expensive SQL+D3 rerender |
| Animated dock magnification (macOS Dock style) | Layout shift, defeats thumbnail usefulness |
| Drag-and-drop dock reordering | Breaks verb→noun taxonomy model |
| All 9 view thumbnails simultaneously | Performance budget violation |
| Real-time thumbnail streaming on every mutation | Doubles render load |
| Native SwiftUI dock | Creates two sources of truth for dock state |
| Animated Stories splash transitions | Bridge timing coordination hell |

## Dependency Graph

1. **Explorer decoupling** (highest risk) — must happen first, own phase, full regression pass
2. **Dock navbar layout** — depends on explorer decoupling (explorers must be out of sidebar first)
3. **Verb→noun taxonomy** — can accompany dock layout (rename + regroup)
4. **3-state collapse** — depends on dock layout structure
5. **Minimap thumbnails** — depends on dock layout (needs thumbnail slot in DOM)
6. **Stories Explorer stub** — independent, can parallel with dock work
7. **iOS Stories splash** — depends on Stories concept definition

## Competitor Analysis

- **macOS Dock:** Icon + label + magnification — we take icon+label, skip magnification
- **VS Code Activity Bar:** Icon-only sidebar with active indicator — similar to our icon-only mode
- **Figma left panel:** Section headers with collapsible content — similar to our verb sections
- **Notion Mobile:** App launcher grid on home — model for Stories splash
- **iOS Shortcuts:** Gallery of mini-apps — model for Stories concept

## MVP Phases (Suggested)

1. Explorer decoupling (move explorers from sidebar to main panel)
2. Dock navbar structure (icon + label + verb sections + 3-state)
3. Minimap thumbnail infrastructure
4. Stub entries (Maps, Formulas, Stories)
5. iOS Stories splash screen
