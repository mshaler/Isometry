# Requirements — v11.0 Navigation Bar Redesign

## Milestone Requirements

### Dock Navbar

- [x] **DOCK-01**: User sees a dock-style navbar with Lucide SVG icon (48×48) + label per item
- [x] **DOCK-02**: User sees active dock item highlighted with visual indicator
- [x] **DOCK-03**: User clicks dock item to activate corresponding explorer/view in main panel
- [x] **DOCK-04**: User sees dock organized by verb→noun sections: Integrate (Data, Properties), Visualize (SuperGrids, Timelines, Charts, Graphs), Analyze (Filters), Activate (Stories, Notebooks), Help (Settings)
- [ ] **DOCK-05**: User sees PAFV axis summary label per visualization dock item showing current axis configuration
- [x] **DOCK-06**: User can use existing keyboard shortcuts (Cmd+1-9) to activate dock items without regression

### 3-State Collapse

- [x] **CLPS-01**: User can collapse dock to 3 states: Hidden, Icon-only, Icon+Thumbnail
- [x] **CLPS-02**: User clicks dock icon to snap between the 3 collapse states
- [x] **CLPS-03**: User sees smooth CSS animation when transitioning between collapse states
- [x] **CLPS-04**: Dock collapse state persists across sessions via ui_state

### Minimap Thumbnails

- [ ] **MMAP-01**: User sees a 96×48 minimap thumbnail per dock item reflecting current data/view state
- [ ] **MMAP-02**: Thumbnails render lazily on hover or dock expansion, not live-subscribed to state changes
- [ ] **MMAP-03**: User sees a loupe/viewport overlay on thumbnails indicating visible portion vs full canvas
- [ ] **MMAP-04**: Thumbnail rendering does not block main thread (async via OffscreenCanvas/requestIdleCallback)

### Explorer Decoupling

- [ ] **DCPL-01**: Explorers render in the main panel, not inside the dock navbar
- [ ] **DCPL-02**: Dock navbar provides navigation context only — no filter controls or explorer content in dock
- [ ] **DCPL-03**: All existing explorer functionality preserved after decoupling (Properties, Projection, Visual, LATCH, Data, Notebook, Algorithm, Calc)

### Stub Entries

- [ ] **STUB-01**: User sees Maps dock entry with placeholder icon and "Coming soon" panel content
- [ ] **STUB-02**: User sees Formulas dock entry with placeholder icon and "Coming soon" panel content
- [ ] **STUB-03**: User sees Stories dock entry with placeholder icon and "Coming soon" panel content

### iOS Stories Splash

- [ ] **SPLS-01**: iOS app launches to Stories Explorer as the primary splash/home screen
- [ ] **SPLS-02**: Stories splash screen displays as a mini-app launcher grid (datasets + views + controls concept)
- [ ] **SPLS-03**: User can dismiss splash to access the full Workbench with WKWebView already warmed up
- [ ] **SPLS-04**: WASM warm-up remains unconditional in IsometryApp.task{} — not gated on splash dismissal

### Accessibility & Themes

- [x] **A11Y-01**: Dock uses correct ARIA role (tablist) with labeled navigation landmark — no duplicate nav landmarks
- [x] **A11Y-02**: Roving tabindex keyboard navigation works within dock (arrow keys between items)
- [x] **A11Y-03**: All 5 design themes render dock correctly with complete CSS token coverage
- [x] **A11Y-04**: VoiceOver announces dock state changes (collapse transitions, item activation)

## Future Requirements

- Stories Explorer full mini-app implementation (datasets + views + controls) — deferred to main window UX milestone
- Maps geospatial visualization implementation — deferred
- Formulas query/formatting engine implementation — deferred
- Main window UX flows (macOS + iOS panel management) — deferred to follow-up milestone

## Out of Scope

- Main window UX flows — explicitly deferred to next major sprint
- Animated dock magnification (macOS Dock style) — layout shift, defeats thumbnail usefulness
- Drag-and-drop dock reordering — breaks verb→noun taxonomy model
- Real-time thumbnail streaming on every mutation — doubles render load
- Native SwiftUI dock — creates two sources of truth for dock state
- View Transitions API — requires Safari 18+, app targets iOS 17 (Safari 17)

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| DOCK-01 | Phase 146 | — | Pending |
| DOCK-02 | Phase 146 | — | Pending |
| DOCK-03 | Phase 146 | — | Pending |
| DOCK-04 | Phase 146 | — | Pending |
| DOCK-05 | Phase 148 | — | Pending |
| DOCK-06 | Phase 145 | — | Pending |
| CLPS-01 | Phase 147 | — | Pending |
| CLPS-02 | Phase 147 | — | Pending |
| CLPS-03 | Phase 147 | — | Pending |
| CLPS-04 | Phase 147 | — | Pending |
| MMAP-01 | Phase 148 | — | Pending |
| MMAP-02 | Phase 148 | — | Pending |
| MMAP-03 | Phase 148 | — | Pending |
| MMAP-04 | Phase 148 | — | Pending |
| DCPL-01 | Phase 149 | — | Pending |
| DCPL-02 | Phase 149 | — | Pending |
| DCPL-03 | Phase 149 | — | Pending |
| STUB-01 | Phase 149 | — | Pending |
| STUB-02 | Phase 149 | — | Pending |
| STUB-03 | Phase 149 | — | Pending |
| SPLS-01 | Phase 150 | — | Pending |
| SPLS-02 | Phase 150 | — | Pending |
| SPLS-03 | Phase 150 | — | Pending |
| SPLS-04 | Phase 150 | — | Pending |
| A11Y-01 | Phase 147 | — | Pending |
| A11Y-02 | Phase 147 | — | Pending |
| A11Y-03 | Phase 146 | — | Pending |
| A11Y-04 | Phase 147 | — | Pending |
