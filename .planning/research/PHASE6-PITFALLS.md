# Domain Pitfalls: Phase 6 Native Integration

**Domain:** Native iOS/macOS integration of React features
**Researched:** 2026-01-25

## Critical Pitfalls

Mistakes that cause rewrites or major issues during React→Native migration.

### Pitfall 1: D3.js Direct Port Attempt
**What goes wrong:** Attempting to port complex D3.js visualizations line-by-line to Swift Canvas
**Why it happens:** Underestimating fundamental differences between DOM manipulation and Canvas drawing
**Consequences:**
- Massive development effort (weeks to months)
- Poor performance from trying to replicate DOM patterns
- Feature gaps where D3 capabilities don't translate
- Potential project scope explosion

**Prevention:**
- Start with essential visualizations only (scatter plots, bar charts, line graphs)
- Leverage existing SuperGrid Canvas patterns which already demonstrate 60fps performance
- Use data-driven approach: focus on the data transformations, not the D3 animation system
- Consider visualization subset that provides 80% of value with 20% of effort

**Detection:** Warning signs include:
- Attempting to recreate D3's selection/update/exit pattern in Swift
- Trying to port D3 animation system to SwiftUI animations
- Spending more than 1 week on visualization rendering pipeline

### Pitfall 2: React Context → Swift ObservableObject Naive Translation
**What goes wrong:** Direct translation of React Context patterns without understanding SwiftUI observation
**Why it happens:** Assuming React and SwiftUI state management are equivalent
**Consequences:**
- Performance degradation from excessive @Published updates
- View invalidation cascades that break 60fps target
- Memory leaks from improper observation cleanup
- Race conditions in async state updates

**Prevention:**
- Study existing SuperGridViewModel patterns which already solve these problems
- Use @StateObject and @ObservableObject according to SwiftUI ownership model
- Batch state updates to minimize @Published spam (existing pattern in SuperGridViewModel)
- Leverage Combine for debouncing and async operations (proven in auto-save)

**Detection:** Warning signs include:
- UI becoming unresponsive during typing
- Memory usage growing continuously during normal operation
- Multiple @Published properties updating simultaneously
- Async operations not properly cancelled on view disappear

### Pitfall 3: Cross-Platform Security Model Mismatch
**What goes wrong:** Assuming browser sandbox model applies to native app security
**Why it happens:** React version uses iframe/browser security, native apps have different constraints
**Consequences:**
- App Store rejection due to inappropriate process execution
- Security vulnerabilities from shell command execution
- Claude API integration blocked by sandbox restrictions
- Terminal functionality limited or broken

**Prevention:**
- Use NSTask with explicit entitlements and sandboxing
- Implement command allowlist rather than executing arbitrary shell commands
- Design Claude API integration to work within App Sandbox constraints
- Test early with App Store sandbox restrictions enabled

**Detection:** Warning signs include:
- Shell commands failing in sandbox but working in development
- Claude API requests blocked by network restrictions
- File access permissions causing runtime failures
- Entitlements requests that Apple is likely to reject

### Pitfall 4: Web Technology Dependency Leakage
**What goes wrong:** Unconsciously depending on web browser capabilities that don't exist natively
**Why it happens:** React implementation uses iframe, fetch, localStorage patterns
**Consequences:**
- Feature gaps where web capabilities don't translate
- Poor user experience from trying to replicate browser behavior
- Increased complexity from bridging web/native worlds
- Performance penalties from unnecessary abstractions

**Prevention:**
- Identify all web-specific features during planning (not during implementation)
- Use native alternatives: WKWebView instead of iframe, URLSession instead of fetch
- Embrace native patterns rather than trying to replicate web behavior
- Focus on native user experience improvements

**Detection:** Warning signs include:
- Attempting to use web APIs in native code
- Building unnecessary abstraction layers to mimic web behavior
- User experience that feels like a ported web app
- Performance characteristics significantly worse than native patterns

## Moderate Pitfalls

Mistakes that cause delays or technical debt but are recoverable.

### Pitfall 1: Terminal Emulation Complexity Creep
**What goes wrong:** Attempting to build full terminal emulator instead of command interface
**Prevention:** Focus on command input/output display, not terminal emulation features
**Detection:** Spending time on terminal escape sequences, color handling, or cursor positioning

### Pitfall 2: Markdown Editor Feature Parity Obsession
**What goes wrong:** Trying to replicate every feature of @uiw/react-md-editor
**Prevention:** Use native text frameworks with essential markdown support only
**Detection:** Implementing custom markdown parser instead of using AttributedString

### Pitfall 3: Export Format Completeness
**What goes wrong:** Attempting to support every possible export format from day one
**Prevention:** Start with native sharing/export APIs, add formats incrementally
**Detection:** Building custom PDF/HTML generation instead of using system frameworks

### Pitfall 4: State Management Over-Engineering
**What goes wrong:** Building complex state synchronization system between components
**Prevention:** Leverage existing AppState patterns and simple @ObservableObject hierarchy
**Detection:** Creating custom Combine publishers when simple @Published would work

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 1: Auto-Save Timer Precision
**What goes wrong:** Implementing JavaScript-style setTimeout patterns in Swift
**Prevention:** Use Combine debouncing patterns from existing codebase
**Detection:** Creating manual Timer objects for auto-save functionality

### Pitfall 2: Theme System Inconsistency
**What goes wrong:** Not properly integrating with existing NeXTSTEP/Modern theme system
**Prevention:** Extend existing theme patterns rather than creating new ones
**Detection:** Hardcoded colors instead of theme-aware color schemes

### Pitfall 3: Layout Responsiveness
**What goes wrong:** Fixed layouts that don't adapt to different window sizes
**Prevention:** Use existing responsive patterns from SuperGrid implementation
**Detection:** Fixed frame sizes instead of adaptive layout priorities

### Pitfall 4: Keyboard Shortcut Conflicts
**What goes wrong:** Notebook shortcuts conflicting with main app shortcuts
**Prevention:** Audit existing shortcuts and follow macOS/iOS HIG patterns
**Detection:** User confusion about which shortcuts work where

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation Layout | Over-engineering responsive behavior | Start with fixed three-pane, optimize later |
| Capture Component | Markdown parsing complexity | Use AttributedString.markdown, avoid custom parsers |
| Shell Integration | Security sandbox restrictions | Test with App Sandbox early, design within constraints |
| Canvas Visualization | D3.js feature parity attempts | Focus on essential visualizations, leverage existing patterns |
| Performance | Premature optimization | Use existing SuperGrid performance patterns as baseline |
| Integration | State management complexity | Extend existing AppState rather than rebuilding |

## Critical Success Patterns

### Follow Existing Native Patterns
- **SuperGrid performance** - 60fps Canvas rendering already proven
- **Database architecture** - GRDB + Actor patterns handle notebook data
- **CloudKit sync** - Existing infrastructure supports notebook cards automatically
- **State management** - AppState + @ObservableObject patterns established

### Embrace Platform Capabilities
- **NSAttributedString** for rich text instead of custom markdown rendering
- **WKWebView** for web content instead of custom browser implementation
- **NSTask** for process execution instead of complex terminal emulation
- **NSSharingService/UIActivityViewController** for export instead of custom formats

### Incremental Feature Migration
- **Start minimal** - Basic three-pane layout with text editing
- **Add incrementally** - One component feature at a time
- **Validate continuously** - Each feature should match or exceed React version
- **Optimize last** - Get functionality working, then optimize performance

## Validation Checkpoints

### Phase 1 Validation
- [ ] Three-pane layout renders without web dependencies
- [ ] Navigation between main app and notebook preserves state
- [ ] Database schema extension doesn't break existing queries
- [ ] Performance matches existing SuperGrid benchmarks

### Phase 2 Validation
- [ ] Text editing feels native (better than React version)
- [ ] Auto-save works reliably without data loss
- [ ] Property editing integrates properly with existing node system
- [ ] No custom markdown parsing (uses system frameworks)

### Phase 3 Validation
- [ ] Shell commands execute within App Sandbox constraints
- [ ] Claude API works with proper error handling and rate limiting
- [ ] Terminal UI responsive and doesn't block other components
- [ ] Security model approved for App Store submission

### Phase 4 Validation
- [ ] Canvas visualizations perform at 60fps like SuperGrid
- [ ] Export functionality uses native sharing/save APIs
- [ ] WKWebView integration handles edge cases properly
- [ ] Memory usage comparable to main SuperGrid app

## Sources

- SuperGrid implementation pitfalls avoided in existing codebase
- iOS/macOS App Sandbox documentation and constraints
- SwiftUI performance patterns and anti-patterns
- App Store review guidelines for shell/process execution
- Native text editing framework capabilities and limitations