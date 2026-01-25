# Feature Landscape

**Domain:** Hybrid note-taking/development tool with Claude Code integration
**Researched:** January 25, 2026

## Table Stakes

Features users expect from a modern note-taking and development tool. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Markdown editing with live preview | Industry standard for developer tools | Low | @uiw/react-md-editor provides out-of-box |
| Basic text formatting | Users expect rich text capabilities | Low | Toolbar included in markdown editor |
| Auto-save | Prevents data loss, expected in web apps | Medium | IndexedDB integration with Isometry patterns |
| Syntax highlighting | Code blocks essential for dev workflow | Low | Built into markdown editor |
| Card properties editing | Core Isometry concept integration | Medium | Leverage existing CardData interface |
| Terminal access | Expected in development environments | High | Terminal embedding with security considerations |
| File export | Users need data portability | Low | Markdown export, PDF generation |

## Differentiators

Features that set Isometry Notebook apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Slash commands for Isometry DSL | Seamless integration with main app data | Medium | Custom parser for DSL syntax |
| Claude Code conversation turns | AI-assisted development workflow | High | API integration, conversation state management |
| Live visualization preview | See data visualizations while editing | High | D3.js integration, real-time rendering |
| Seamless data flow to main app | Notes become part of larger knowledge graph | Medium | SQLite schema extension, shared contexts |
| Three-pane layout optimization | Capture-Shell-Preview workflow efficiency | Medium | Layout management, responsive design |
| Context-aware shell commands | Terminal knows about current notebook state | High | Command routing, state synchronization |
| WKWebView browser integration | Native-quality web preview | Medium | Platform-specific implementation |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Complete IDE replacement | Scope creep, complexity explosion | Focus on capture workflow, integrate with existing IDEs |
| Custom markdown parser | Reinventing wheels, maintenance burden | Use proven libraries like @uiw/react-md-editor |
| Full browser engine | Bundle size, security, platform restrictions | Use WKWebView/system browser components |
| Complex plugin system | Over-engineering, maintenance overhead | Start with fixed three-component architecture |
| Real-time collaboration | Complex conflict resolution, scaling issues | Single-user focused, export for sharing |
| Advanced terminal features | Terminal apps already exist and excel | Basic embedding, delegate to system terminal for advanced use |
| Complete note organization | Isometry main app handles this better | Focus on capture, let main app handle organization |

## Feature Dependencies

```
Capture Component:
├── Markdown Editor (base) → Properties Editor → Slash Commands
├── Card Templates → Isometry Schema Integration
└── Auto-save → SQLite Extension

Shell Component:
├── Terminal Embedding → Claude API Integration
├── Command Routing → Context Awareness
└── Security Sandboxing

Preview Component:
├── Browser Embedding → D3 Integration
├── Visualization Rendering → Data Binding
└── Export Capabilities

Cross-Component:
├── Shared State Management → Context Providers
├── Data Flow Integration → SQLite Schema
└── Theme Consistency → Tailwind CSS Variables
```

## MVP Recommendation

For MVP, prioritize core workflow over advanced features:

1. **Capture**: Basic markdown editor with properties
2. **Shell**: Simple terminal embedding
3. **Preview**: Basic browser component
4. **Integration**: Data flows to main Isometry app

Defer to post-MVP:
- **Slash Commands**: Complex but valuable, needs solid foundation first
- **Claude Code API**: Start with basic integration, enhance conversation management later
- **Advanced Visualizations**: Let main app handle complex D3 visualizations initially
- **Context-aware Commands**: Requires mature shell integration first

## Component-Specific Features

### Capture Component (Notion + Obsidian + Apple Notes hybrid)

**Core Features:**
- Markdown editor with live preview
- Title and subtitle editing
- Collapsible properties panel
- Basic card templates

**Notion-inspired:**
- Slash command system for DSL integration
- Property types (text, date, tags, etc.)
- Rich data embedding

**Obsidian-inspired:**
- Raw markdown view toggle
- Link syntax support
- File-based thinking

**Apple Notes-inspired:**
- Intuitive key bindings
- Quick capture workflow
- Natural editing experience

### Shell Component (Terminal + Claude Code)

**Core Features:**
- Terminal embedding with xterm.js
- Basic command execution
- Claude Code API integration

**GSD Developer mode:**
- Project context awareness
- Command suggestions
- Development workflow optimization

**Isometry CoPilot mode:**
- Adaptive skill suggestions based on current notebook
- DSL syntax assistance
- Data query helpers

### Preview Component (Browser + Visualizations)

**Core Features:**
- Web content rendering
- File preview support
- Basic export capabilities

**Visualization Support:**
- D3.js chart rendering
- Mermaid diagram support
- Live data visualization

**Format Support:**
- Markdown rendering
- PDF preview
- Image display
- Web page embedding

## Sources

- [Notion API documentation](https://developers.notion.com/) - Feature reference
- [Obsidian plugin development](https://docs.obsidian.md/) - Markdown editor patterns
- [VS Code extension API](https://code.visualstudio.com/api) - Developer tool integration patterns
- [Apple Notes behavior analysis](https://support.apple.com/notes) - UX patterns