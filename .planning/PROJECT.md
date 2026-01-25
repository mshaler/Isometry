# Isometry Notebook Sidecar

**Domain:** Hybrid note-taking/development tool with Claude Code integration
**Type:** React application extension to existing Isometry architecture
**Timeline:** Strategic development milestone

## Core Value

Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## Problem Statement

Developers need a unified workspace that combines:
- Rapid note capture with structured card properties
- Terminal access with AI assistance (Claude Code)
- Universal content preview including visualizations
- Seamless data flow into existing knowledge graph systems

Current tools force context switching between separate applications, breaking flow state and fragmenting information.

## Solution Approach

Three-component React sidecar application:

1. **Capture**: Notion-style markdown editor with Isometry card properties, slash commands, and auto-save
2. **Shell**: Embedded terminal with Claude Code API integration and project context awareness
3. **Preview**: WKWebView browser with D3.js visualization support and universal content rendering

**Integration Strategy**: Extend existing Isometry React prototype architecture, sharing SQLite database, context providers, and TypeScript interfaces while maintaining component boundaries.

## Success Criteria

**Core Workflow Success:**
- User captures ideas as Isometry cards with zero friction
- Cards automatically appear in main Isometry application
- Terminal commands execute with full project context
- Visualizations render live during content creation
- Export workflows handle markdown, PDF, and data formats

**Integration Success:**
- Notebook cards participate in existing PAFV projections
- LATCH filters work across notebook and main application data
- GRAPH connections link notebook cards to existing knowledge
- Provider hierarchy remains consistent and performant
- TypeScript interfaces maintain type safety across components

**User Experience Success:**
- Single-window workflow without context switching
- Responsive layout adapts to different screen sizes
- Theme consistency with existing Isometry applications
- Performance maintains 60fps with 1000+ cards
- Data persistence survives application restarts

## Technical Constraints

**Architecture Constraints:**
- Must extend existing React prototype patterns
- Cannot break existing SQLite schema compatibility
- Must maintain provider hierarchy and hook patterns
- TypeScript strict mode compliance required

**Platform Constraints:**
- React 18+ for concurrent features
- Modern browsers (Safari 14+, Chrome 90+)
- macOS/iOS compatibility for WKWebView integration
- Node.js 18+ for development environment

**Integration Constraints:**
- SQLite database shared with main application
- Existing context providers must remain functional
- D3.js visualization engine compatibility required
- Claude Code API integration within usage limits

**Performance Constraints:**
- Component rendering under 16ms (60fps)
- SQLite queries under 100ms for real-time features
- Memory usage under 500MB for typical workloads
- Bundle size under 10MB compressed

## Non-Goals

- Complete IDE replacement (use existing tools)
- Real-time collaboration (single-user focused)
- Custom markdown parser (use proven libraries)
- Full browser engine (platform WKWebView only)
- Complex plugin architecture (fixed three-component design)
- Advanced terminal features (delegate to system terminal)

## Risk Assessment

**High Risk:**
- Claude Code API integration complexity and usage costs
- Terminal embedding security with project file access
- Three-component state synchronization without race conditions

**Medium Risk:**
- WKWebView integration across macOS/iOS platforms
- Performance optimization with large notebook collections
- SQLite schema evolution without breaking changes

**Low Risk:**
- Markdown editor integration (mature libraries available)
- React component architecture (established patterns)
- Theme and styling consistency (existing CSS variables)

## Dependencies

**External:**
- Claude Code API access and usage quotas
- React ecosystem stability (18.2+)
- SQLite compatibility with browser environment

**Internal:**
- Existing Isometry React prototype codebase
- Established provider hierarchy and context patterns
- SQLite schema and TypeScript interface definitions
- D3.js visualization components and themes