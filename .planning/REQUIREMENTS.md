# Requirements: Isometry v4.4 UX Complete

**Defined:** 2026-03-07
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v4.4 Requirements

Requirements for v4.4 UX Complete milestone. Each maps to roadmap phases.

### Theme System

- [x] **THME-01**: User can switch between Light, Dark, and System theme via 3-way toggle in settings
- [x] **THME-02**: Light mode defines all ~40 CSS design tokens with appropriate light-background values
- [x] **THME-03**: System mode follows macOS/iOS appearance preference via prefers-color-scheme media query
- [x] **THME-04**: Theme preference persists across sessions via StateManager (Tier 2)
- [x] **THME-05**: All D3 view SVG elements reference CSS custom properties (no hardcoded hex in rendering code)
- [x] **THME-06**: Native SwiftUI shell syncs theme with WKWebView via data-theme attribute
- [x] **THME-07**: Theme transition uses 200ms animation to prevent jarring flash on toggle

### Accessibility

- [x] **A11Y-01**: All text meets WCAG 2.1 AA contrast ratio (4.5:1 normal, 3:1 large) in both light and dark themes
- [x] **A11Y-02**: All non-text UI elements (borders, icons, focus indicators) meet 3:1 contrast ratio
- [x] **A11Y-03**: All SVG view roots have role="img" with descriptive aria-label (view name + card count)
- [x] **A11Y-04**: SuperGrid uses role="table" with aria-rowcount/aria-colcount for screen reader structure
- [x] **A11Y-05**: Toolbar, sidebar, and main content have ARIA landmark roles (role="navigation", role="main")
- [x] **A11Y-06**: Skip-to-content link allows keyboard users to bypass toolbar
- [x] **A11Y-07**: aria-live="polite" region announces view switches, filter changes, import completion
- [ ] **A11Y-08**: :focus-visible indicators on all interactive elements including SVG nodes and toolbar buttons
- [ ] **A11Y-09**: Tree nodes expand/collapse via Enter/Space keyboard, Network nodes selectable via Tab+Enter
- [x] **A11Y-10**: prefers-reduced-motion disables D3 transitions, SVG morphs, and crossfade animations
- [ ] **A11Y-11**: Command palette follows WAI-ARIA combobox pattern with aria-expanded, aria-activedescendant

### Command Palette

- [ ] **CMDK-01**: User can open command palette via Cmd+K from any state
- [ ] **CMDK-02**: Fuzzy search matches across views, actions, shortcuts, and settings
- [ ] **CMDK-03**: Card search results appear via existing FTS5 Worker handler with debounced input
- [ ] **CMDK-04**: Keyboard navigation: arrow keys move selection, Enter executes, Escape closes
- [ ] **CMDK-05**: Results grouped by category (Views, Actions, Cards, Settings) with visual headers
- [ ] **CMDK-06**: Each result shows keyboard shortcut hint where applicable (e.g., Cmd+1 next to "List View")
- [ ] **CMDK-07**: Recent commands section shows last 5 invoked commands at top before search results
- [ ] **CMDK-08**: Contextual commands appear only when relevant (e.g., "Clear Filters" only when filters active)

### Sample Data + Empty States

- [ ] **SMPL-01**: Welcome panel shows "Try with sample data" CTA alongside existing import buttons
- [ ] **SMPL-02**: One-click sample data loads ~25 curated cards with connections covering all 9 view types
- [ ] **SMPL-03**: Sample data uses distinct source='sample' for identification in audit overlay
- [ ] **SMPL-04**: User can clear all sample data via command palette or settings without affecting real imports
- [ ] **SMPL-05**: Per-view empty states show guided CTAs specific to each view (e.g., "Import notes to see your network graph")
- [ ] **SMPL-06**: Sample data flows through existing DedupEngine + SQLiteWriter pipeline (no special write path)
- [ ] **SMPL-07**: Sample data is excluded from CloudKit sync pipeline

## Future Requirements

### SuperCalc (SQL DSL)

- **CALC-01**: User can define calculated fields using SQL DSL syntax
- **CALC-02**: Calculated fields display in SuperGrid cells at group intersections
- **CALC-03**: Calculated fields are visually distinct from raw data (audit overlay integration)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full ARIA grid pattern on SuperGrid | role="table" sufficient; role="grid" with virtual scrolling is extremely complex |
| WCAG AAA compliance | AA is the standard; AAA would constrain visual design |
| Custom keyboard shortcut remapping | ~15 standard platform shortcuts; remapping adds settings complexity |
| AI/LLM integration in command palette | Scope creep; fuzzy text search is fast and sufficient for local-first app |
| Interactive walkthrough / coach marks | Command palette surfaces discoverability naturally |
| Full onboarding wizard | Power user tool; welcome panel with CTAs is sufficient |
| HyperFormula for SuperCalc | Replaced permanently by SQL DSL approach |
| SVG roving tabindex across all views | HIGH complexity; defer to future milestone after basic keyboard nav |
| Screen reader data table alternatives for SVG | Parallel hidden tables too complex; defer to future |
| Per-view theming / multiple concurrent themes | CSS custom properties inherit globally; one theme everywhere |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THME-01 | Phase 49 | Complete |
| THME-02 | Phase 49 | Complete |
| THME-03 | Phase 49 | Complete |
| THME-04 | Phase 49 | Complete |
| THME-05 | Phase 49 | Complete |
| THME-06 | Phase 49 | Complete |
| THME-07 | Phase 49 | Complete |
| A11Y-01 | Phase 50 | Complete |
| A11Y-02 | Phase 50 | Complete |
| A11Y-03 | Phase 50 | Complete |
| A11Y-04 | Phase 50 | Complete |
| A11Y-05 | Phase 50 | Complete |
| A11Y-06 | Phase 50 | Complete |
| A11Y-07 | Phase 50 | Complete |
| A11Y-08 | Phase 50 | Pending |
| A11Y-09 | Phase 50 | Pending |
| A11Y-10 | Phase 50 | Complete |
| A11Y-11 | Phase 50 | Pending |
| CMDK-01 | Phase 51 | Pending |
| CMDK-02 | Phase 51 | Pending |
| CMDK-03 | Phase 51 | Pending |
| CMDK-04 | Phase 51 | Pending |
| CMDK-05 | Phase 51 | Pending |
| CMDK-06 | Phase 51 | Pending |
| CMDK-07 | Phase 51 | Pending |
| CMDK-08 | Phase 51 | Pending |
| SMPL-01 | Phase 52 | Pending |
| SMPL-02 | Phase 52 | Pending |
| SMPL-03 | Phase 52 | Pending |
| SMPL-04 | Phase 52 | Pending |
| SMPL-05 | Phase 52 | Pending |
| SMPL-06 | Phase 52 | Pending |
| SMPL-07 | Phase 52 | Pending |

**Coverage:**
- v4.4 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
