# Phase 6: Native iOS/macOS Integration Roadmap

**Project:** Isometry Notebook Sidecar - Native Integration
**Version:** v2.0 (Post React Prototype)
**Target:** Production-ready native iOS/macOS apps
**Approach:** Four-phase incremental native porting

---

## Milestone Overview

**Objective:** Integrate the completed React/D3 UI and Notebook features into native iOS/macOS apps for superior performance and user experience while leveraging existing native infrastructure and maintaining App Store compliance.

### Integration Strategy

Transform proven React prototype patterns into native SwiftUI implementations that exceed web performance while preserving full functionality within iOS/macOS security constraints.

**Key Integration Points:**
1. **React SuperGrid → SwiftUI Canvas**: Port D3.js visualization to existing SuperGrid Canvas patterns
2. **Notebook Sidecar → Native**: Three-component layout (Capture/Shell/Preview) using SwiftUI
3. **Terminal Integration → App Sandbox**: Process execution within iOS/macOS security constraints
4. **Claude Code API → Native**: Direct URLSession integration replacing web-based approach

## Phase Breakdown

### Phase 6.1: Foundation & Layout
**Goal:** Native app infrastructure supports notebook workflow with three-component layout and database integration
**Dependencies:** None (leverages existing native infrastructure)
**Requirements:** NAT-FOUND-01, NAT-FOUND-02, NAT-FOUND-03, NAT-FOUND-04
**Plans:** 4 plans

**Success Criteria:**
1. User can access notebook mode from main iOS/macOS app navigation
2. Three-component SwiftUI layout renders with responsive sizing
3. Database schema extensions support notebook cards with CloudKit sync
4. Navigation preserves state between main app and notebook modes
5. Performance monitoring tracks notebook operations at 60fps target

Plans:
- [ ] 06.1-01: SwiftUI three-component layout with responsive design
- [ ] 06.1-02: Database schema extension and CloudKit integration
- [ ] 06.1-03: Navigation architecture and state management
- [ ] 06.1-04: Performance infrastructure and monitoring setup

### Phase 6.2: Capture Implementation
**Goal:** Users can create and edit rich markdown notebook cards with native text editing and property management
**Dependencies:** Phase 6.1 (requires foundation and database)
**Requirements:** NAT-CAP-01, NAT-CAP-02, NAT-CAP-03, NAT-CAP-04
**Plans:** 4 plans

**Success Criteria:**
1. User can edit markdown with native text views and live preview
2. User can manage card properties through native interface panels
3. User can select and create cards from native template gallery
4. User can trigger slash commands through native text input completion
5. Auto-save preserves work with CloudKit synchronization

Plans:
- [ ] 06.2-01: Native markdown editor with NSTextView/UITextView
- [ ] 06.2-02: Property management interface with CloudKit integration
- [ ] 06.2-03: Template system using native collection views
- [ ] 06.2-04: Slash command system with native completion

### Phase 6.3: Shell Integration
**Goal:** Users can execute terminal commands and interact with Claude Code API within App Sandbox security constraints
**Dependencies:** Phase 6.2 (requires capture workflow for context)
**Requirements:** NAT-SHELL-01, NAT-SHELL-02, NAT-SHELL-03, NAT-SHELL-04
**Plans:** 4 plans

**Success Criteria:**
1. User can execute sandboxed system commands in native terminal interface
2. User can interact with Claude Code API through direct URLSession integration
3. Terminal commands respect App Sandbox file access restrictions
4. Command history persists across app sessions with native search
5. Process execution continues appropriately when app backgrounds

Plans:
- [ ] 06.3-01: App Sandbox terminal with NSTask/Process security
- [ ] 06.3-02: Claude Code API native integration via URLSession
- [ ] 06.3-03: Secure process execution framework within sandbox
- [ ] 06.3-04: Command history and context management

### Phase 6.4: Preview & Platform Integration
**Goal:** Users can preview content with native Canvas visualizations and export capabilities while experiencing seamless platform integration
**Dependencies:** Phase 6.3 (requires full workflow for integration testing)
**Requirements:** NAT-PREV-01, NAT-PREV-02, NAT-PREV-03, NAT-PREV-04, NAT-PLAT-01, NAT-PLAT-02, NAT-PLAT-03, NAT-PLAT-04
**Plans:** 4 plans

**Success Criteria:**
1. User can view Canvas-based visualizations that exceed D3.js performance
2. User can preview web content and local files through WKWebView
3. User can export notebook content using native share sheet and multiple formats
4. User experiences iOS/macOS-specific features like split view, multiple windows
5. CloudKit synchronization maintains data consistency across devices

Plans:
- [ ] 06.4-01: Native Canvas visualization using SuperGrid patterns
- [ ] 06.4-02: WKWebView integration and native export system
- [ ] 06.4-03: iOS-specific features (multitasking, touch optimization)
- [ ] 06.4-04: macOS-specific features and App Store compliance

## Dependencies

### External Dependencies
- **iOS 16+ / macOS 14+** for latest SwiftUI and performance features
- **Claude Code API** access with native URLSession integration
- **App Store Review** approval for sandbox and API usage
- **CloudKit** account and development team for sync functionality

### Internal Dependencies
- **Existing native codebase** with SuperGrid Canvas, database, and CloudKit sync
- **React prototype completion** providing feature specification and UX patterns
- **Database schema compatibility** maintaining existing node/edge relationships
- **Performance infrastructure** including PerformanceMonitor and optimization systems

### Phase Dependencies
```
Phase 6.1 (Foundation) → Phase 6.2 (Capture) → Phase 6.3 (Shell) → Phase 6.4 (Preview/Platform)
        ↓                       ↓                     ↓                        ↓
   Native layout        Native editing       Sandbox shell           Platform features
```

## Architecture Integration

### SwiftUI Component Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                 NATIVE ISOMETRY NOTEBOOK                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│     CAPTURE     │      SHELL      │           PREVIEW           │
│  NSTextView/    │  NSTask/Process │      Canvas +               │
│  UITextView +   │ + URLSession    │     WKWebView               │
│  Properties     │ (Claude API)    │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
│              SwiftUI @StateObject & @EnvironmentObject           │
│                   AppState + CloudKitSyncManager                │
│                                                                 │
│                  GRDB.swift + CloudKit                         │
│  notebook_cards (new) + nodes/edges/facets (existing)          │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Optimization Strategy
- **Canvas Rendering:** Leverage existing SuperGrid optimization patterns
- **Memory Management:** Platform-specific optimizations for iOS/macOS constraints
- **Battery Efficiency:** iOS background processing and power management integration
- **Synchronization:** CloudKit efficient sync with offline capability

### Security & Sandbox Compliance
- **File Access:** Restrict to app container and user-selected documents
- **Network Access:** Claude Code API only, no arbitrary network requests
- **Process Execution:** Limited to approved development tools within sandbox
- **Data Protection:** CloudKit encryption and local data security

## Risk Assessment & Mitigation

### High Risk Items

**Risk:** App Sandbox restrictions limit shell functionality
- **Impact:** Terminal component cannot provide full development environment
- **Mitigation:** Focus on Claude Code API integration, limit file system access
- **Contingency:** Provide documentation workflow only, defer advanced shell features

**Risk:** App Store review rejection for process execution
- **Impact:** Shell component must be removed or significantly limited
- **Mitigation:** Use only approved APIs, extensive review guideline compliance testing
- **Contingency:** Remove shell component, enhance Claude API integration in capture

**Risk:** Performance degradation compared to React prototype
- **Impact:** User experience worse than web version
- **Mitigation:** Leverage SuperGrid Canvas patterns, extensive performance testing
- **Contingency:** Implement progressive rendering and virtualization

### Medium Risk Items

**Risk:** CloudKit sync conflicts with notebook data
- **Impact:** Data loss or inconsistent state across devices
- **Mitigation:** Extend existing conflict resolution, comprehensive testing
- **Contingency:** Local-only mode with manual export/import

**Risk:** iOS/macOS platform differences require significant code duplication
- **Impact:** Development time doubles, maintenance complexity increases
- **Mitigation:** Shared SwiftUI components with platform-specific adaptations
- **Contingency:** Focus on single platform initially, add second platform later

### Low Risk Items

**Risk:** Native text editing complexity compared to React markdown editor
- **Impact:** Reduced markdown editing capabilities
- **Mitigation:** NSTextView/UITextView provide sufficient functionality
- **Contingency:** Use WKWebView with markdown editor for complex editing

## Timeline Estimation

### Phase 6.1: Foundation & Layout (12-16 hours)
- SwiftUI layout system: 4-5 hours
- Database schema extension: 3-4 hours
- Navigation architecture: 3-4 hours
- Performance infrastructure: 2-3 hours

### Phase 6.2: Capture Implementation (16-20 hours)
- Native markdown editor: 5-6 hours
- Property management: 4-5 hours
- Template system: 4-5 hours
- Slash command integration: 3-4 hours

### Phase 6.3: Shell Integration (20-24 hours)
- App Sandbox terminal: 6-7 hours
- Claude Code API integration: 5-6 hours
- Process execution framework: 5-6 hours
- Command history and context: 4-5 hours

### Phase 6.4: Preview & Platform Integration (16-20 hours)
- Native Canvas visualization: 5-6 hours
- WKWebView and export system: 4-5 hours
- iOS-specific features: 3-4 hours
- macOS features and compliance: 4-5 hours

**Total Estimated Development Time:** 64-80 hours
**With Testing and Iteration:** 80-100 hours
**Calendar Time (part-time):** 4-5 weeks

## Success Metrics

### Performance Targets (vs React Prototype)
- **Rendering Performance:** 60fps maintained (vs 30-45fps web)
- **Memory Usage:** 50% reduction compared to React/browser
- **Launch Time:** Under 3 seconds cold start (vs 5-8 seconds web)
- **Battery Life:** 25% improvement on iOS devices

### Platform Integration Success
- **CloudKit Sync:** Sub-second sync across devices
- **App Store Approval:** Pass review on first submission
- **Platform Features:** iOS multitasking, macOS multiple windows
- **Security Compliance:** Full App Sandbox compliance

### User Experience Metrics
- **Feature Parity:** 100% React prototype functionality
- **Platform Feel:** Native UI patterns and behaviors
- **Performance Perception:** Faster than web version
- **Reliability:** Zero data loss with CloudKit sync

## Technical Architecture Summary

### Component Integration Pattern
1. **Extend SuperGrid Infrastructure:** Use existing Canvas patterns for visualization
2. **Leverage GRDB/CloudKit:** Extend current database and sync architecture
3. **Platform-Specific Optimization:** iOS/macOS specific performance and UX
4. **Security-First Design:** App Sandbox and CloudKit security throughout

### Development Approach
1. **Port React Patterns:** Maintain UX while using native components
2. **Incremental Integration:** Build on existing native infrastructure
3. **Performance Focus:** Exceed web version benchmarks
4. **Platform Enhancement:** Add iOS/macOS-specific value beyond web

---

## Requirements Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAT-FOUND-01 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-02 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-03 | Phase 6.1 | ❌ Planned |
| NAT-FOUND-04 | Phase 6.1 | ❌ Planned |
| NAT-CAP-01 | Phase 6.2 | ❌ Planned |
| NAT-CAP-02 | Phase 6.2 | ❌ Planned |
| NAT-CAP-03 | Phase 6.2 | ❌ Planned |
| NAT-CAP-04 | Phase 6.2 | ❌ Planned |
| NAT-SHELL-01 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-02 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-03 | Phase 6.3 | ❌ Planned |
| NAT-SHELL-04 | Phase 6.3 | ❌ Planned |
| NAT-PREV-01 | Phase 6.4 | ❌ Planned |
| NAT-PREV-02 | Phase 6.4 | ❌ Planned |
| NAT-PREV-03 | Phase 6.4 | ❌ Planned |
| NAT-PREV-04 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-01 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-02 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-03 | Phase 6.4 | ❌ Planned |
| NAT-PLAT-04 | Phase 6.4 | ❌ Planned |

**Coverage:** 20/20 requirements mapped ✓

---

**Phase 6 planned and ready for native implementation.** Next step: `/gsd:plan-phase 6.1` to begin SwiftUI foundation and database integration work.