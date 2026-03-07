# Requirements: Isometry v4.2 Polish + QoL

**Defined:** 2026-03-07
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v4.2 Requirements

Requirements for polish + QoL milestone. Each maps to roadmap phases.

### Build Health

- [x] **BUILD-01**: tsc --noEmit passes with zero errors on all source and test files
- [x] **BUILD-02**: Biome 2.x lint check passes on all TypeScript source files
- [x] **BUILD-03**: Xcode npm Run Script build phase succeeds (correct package.json path)
- [x] **BUILD-04**: Provisioning profile includes CloudKit and iCloud Documents entitlements
- [x] **BUILD-05**: GitHub Actions CI runs tsc, biome check, and vitest on push

### Empty States + First Launch

- [x] **EMPTY-01**: User sees welcome panel with Import File and Import from Mac CTAs when database has zero cards
- [x] **EMPTY-02**: User sees "No cards match filters" with Clear Filters action when filters hide all results
- [x] **EMPTY-03**: Each of 9 views shows view-specific empty message relevant to that view type
- [x] **EMPTY-04**: SuperGrid explains when density settings hide all visible rows

### Keyboard Shortcuts + Navigation

- [x] **KEYS-01**: User can press Cmd+1 through Cmd+9 to switch between the 9 views
- [x] **KEYS-02**: macOS menu bar has View menu listing all 9 views with keyboard shortcut indicators
- [x] **KEYS-03**: User can press ? to open global keyboard shortcut reference overlay
- [x] **KEYS-04**: ShortcutRegistry centralizes all web-side keyboard handlers with consistent input field guards

### Visual Polish

- [x] **VISU-01**: All hardcoded rgba/hex colors in JS inline styles replaced with design token references
- [x] **VISU-02**: All hardcoded font-size values replaced with semantic typography scale tokens
- [x] **VISU-03**: Toolbar shows consistent global items across all views with per-view items contextual
- [x] **VISU-04**: Interactive elements show CSS :focus-visible rings for keyboard navigation

### Stability + Error Handling

- [x] **STAB-01**: Error banner shows categorized user-friendly messages with specific recovery actions
- [x] **STAB-02**: All pre-existing test failures fixed (SuperGridSizer + handler tests)
- [x] **STAB-03**: JSON parser surfaces clear warning when input format is unrecognized (no silent 0-card return)
- [x] **STAB-04**: Undo/redo shows brief toast with action description

### ETL Validation

- [x] **ETLV-01**: All 6 file-based sources import successfully with correct card/connection output
- [x] **ETLV-02**: All 3 native macOS sources import successfully with correct card output
- [ ] **ETLV-03**: Imported data renders correctly in all 9 views across high-value source/view combinations
- [ ] **ETLV-04**: Import errors surface clear actionable messages for each source type
- [ ] **ETLV-05**: Dedup engine correctly handles re-import across all 9 sources

## Future Requirements

### Deferred from v4.2

- **CMD-01**: Command palette (Cmd+K) with fuzzy search across all actions
- **A11Y-01**: Full WCAG 2.1 AA accessibility audit and compliance
- **THEME-01**: Light mode / system theme preference support
- **SMART-01**: Smart per-view empty state CTAs (Calendar: "import events with dates", Network: "import connections")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full onboarding wizard | Power user tool -- single welcome panel sufficient |
| Sample/demo data at first launch | User's data is the value; fake data creates confusion |
| Light mode | Doubles CSS testing surface; dark-by-design for data viz |
| Custom keyboard shortcut remapping | Only ~15 actions; standard platform shortcuts sufficient |
| In-app changelog / what's new modal | Not needed for local-first personal app |
| Tooltip system | SF Symbols + title attributes sufficient |
| Full command palette (Cmd+K) | HIGH complexity; deferred to dedicated milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 42 | Complete |
| BUILD-02 | Phase 42 | Complete |
| BUILD-03 | Phase 42 | Complete |
| BUILD-04 | Phase 42 | Complete |
| BUILD-05 | Phase 42 | Complete |
| EMPTY-01 | Phase 43 | Complete |
| EMPTY-02 | Phase 43 | Complete |
| EMPTY-03 | Phase 43 | Complete |
| EMPTY-04 | Phase 43 | Complete |
| KEYS-01 | Phase 44 | Complete |
| KEYS-02 | Phase 44 | Complete |
| KEYS-03 | Phase 44 | Complete |
| KEYS-04 | Phase 44 | Complete |
| VISU-01 | Phase 45 | Complete |
| VISU-02 | Phase 45 | Complete |
| VISU-03 | Phase 45 | Complete |
| VISU-04 | Phase 45 | Complete |
| STAB-01 | Phase 46 | Complete |
| STAB-02 | Phase 42 | Complete |
| STAB-03 | Phase 46 | Complete |
| STAB-04 | Phase 46 | Complete |
| ETLV-01 | Phase 47 | Complete |
| ETLV-02 | Phase 47 | Complete |
| ETLV-03 | Phase 47 | Pending |
| ETLV-04 | Phase 47 | Pending |
| ETLV-05 | Phase 47 | Pending |

**Coverage:**
- v4.2 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation (traceability complete)*
