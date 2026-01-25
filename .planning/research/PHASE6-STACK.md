# Technology Stack: Phase 6 Native Integration

**Project:** Phase 6 - Native iOS/macOS Integration
**Researched:** 2026-01-25

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SwiftUI | iOS 17+/macOS 14+ | Native UI framework | Already proven in SuperGrid implementation with Canvas performance |
| Swift | 5.9+ | Primary language | Existing codebase standard, Actor-based concurrency for database operations |
| Xcode | 15+ | IDE and toolchain | Traditional projects ready for App Store deployment |

### Database & Sync
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GRDB.swift | 6.29.3 | SQLite wrapper | Already integrated, proven performance with 6,891+ notes |
| CloudKit | iOS 17+/macOS 14+ | Native sync | Production-ready implementation with conflict resolution |
| SQLite | 3.40+ | Local storage | Existing schema supports notebook extensions |

### Native Frameworks
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Canvas | SwiftUI | High-performance rendering | SuperGrid proves 60fps at 1000+ cells, replaces D3.js |
| NSAttributedString | Foundation | Rich text editing | Native markdown support, better than React editor |
| NSTask/Process | Foundation | Shell command execution | Secure process management, replaces node-pty |
| WKWebView | WebKit | Web content preview | Native browser engine, no iframe limitations |

### API Integration
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| URLSession | Foundation | HTTP client | Native networking, replaces axios/fetch |
| Anthropic SDK | TBD | Claude API client | May need Swift wrapper around existing SDK |
| Foundation | System | JSON handling | Native JSON processing, replaces JS JSON handling |

## React → Swift Migration Map

### Current React Stack → Native Equivalent
| React Technology | Swift Replacement | Migration Strategy |
|------------------|-------------------|-------------------|
| @uiw/react-md-editor | NSTextView + NSAttributedString | Port UI patterns, use native text rendering |
| @xterm/xterm | NSTextView + NSTask | Terminal UI with native process management |
| D3.js visualization | SwiftUI Canvas | Port D3 patterns to Canvas draw commands |
| React Context | @StateObject/@ObservableObject | Port provider patterns to Swift observation |
| sql.js | GRDB.swift | Already migrated, extend schema for notebook |
| Anthropic SDK | URLSession + Swift structs | Create native API client with same interface |

## Installation & Setup

```bash
# Core - Already configured in existing Xcode projects
# iOS: IsometryiOS.xcodeproj
# macOS: IsometrymacOS.xcodeproj

# Dependencies already integrated:
# - GRDB.swift 6.29.3 via Swift Package Manager
# - CloudKit capabilities configured
# - Swift 5.9+ compatibility verified

# Additional dependencies for notebook features:
# 1. Markdown parsing: Use AttributedString.markdown (iOS 15+)
# 2. Process execution: Foundation.Process (native)
# 3. Network requests: Foundation.URLSession (native)
```

## Architecture Mapping

### React Component → SwiftUI View
```swift
// React: NotebookLayout.tsx
struct NotebookLayout: View // Port layout patterns

// React: CaptureComponent.tsx
struct CaptureView: View // Port markdown editor UI

// React: ShellComponent.tsx
struct ShellView: View // Port terminal UI patterns

// React: PreviewComponent.tsx
struct PreviewView: View // Port preview UI patterns
```

### React Context → Swift ObservableObject
```swift
// React: NotebookContext.tsx
@MainActor class NotebookManager: ObservableObject

// React: useMarkdownEditor hook
@StateObject private var markdownEditor: MarkdownEditor

// React: useTerminal hook
@StateObject private var terminal: TerminalManager

// React: useWebPreview hook
@StateObject private var webPreview: WebPreviewManager
```

## Platform-Specific Extensions

### iOS Optimizations
- Memory pressure handling (existing in SuperGrid)
- Background app lifecycle management
- Touch gesture optimization
- Keyboard/toolbar integration

### macOS Optimizations
- Multi-window support (existing patterns)
- Trackpad gesture optimization
- Menu bar integration
- High-DPI display optimization

## Performance Targets

| Metric | Target | Current SuperGrid | Strategy |
|--------|--------|------------------|----------|
| Rendering | 60fps | ✓ Proven | Extend Canvas patterns |
| Memory | <500MB | ✓ Achieved | Leverage existing virtualization |
| SQLite Queries | <100ms | ✓ Achieved | Use existing database layer |
| Bundle Size | Native only | N/A | No web dependencies |

## Sources

- SuperGridView.swift - Proven Canvas patterns
- SuperGridViewModel.swift - Performance optimizations
- IsometryDatabase.swift - SQLite integration patterns
- CloudKitSyncManager.swift - Sync and conflict resolution
- Native Xcode project configurations - Build and deployment