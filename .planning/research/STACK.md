# Technology Stack

**Project:** Isometry Notebook Sidecar
**Researched:** January 25, 2026

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | ^18.2.0 | UI Framework | Already established in main app, proven patterns |
| TypeScript | ^5.2.2 | Type Safety | Critical for Claude API integration, existing types |
| Vite | ^7.3.1 | Build Tool | Fast development, already configured |
| Tailwind CSS | ^3.3.5 | Styling | Consistent with main app themes |

### Capture Component
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @uiw/react-md-editor | ^4.0.4 | Markdown Editor | Lightweight (4.6KB gzipped), live preview, modern React patterns |
| @radix-ui/react-* | ^2.0+ | UI Primitives | Already in use, accessible components for properties editor |
| react-dnd | ^16.0.1 | Drag & Drop | Already available, needed for property management |

### Shell Component
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-xtermjs | ^2.0.2 | Terminal Embedding | Most current library (2024), hook-based, full xterm.js integration |
| @anthropic-ai/sdk | ^0.24.0 | Claude API | Official SDK, TypeScript support, robust error handling |
| xterm | ^5.3.0 | Terminal Engine | Full-featured terminal with addons support |

### Preview Component
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WKWebView | Native | Browser Engine | Required for iOS/macOS, seamless integration |
| react-leaflet | ^4.2.1 | Map Visualization | Already available, D3 integration support |
| D3.js | ^7.8.5 | Data Visualization | Core Isometry visualization engine |

### Database & State
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sql.js | ^1.9.0 | SQLite in Browser | Already integrated, proven data layer |
| SQLite Schema | Extended | Shared Data | Leverage existing node/edge tables, add notebook_cards |
| React Context | Built-in | State Management | Follow established provider hierarchy pattern |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Markdown Editor | @uiw/react-md-editor | MDXEditor | Too complex for initial needs, MDX not required |
| Terminal | react-xtermjs | xterm-for-react | Less maintained, no hooks support |
| Browser Engine | WKWebView (native) | Chromium embed | iOS restrictions, bundle size concerns |
| Claude API | @anthropic-ai/sdk | Direct REST | Missing TypeScript types, error handling |

## Installation

```bash
# New dependencies for Notebook
npm install @uiw/react-md-editor react-xtermjs @anthropic-ai/sdk

# Terminal addons
npm install @xterm/addon-fit @xterm/addon-attach

# Development dependencies
npm install -D @types/xterm
```

## Integration Notes

### Shared Dependencies
Leverage existing Isometry dependencies where possible:
- `d3` for data visualization in Preview
- `sql.js` for shared database
- `@radix-ui/react-*` for UI consistency
- `react-router-dom` for navigation

### Version Compatibility
All recommended versions tested compatible with:
- React 18.2.0 (existing)
- TypeScript 5.2.2 (existing)
- Node.js 18+ (development)
- Modern browsers (Safari 14+, Chrome 90+)

## Sources

- [@uiw/react-md-editor documentation](https://uiwjs.github.io/react-md-editor/) - HIGH confidence
- [react-xtermjs by Qovery](https://github.com/Qovery/react-xtermjs) - HIGH confidence
- [Anthropic Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/typescript) - HIGH confidence
- [WKWebView Apple Documentation](https://developer.apple.com/documentation/webkit/wkwebview) - HIGH confidence