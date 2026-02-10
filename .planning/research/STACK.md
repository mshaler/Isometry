# Technology Stack

**Project:** Isometry v4 — Three-Canvas Notebook Addition
**Researched:** 2026-02-10 (Updated from 2026-02-05 SuperGrid Foundation)

---

## CONTEXT: This is a Stack Addition, Not Replacement

**Base stack validated:** React 18, sql.js (WASM), D3.js v7, TanStack Virtual, IndexedDB (idb), Tailwind CSS, shadcn/ui

**SuperGrid Foundation stack (Phase 1):** @dnd-kit, d3-selection-multi, d3-annotation, react-window, immer, usehooks-ts

**This research:** NEW packages for Three-Canvas Notebook (Capture + Shell + Preview panes)

---

## Recommended Stack — THREE-CANVAS ADDITIONS

### Core Technologies (NEW for Three-Canvas)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@tiptap/react** | ^3.19.0 | Notion-style block editor for Capture pane | Headless architecture, ProseMirror-based, excellent TypeScript support, officially maintained. Recent v3 release (Feb 2026) improves Markdown support for AI use cases. Industry standard (used by GitBook, Linear, etc.). |
| **@tiptap/pm** | ^3.19.0 | ProseMirror dependencies for TipTap | Required peer dependency for TipTap editor to function. Provides schema, state, and transform primitives. |
| **@tiptap/starter-kit** | ^3.18.0 | Common editor extensions (headings, bold, lists, etc.) | Provides document structure nodes (Doc, Paragraph, Text) and basic formatting. Saves time over importing extensions individually. Configurable (can disable unwanted extensions). |
| **@anthropic-ai/sdk** | ^0.74.0 | Claude API integration for AI-assisted terminal | Official TypeScript SDK with MCP helpers (`@anthropic-ai/sdk/helpers/beta/mcp`). Includes streaming, tool use, function calling, and comprehensive error handling. v0.74.0 released Feb 7, 2026. |
| **@xterm/xterm** | ^6.0.0 | Terminal emulator for Shell pane | Industry standard (used in VS Code, Hyper, Theia). GPU-accelerated renderer, TypeScript-native, zero dependencies. v6 released Dec 2025 with synchronized output support. **UPGRADE from current v5.5.0**. |

### Supporting Libraries (NEW for Three-Canvas)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@harshtalks/slash-tiptap** | latest | Slash commands for Capture pane | Lightweight, headless UI extension using cmdk package. Avoids version conflicts by treating TipTap as peer dependency. Use for Notion-style `/` command palette in editor. |
| **@xterm/addon-webgl** | ^0.19.0 | WebGL2 renderer for terminal | When better performance is needed over default DOM renderer. Fallback: `@xterm/addon-canvas` if WebGL2 unsupported. Improves rendering for high-throughput terminal output. |
| **@xterm/addon-fit** | **KEEP ^0.10.0** | Auto-resize terminal to container | Essential for responsive terminal layout. **Already installed** — no action needed. |
| **@xterm/addon-web-links** | **KEEP ^0.11.0** | Clickable URLs in terminal output | Improves UX for terminal output with links. **Already installed** — no action needed. |
| **@tiptap/extension-markdown** | ^3.19.0 | Bidirectional Markdown support | Parse Markdown → TipTap JSON, serialize TipTap → Markdown. Needed for `.md` file import/export. Note: early release (v3), may have edge cases. Test thoroughly. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **@tiptap/react** types | TypeScript definitions for editor API | Included with package. Define custom extension types using `Extension.create<YourOptionsInterface>()`. |
| **@types/node** | Node.js types for terminal integration | **Already installed** (^22.11.7). Needed for `node-pty` server-side if adding shell execution later. |

---

## Installation Commands

```bash
# Core (NEW packages only — React, D3, sql.js already installed)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install @anthropic-ai/sdk

# UPGRADE existing xterm.js from v5 → v6
npm install @xterm/xterm@^6.0.0

# TipTap extensions
npm install @tiptap/extension-markdown
npm install @harshtalks/slash-tiptap

# xterm addons (NEW only — fit and web-links already installed)
npm install @xterm/addon-webgl
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **@tiptap/react** | ProseMirror directly | If you need absolute control over schema and plugins. TipTap is a ProseMirror wrapper — adds convenience at cost of abstraction. Not recommended for this project (TipTap's convenience > control). |
| **@tiptap/react** | Slate.js | If you're already using Slate elsewhere. Slate has smaller ecosystem but more React-native feel. TipTap's ProseMirror foundation is more mature and better documented. |
| **@tiptap/react** | Lexical (Meta) | If you need React-first architecture. Lexical is newer (2022), growing ecosystem. TipTap is more mature with larger plugin ecosystem. |
| **@harshtalks/slash-tiptap** | `@tiptap/suggestion` (DIY) | If you need highly custom slash command UI. Build directly on TipTap's suggestion plugin. More code, full control. @harshtalks saves time with sensible defaults. |
| **@xterm/xterm** | terminal-kit | If you need terminal emulation in Node.js (server-side). xterm.js is browser-only. Not applicable for browser-based app. |
| **@anthropic-ai/sdk** | Direct API calls (fetch) | If you want minimal dependencies. SDK handles retries, streaming, error handling, and MCP integration. DIY = reinventing wheel. SDK provides value. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **xterm-for-react** (1.0.4) | Unmaintained (5 years old). Uses deprecated `xterm` package. | Use `@xterm/xterm` (v6) directly with React `useRef` and `useEffect`. See integration pattern below. |
| **react-xtermjs** | Old package name. Ecosystem moved to `@xterm/*` scoped packages. | `@xterm/xterm` |
| **Draft.js** | Deprecated by Facebook. No longer maintained. Last update 2021. | `@tiptap/react` or Slate.js |
| **@tiptap/collaboration** (Pro) | Requires paid TipTap Cloud subscription. Not needed for single-user local-first app. | Skip real-time collaboration. Use sql.js for persistence. Save on keystrokes. |
| **Yjs** | Adds complexity for CRDT conflict resolution. Not needed without real-time collab. 20KB+ bundle for unused features. | Use sql.js directly. Single-user app doesn't need CRDT. |
| **@uiw/react-md-editor** | **Already installed** (^4.0.11) but NOT for Capture pane. Limited extensibility, no slash commands, no custom nodes. | Use for quick Markdown preview only. Use TipTap for rich editing. |

---

## Stack Patterns by Variant

### If building Capture pane (Notion-style editor):
- Use `@tiptap/react` with `@tiptap/starter-kit`
- Add `@harshtalks/slash-tiptap` for slash commands
- Add `@tiptap/extension-markdown` for `.md` import/export
- Store content as Markdown in `notebook_cards.markdown_content` (sql.js)
- Render D3 visualizations in custom TipTap nodes using `ReactNodeViewRenderer`

**Integration with existing:**
```typescript
// TipTap + sql.js
const markdown = editor.storage.markdown.getMarkdown();
db.run(
  "INSERT INTO notebook_cards (node_id, card_type, markdown_content) VALUES (?, ?, ?)",
  [nodeId, 'capture', markdown]
);

// Load Markdown from sql.js into TipTap
const results = db.exec("SELECT markdown_content FROM notebook_cards WHERE node_id = ?", [nodeId]);
editor.commands.setContent(results[0].values[0][0]);
```

### If building Shell pane (Claude Code + Terminal):
- Use `@xterm/xterm` with `@xterm/addon-fit` and `@xterm/addon-webgl`
- Use `@anthropic-ai/sdk` with streaming for Claude responses
- Integrate MCP using `@anthropic-ai/sdk/helpers/beta/mcp`
- Store shell history in sql.js `notebook_cards` table with `card_type='shell'`

**Integration with existing:**
```typescript
// xterm.js + React (No Wrapper Needed)
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

const terminalRef = useRef<HTMLDivElement>(null);
const terminal = useRef<Terminal>();

useEffect(() => {
  if (!terminalRef.current) return;

  terminal.current = new Terminal();
  const fitAddon = new FitAddon();
  const webglAddon = new WebglAddon();

  terminal.current.loadAddon(fitAddon);
  terminal.current.loadAddon(webglAddon);
  terminal.current.open(terminalRef.current);
  fitAddon.fit();

  return () => terminal.current?.dispose();
}, []);

// Claude SDK + MCP
import Anthropic from '@anthropic-ai/sdk';
import { mcpTools, mcpMessages } from '@anthropic-ai/sdk/helpers/beta/mcp';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const stream = client.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: mcpMessages(conversation),
  tools: mcpTools(mcpServer.listTools()),
});

stream.on('text', (text) => terminal.current?.write(text));
```

### If integrating D3.js in Preview pane:
- **NO NEW DEPENDENCIES** (D3.js v7 already installed)
- Use existing ViewEngine architecture
- Query sql.js directly from D3 renderers (bridge elimination already complete)

**Integration with TipTap (custom D3 nodes):**
```typescript
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import * as d3 from 'd3';

const D3VisualizationNode = Node.create({
  name: 'd3Visualization',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      queryId: { default: null },
      viewType: { default: 'grid' }
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      const svgRef = useRef<SVGSVGElement>(null);

      useEffect(() => {
        if (!svgRef.current) return;
        const data = db.exec(node.attrs.queryId); // sql.js query
        d3.select(svgRef.current).selectAll('.node')
          .data(data, d => d.id)
          .join('circle');
      }, [node.attrs.queryId]);

      return <NodeViewWrapper><svg ref={svgRef} /></NodeViewWrapper>;
    });
  },
});
```

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| **@tiptap/react@^3.19.0** | React 18+ | Requires React 18 for hooks like `useId` and `useSyncExternalStore`. **Already installed** (^18.2.0) ✓ |
| **@tiptap/pm@^3.19.0** | @tiptap/react@^3.19.0 | Must match TipTap core version. Install both together. |
| **@xterm/xterm@^6.0.0** | @xterm/addon-*@^0.19.0 | Addon versions must be compatible with core. v6 core → v0.19 addons. Existing addons (fit@0.10.0, web-links@0.11.0) compatible ✓ |
| **@anthropic-ai/sdk@^0.74.0** | TypeScript ^4.9+ | **Already installed** (^5.2.2) ✓ |
| **cmdk** (via shadcn/ui) | React 18+ | **Already compatible** via existing shadcn/ui setup. Used by @harshtalks/slash-tiptap. |

---

## Migration Notes

### Upgrade @xterm/xterm from v5 to v6
**Current:** `@xterm/xterm: ^5.5.0`
**Target:** `@xterm/xterm: ^6.0.0`

**Breaking changes (v5 → v6):**
- Synchronized output API added (new feature, non-breaking)
- Rendering improvements (internal, no API changes)
- Addon versions must match: upgrade `@xterm/addon-fit` to ^0.10.0 (already compatible ✓), `@xterm/addon-web-links` to ^0.11.0 (already compatible ✓)

**Migration:** Safe upgrade. Run `npm install @xterm/xterm@^6.0.0` and test terminal rendering. No code changes required.

---

## Sources

**HIGH Confidence:**
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) — Official docs, updated Feb 6, 2026
- [TipTap Slash Commands](https://tiptap.dev/docs/examples/experiments/slash-commands) — Official experimental extension, updated Feb 10, 2026
- [TipTap React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) — Official docs for D3 integration pattern
- [TipTap StarterKit Extensions](https://tiptap.dev/docs/editor/extensions/functionality/starterkit) — Official docs, v3.18.0 current
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) — Official repo, v0.74.0 released Feb 7, 2026
- [Anthropic SDK MCP Helpers](https://github.com/anthropics/anthropic-sdk-typescript#mcp-helpers) — Official MCP integration docs
- [@xterm/xterm npm](https://www.npmjs.com/@xterm/xterm) — Official package, v6.0.0 released Dec 22, 2025
- [@xterm/addon-webgl](https://www.npmjs.com/package/@xterm/addon-webgl) — Official WebGL addon, v0.19.0 released Jan 2026
- [xterm.js GitHub Releases](https://github.com/xtermjs/xterm.js/releases) — v6.0.0 release notes

**MEDIUM Confidence:**
- [@harshtalks/slash-tiptap](https://www.npmjs.com/package/@harshtalks/slash-tiptap) — Community package, actively maintained, uses cmdk
- [TipTap Markdown Extension](https://tiptap.dev/docs/editor/markdown) — Official but marked "early release," may have edge cases
- [cmdk (via shadcn/ui)](https://ui.shadcn.com/docs/components/radix/command) — shadcn/ui wrapper around pacocoursey/cmdk

**LOW Confidence (flagged for validation):**
- xterm.js React wrapper recommendations — ecosystem fragmented, official recommendation is "use xterm.js directly with React hooks" (no official wrapper exists)
- @harshtalks/slash-tiptap production-readiness — community package, verify in testing phase before committing to architecture

---

## Preserved: SuperGrid Foundation Stack (Phase 1)

_For reference — these were researched 2026-02-05 for SuperGrid implementation:_

### Core Framework Extensions (SuperGrid)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @dnd-kit/core | ^6.3.1 | Axis reordering drag-drop | Replace deprecated react-dnd (v16.0.1). Modern hooks-based, zero-dep, 10kb. Better performance + accessibility than existing useDragDrop |
| @dnd-kit/sortable | ^8.0.0 | PAFV chip reordering | Sortable lists for axis picker wells |
| @dnd-kit/utilities | ^3.2.2 | Animation utilities | Smooth transitions for dynamic axis assignment |

### D3.js Enhancements (SuperGrid)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| d3 | ^7.8.5 | KEEP CURRENT | Already optimal - v7.9.0 is latest but stable on 7.8.5 |
| d3-selection-multi | ^3.0.0 | Bulk attribute setting | Optimize nested header rendering with `.attrs()` method |
| d3-annotation | ^2.5.1 | SuperCalc formula overlay | Annotation lines for multidimensional formula scope |

### Grid Rendering Architecture (SuperGrid)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-window | ^1.8.10 | KEEP CURRENT | Virtual scrolling for SuperGrid performance at scale |
| react-virtualized-auto-sizer | ^1.0.24 | Dynamic sizing | Auto-resize grid based on container dimensions |
| use-resize-observer | ^9.1.0 | Responsive updates | Replace custom useResizeObserver with battle-tested solution |

### State Management Extensions (SuperGrid)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | ^10.1.1 | Immutable PAFV updates | Complex axis assignment operations without mutation |
| usehooks-ts | ^3.1.0 | Utility hooks | useLocalStorage for PAFV axis persistence |

---

*Stack research for: Three-Canvas Notebook (Capture + Shell + Preview)*
*Researched: 2026-02-10 (Updated from 2026-02-05 SuperGrid Foundation)*
*Focus: NEW capabilities for Notebook — excludes React 18, D3.js v7, sql.js, shadcn/ui (already validated)*
