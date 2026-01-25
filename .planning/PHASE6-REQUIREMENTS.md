# Phase 6: Native iOS/macOS Integration Requirements

**Project:** Isometry Notebook Sidecar - Native Integration
**Version:** v2.0
**Date:** 2026-01-25

## Integration Objective

Transform the completed React/D3 UI and Notebook features into native iOS/macOS apps that leverage existing infrastructure while providing superior performance and user experience within App Sandbox constraints.

## Requirement Categories

### Foundation & Architecture (NAT-FOUND)

**NAT-FOUND-01: SwiftUI Layout System**
Implement three-component layout using SwiftUI that matches React prototype patterns while leveraging existing SuperGrid Canvas infrastructure.
- **Acceptance:** Three-pane layout (Capture/Shell/Preview) renders in SwiftUI
- **Acceptance:** Layout adapts responsively to iOS/macOS screen sizes
- **Acceptance:** Component boundaries match React prototype proportions
- **Acceptance:** Layout state persists across app sessions using UserDefaults

**NAT-FOUND-02: Database Schema Extensions**
Extend existing GRDB.swift/SQLite schema to support notebook features while maintaining CloudKit sync compatibility.
- **Acceptance:** notebook_cards table added with CloudKit record mapping
- **Acceptance:** Existing node/edge queries continue working unchanged
- **Acceptance:** CloudKitSyncManager handles notebook card synchronization
- **Acceptance:** Database migration preserves existing data integrity

**NAT-FOUND-03: Navigation & State Architecture**
Establish navigation patterns and state management that integrate notebook workflow into existing iOS/macOS app structure.
- **Acceptance:** Notebook mode accessible from main app navigation
- **Acceptance:** AppState manages notebook context alongside existing providers
- **Acceptance:** Navigation preserves app state when switching modes
- **Acceptance:** Deep linking supports notebook card references

**NAT-FOUND-04: Performance Infrastructure**
Implement performance monitoring and optimization systems to maintain 60fps target with notebook features enabled.
- **Acceptance:** PerformanceMonitor tracks notebook rendering performance
- **Acceptance:** Canvas rendering maintains 60fps with 1000+ cards
- **Acceptance:** Memory usage stays under platform constraints
- **Acceptance:** Battery optimization adapts to iOS power management

### Capture Implementation (NAT-CAP)

**NAT-CAP-01: Native Text Editing**
Build native markdown editing with live preview using NSTextView/UITextView with custom markdown rendering.
- **Acceptance:** Rich text editing with markdown syntax highlighting
- **Acceptance:** Live preview pane updates in real-time
- **Acceptance:** Auto-save functionality with conflict resolution
- **Acceptance:** Keyboard shortcuts match platform conventions

**NAT-CAP-02: Property Management**
Create native property editing interface that integrates with existing Isometry card schema and CloudKit fields.
- **Acceptance:** Property panel shows/hides with native animations
- **Acceptance:** Text, date, tag, and reference property types supported
- **Acceptance:** Property validation uses existing Isometry type system
- **Acceptance:** CloudKit sync handles property changes automatically

**NAT-CAP-03: Template System**
Implement card template system using native UI patterns and local storage for custom templates.
- **Acceptance:** Template gallery uses native collection view
- **Acceptance:** Templates pre-populate markdown and properties
- **Acceptance:** Custom templates save to app document directory
- **Acceptance:** Template sharing via CloudKit document sync

**NAT-CAP-04: Slash Command Integration**
Port React slash command system to native using NSTextView/UITextView input methods and completion handlers.
- **Acceptance:** Slash commands trigger native completion interface
- **Acceptance:** Commands insert Isometry DSL patterns correctly
- **Acceptance:** Command suggestions adapt to current context
- **Acceptance:** Keyboard navigation supports command selection

### Shell Integration (NAT-SHELL)

**NAT-SHELL-01: App Sandbox Terminal**
Implement secure terminal functionality within App Sandbox constraints using NSTask/Process with restricted file access.
- **Acceptance:** Terminal emulation using native text views
- **Acceptance:** Command execution respects App Sandbox file access
- **Acceptance:** Process management handles background/foreground states
- **Acceptance:** Security prevents access to protected directories

**NAT-SHELL-02: Claude Code API Native Integration**
Integrate Claude Code API directly using URLSession and native networking without web dependencies.
- **Acceptance:** Native HTTP client handles Claude API authentication
- **Acceptance:** API responses display with native text formatting
- **Acceptance:** Request/response logging for debugging and optimization
- **Acceptance:** Error handling manages rate limits and network failures

**NAT-SHELL-03: Process Execution Framework**
Build secure process execution system that works within iOS/macOS sandbox while providing development workflow access.
- **Acceptance:** Command routing distinguishes system vs API calls
- **Acceptance:** Environment setup includes project-specific paths
- **Acceptance:** Process output streams to terminal interface
- **Acceptance:** Background execution continues when app backgrounded

**NAT-SHELL-04: Command History & Context**
Implement native command history with persistence and notebook context awareness using Core Data or SQLite.
- **Acceptance:** Command history persists across app sessions
- **Acceptance:** History search using native text filtering
- **Acceptance:** Context awareness includes current notebook state
- **Acceptance:** History export for workflow documentation

### Preview & Visualization (NAT-PREV)

**NAT-PREV-01: Native Canvas Rendering**
Port D3.js visualizations to native SwiftUI Canvas using existing SuperGrid patterns for superior performance.
- **Acceptance:** Canvas-based visualization matches D3 output
- **Acceptance:** Touch/trackpad gestures for pan/zoom
- **Acceptance:** Animation performance exceeds web version
- **Acceptance:** Multiple chart types supported natively

**NAT-PREV-02: WKWebView Integration**
Implement universal content preview using WKWebView with security policies for web content and local files.
- **Acceptance:** Web content renders with full browser functionality
- **Acceptance:** Local files display with appropriate viewers
- **Acceptance:** Security policies prevent unauthorized network access
- **Acceptance:** Preview state syncs with capture/shell components

**NAT-PREV-03: Export System**
Build native export functionality using platform APIs for PDF, image, and data format generation.
- **Acceptance:** PDF generation includes visualizations and formatting
- **Acceptance:** Native share sheet integration for multiple formats
- **Acceptance:** Batch export for multiple notebook cards
- **Acceptance:** Export templates match React prototype output

**NAT-PREV-04: Live Preview Updates**
Implement real-time preview updates that respond to capture and shell component changes using Combine publishers.
- **Acceptance:** Markdown changes trigger immediate preview updates
- **Acceptance:** Shell outputs update preview context automatically
- **Acceptance:** Visualization data updates reflect in real-time
- **Acceptance:** Update performance maintains app responsiveness

### Platform Integration (NAT-PLAT)

**NAT-PLAT-01: iOS-Specific Features**
Implement iOS-specific functionality including multitasking, background processing, and touch interface optimizations.
- **Acceptance:** Split view and slide-over modes supported
- **Acceptance:** Background app refresh handles data synchronization
- **Acceptance:** Touch interface optimized for finger navigation
- **Acceptance:** iOS 16+ features enhance user experience

**NAT-PLAT-02: macOS-Specific Features**
Implement macOS-specific functionality including multiple windows, menu bar, and keyboard/trackpad optimizations.
- **Acceptance:** Multiple document windows supported
- **Acceptance:** Menu bar integration with standard commands
- **Acceptance:** Trackpad gestures enhance navigation
- **Acceptance:** macOS 14+ features improve desktop workflow

**NAT-PLAT-03: CloudKit Integration**
Extend existing CloudKitSyncManager to handle notebook data synchronization across devices with conflict resolution.
- **Acceptance:** Notebook cards sync across iOS/macOS devices
- **Acceptance:** Conflict resolution preserves user data integrity
- **Acceptance:** Offline editing with sync when network available
- **Acceptance:** Sync status indicates data transmission state

**NAT-PLAT-04: App Store Compliance**
Ensure all features comply with App Store review guidelines while maintaining functionality within sandbox constraints.
- **Acceptance:** App Store review guidelines compliance verified
- **Acceptance:** Sandbox restrictions respected for file access
- **Acceptance:** Privacy policy covers data handling practices
- **Acceptance:** No restricted APIs used without proper entitlements

## Version 3 (Future) Requirements

These requirements are explicitly deferred to maintain Phase 6 scope:

- **Advanced shell features** beyond basic terminal emulation
- **Plugin architecture** for extensible notebook components
- **Real-time collaboration** with conflict resolution
- **Advanced visualization builders** beyond port of existing D3
- **Apple Pencil support** for iOS drawing capabilities
- **Shortcuts app integration** for automation workflows
- **Document provider extensions** for Files app integration

## Success Metrics

### Functional Parity
- **Capture workflow** matches React prototype functionality
- **Shell integration** provides equivalent Claude Code access
- **Preview capabilities** exceed web version performance
- **Export functions** generate identical output formats

### Performance Targets
- **Rendering performance** maintains 60fps with 1000+ cards
- **Memory efficiency** uses 50% less RAM than React version
- **Battery optimization** extends device battery life
- **Launch time** under 3 seconds cold start

### Platform Integration
- **CloudKit sync** operates seamlessly across devices
- **App Store compliance** passes review without issues
- **Platform features** enhance user experience beyond web
- **Security model** protects user data within sandbox

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAT-FOUND-01 | Phase 6.1 | Pending |
| NAT-FOUND-02 | Phase 6.1 | Pending |
| NAT-FOUND-03 | Phase 6.1 | Pending |
| NAT-FOUND-04 | Phase 6.1 | Pending |
| NAT-CAP-01 | Phase 6.2 | Pending |
| NAT-CAP-02 | Phase 6.2 | Pending |
| NAT-CAP-03 | Phase 6.2 | Pending |
| NAT-CAP-04 | Phase 6.2 | Pending |
| NAT-SHELL-01 | Phase 6.3 | Pending |
| NAT-SHELL-02 | Phase 6.3 | Pending |
| NAT-SHELL-03 | Phase 6.3 | Pending |
| NAT-SHELL-04 | Phase 6.3 | Pending |
| NAT-PREV-01 | Phase 6.4 | Pending |
| NAT-PREV-02 | Phase 6.4 | Pending |
| NAT-PREV-03 | Phase 6.4 | Pending |
| NAT-PREV-04 | Phase 6.4 | Pending |
| NAT-PLAT-01 | Phase 6.4 | Pending |
| NAT-PLAT-02 | Phase 6.4 | Pending |
| NAT-PLAT-03 | Phase 6.4 | Pending |
| NAT-PLAT-04 | Phase 6.4 | Pending |

**Total Phase 6 Requirements:** 20
**Requirements by Category:**
- Foundation: 4 requirements
- Capture: 4 requirements
- Shell: 4 requirements
- Preview: 4 requirements
- Platform: 4 requirements