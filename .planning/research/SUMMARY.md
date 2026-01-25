# Research Summary: Isometry Notebook Sidecar

**Domain:** Hybrid note-taking/development tool with Claude Code integration
**Researched:** January 25, 2026
**Overall confidence:** HIGH

## Executive Summary

The Isometry Notebook sidecar represents a strategic expansion that leverages the existing Isometry architecture to create a powerful capture-shell-preview workflow. Research reveals three key findings: (1) the existing Isometry React prototype provides a strong foundation with established patterns for SQLite integration, context-driven state management, and D3 visualization; (2) current React ecosystem tools offer mature solutions for markdown editing, terminal embedding, and browser integration; and (3) the hybrid architecture can elegantly bridge note capture with the main Isometry visualization system.

The proposed three-component architecture (Capture, Shell, Preview) aligns well with Isometry's PAFV+LATCH+GRAPH principles while introducing new capabilities for Claude Code integration and development workflow support. The existing React prototype's provider hierarchy, hook patterns, and type-safe approach provide proven patterns to extend.

The most critical architectural decision is data flow integration: Notebook cards should seamlessly flow into the main Isometry SQLite schema while maintaining the flexibility for rapid capture and iteration. This positions the Notebook as both a frontend for Isometry data and a development companion tool.

## Key Findings

**Stack:** React + TypeScript with @uiw/react-md-editor, react-xtermjs, WKWebView integration
**Architecture:** Three-component layout with shared SQLite backend and context-driven state management
**Critical pitfall:** Avoiding feature creep by maintaining clear component boundaries and integration patterns

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation Phase** - Establish component shells and data flow integration
   - Addresses: Basic Capture editor, SQLite schema extension, React component structure
   - Avoids: Premature optimization of Shell/Preview components

2. **Capture Enhancement** - Build rich markdown editor with Isometry card integration
   - Addresses: Notion-style slash commands, property editing, card templates
   - Avoids: Complex visualization features (defer to main app)

3. **Shell Integration** - Embed terminal and Claude Code API connection
   - Addresses: Terminal component, Claude Code API patterns, command routing
   - Avoids: Complex AI orchestration (start with basic API integration)

4. **Preview & Polish** - Complete browser integration and workflow optimization
   - Addresses: WKWebView/browser component, visualization preview, export workflows
   - Avoids: Advanced browser engine features (use standard web view APIs)

**Phase ordering rationale:**
- Foundation first establishes data flow patterns that other components depend on
- Capture second provides immediate user value and core workflow
- Shell third adds development capabilities once capture workflow is solid
- Preview last completes the ecosystem without blocking core functionality

**Research flags for phases:**
- Phase 2: May need deeper research into Notion-style slash command patterns
- Phase 3: Standard patterns exist, unlikely to need additional research
- Phase 4: Standard web view integration, minimal risk

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Established React patterns, mature ecosystem libraries |
| Features | HIGH | Clear component boundaries, existing Isometry patterns |
| Architecture | HIGH | Provider hierarchy and context patterns proven in main app |
| Pitfalls | MEDIUM | New territory for terminal/browser integration, but well-researched |

## Gaps to Address

- Specific Claude Code API integration patterns for conversation management
- Terminal embedding security considerations for Isometry development context
- Performance optimization strategies for three-component layout with SQLite
- Integration testing approaches for Notebook → main app data flow