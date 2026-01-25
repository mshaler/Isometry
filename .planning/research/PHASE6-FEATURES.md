# Feature Landscape: Phase 6 Native Integration

**Domain:** Native iOS/macOS implementation of React notebook features
**Researched:** 2026-01-25

## Current React Implementation Analysis

Based on examination of completed React notebook components (Phases 1-3), the following feature landscape exists:

### Capture Component (Complete)
- ✅ **Markdown Editor**: @uiw/react-md-editor with live preview and auto-save
- ✅ **Property Panel**: Collapsible editor with multiple field types
- ✅ **Slash Commands**: Notion-style command system for Isometry DSL patterns
- ✅ **Template System**: Card creation workflow with reusable templates
- ✅ **Auto-save**: 2-second debounced saves to SQLite
- ✅ **Keyboard Shortcuts**: Ctrl+S manual save, navigation

### Shell Component (Complete)
- ✅ **Terminal Emulator**: @xterm/xterm integration with proper sizing
- ✅ **Claude API Integration**: @anthropic-ai/sdk with command routing
- ✅ **Command Router**: Distinguishes system vs AI commands
- ✅ **Project Context**: Awareness of current notebook card content
- ✅ **Command History**: Persistent history with navigation
- ✅ **Status Indicators**: Connection status for terminal and Claude

### Preview Component (Complete)
- ✅ **D3 Visualization**: Live rendering of data visualizations
- ✅ **Web Preview**: iframe with URL navigation and controls
- ✅ **Export Functions**: PDF, HTML, JSON export with options
- ✅ **Universal Preview**: Images, PDFs, markdown rendering
- ✅ **Zoom Controls**: For image and PDF content
- ✅ **Live Updates**: Real-time sync with capture content changes

## Native Migration Feature Map

### Table Stakes (Must Have)
Features users expect from native apps. Missing these makes the app feel incomplete compared to React version.

| Feature | React Implementation | Native Strategy | Complexity | Notes |
|---------|---------------------|-----------------|------------|-------|
| Rich Text Editing | @uiw/react-md-editor | NSTextView + AttributedString | Medium | Use native markdown parsing |
| Auto-save | JavaScript debouncing | Combine publishers | Low | Leverage existing database layer |
| Property Panel | React form components | SwiftUI Form views | Low | Standard native form patterns |
| Terminal Display | @xterm/xterm canvas | NSTextView + monospace | Medium | Replicate terminal appearance |
| Web Preview | iframe element | WKWebView | Low | Native web engine integration |
| Export Functions | Browser download API | NSSharingService/UIActivityVC | Medium | Platform-specific sharing |
| Keyboard Shortcuts | React event handlers | SwiftUI .keyboardShortcut | Low | Native shortcut system |

### Differentiators (Nice to Have)
Features that set native app apart. Not expected but valued by users.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-window Support | macOS-native workflow | Medium | Leverage existing macOS patterns |
| Spotlight Integration | System-wide search | High | Index notebook content for Spotlight |
| Menu Bar Integration | Native macOS experience | Medium | Standard AppKit patterns |
| Handoff Continuity | Cross-device workflow | High | CloudKit + NSUserActivity |
| Widgets | Quick capture/preview | High | WidgetKit integration |
| Siri Integration | Voice note capture | High | SiriKit integration |
| Touch Bar Support | Markdown shortcuts | Low | If hardware still relevant |

### Anti-Features (Explicitly Avoid)
Features to NOT build that would complicate native implementation without user value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Web-based Terminal | Security sandbox limitations | Native NSTask with constrained execution |
| Complex D3.js Port | Massive implementation effort | Focus on essential visualizations only |
| Browser Engine Extensions | Unnecessary complexity | Use standard WKWebView capabilities |
| Cross-platform UI | Dilutes native experience | Platform-specific optimizations |
| Plugin Architecture | Security and complexity | Fixed three-component design |
| Real-time Collaboration | Not in scope, adds complexity | Focus on CloudKit sync |

## Feature Dependencies

```
Database Layer
├── Notebook Schema Extension
├── CloudKit Sync Integration
└── Search/FTS5 Support
    ├── Capture Component
    │   ├── Markdown Editor
    │   ├── Property Panel
    │   └── Auto-save
    ├── Shell Component
    │   ├── Terminal UI
    │   ├── Process Management
    │   └── Claude API Client
    └── Preview Component
        ├── Canvas Visualization
        ├── WKWebView Integration
        └── Export/Sharing
```

## MVP Recommendation

For native MVP, prioritize core workflow over advanced features:

### Phase 1: Foundation
1. **Three-component layout** - Basic SwiftUI structure
2. **Database integration** - Extend existing schema for notebook cards
3. **Navigation** - Seamless integration with main SuperGrid app

### Phase 2: Capture
1. **Native text editor** - NSTextView with markdown preview
2. **Property editing** - SwiftUI forms matching React functionality
3. **Auto-save** - Combine-based debouncing to existing database

### Phase 3: Shell
1. **Terminal UI** - Text view with command input/output
2. **Process execution** - NSTask for system commands
3. **Claude API** - URLSession-based client matching React patterns

### Phase 4: Preview & Polish
1. **WKWebView integration** - Universal content preview
2. **Basic visualizations** - Canvas rendering of essential charts
3. **Export functionality** - Native sharing/export APIs

Defer to post-MVP:
- **Complex D3.js visualizations**: Focus on essential charts only
- **Advanced terminal features**: Basic command execution sufficient
- **Multi-window workflows**: Single window first, extend later
- **System integrations**: Spotlight, Siri, widgets are nice-to-have

## Performance Considerations

| Feature | React Performance | Native Target | Strategy |
|---------|------------------|---------------|----------|
| Text Editing | Good (web editor) | Excellent | Leverage native text frameworks |
| Terminal Rendering | 30-60fps (canvas) | 60fps | Native text view with proper chunking |
| Visualization | Variable (D3.js) | 60fps | Swift Canvas matching SuperGrid patterns |
| Auto-save | Fast (local JS) | Faster | GRDB with existing Actor patterns |
| Export | Browser dependent | Native speed | Platform-specific APIs |

## Sources

- React component analysis from `/src/components/notebook/`
- Native SuperGrid performance patterns from SuperGridView.swift
- iOS/macOS Human Interface Guidelines for native behavior expectations
- Existing Isometry database layer capabilities from native implementation