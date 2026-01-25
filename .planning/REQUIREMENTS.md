# Isometry Notebook Sidecar Requirements

**Project:** Isometry Notebook Sidecar
**Version:** v1.0
**Date:** 2026-01-25

## Requirement Categories

### Foundation Requirements (FOUND)

**FOUND-01: Project Structure Setup**
Create React application structure that extends existing Isometry patterns while maintaining component isolation for notebook-specific functionality.
- **Acceptance:** New notebook routes accessible from main app
- **Acceptance:** Separate component directory with Capture, Shell, Preview
- **Acceptance:** Package.json updated with notebook-specific dependencies
- **Acceptance:** Development server runs notebook and main app simultaneously

**FOUND-02: Database Schema Extension**
Extend existing SQLite schema to support notebook cards without breaking main application compatibility.
- **Acceptance:** notebook_cards table created with foreign keys to nodes
- **Acceptance:** Existing queries continue to work unchanged
- **Acceptance:** Notebook cards appear in standard node queries
- **Acceptance:** Migration scripts handle schema evolution safely

**FOUND-03: Context Provider Integration**
Integrate NotebookContext into existing provider hierarchy while maintaining performance and type safety.
- **Acceptance:** NotebookProvider wraps three components
- **Acceptance:** useNotebook hook provides consistent API
- **Acceptance:** Existing contexts (Filter, PAFV, Theme) remain functional
- **Acceptance:** TypeScript interfaces provide full type coverage

**FOUND-04: Layout and Navigation**
Establish three-pane layout with responsive behavior and consistent navigation patterns.
- **Acceptance:** Three components render in responsive grid layout
- **Acceptance:** Component size ratios adjust for different screen sizes
- **Acceptance:** Navigation between main app and notebook preserves state
- **Acceptance:** Layout state persists across browser sessions

### Capture Component Requirements (CAP)

**CAP-01: Markdown Editor Integration**
Implement rich markdown editing with live preview using @uiw/react-md-editor.
- **Acceptance:** Full markdown syntax support with live preview
- **Acceptance:** Toolbar with formatting shortcuts and media embedding
- **Acceptance:** Code syntax highlighting for developer workflow
- **Acceptance:** Auto-save writes to SQLite every 5 seconds

**CAP-02: Card Properties Management**
Build property editor that integrates with Isometry card schema and existing type system.
- **Acceptance:** Property panel shows/hides with toggle control
- **Acceptance:** Text, date, tag, and reference property types supported
- **Acceptance:** Properties save to nodes table compatible with main app
- **Acceptance:** Property validation follows existing Isometry patterns

**CAP-03: Slash Command System**
Create Notion-style slash commands for Isometry DSL integration and rapid content creation.
- **Acceptance:** Slash command menu appears with "/" trigger
- **Acceptance:** Commands for common Isometry DSL patterns
- **Acceptance:** Commands insert properly formatted content
- **Acceptance:** Command suggestions based on notebook context

**CAP-04: Card Template System**
Provide reusable templates for common card types (meeting notes, code snippets, project plans).
- **Acceptance:** Template gallery accessible from new card creation
- **Acceptance:** Templates pre-populate markdown and properties
- **Acceptance:** Custom templates can be saved and reused
- **Acceptance:** Templates integrate with slash command system

### Shell Component Requirements (SHELL)

**SHELL-01: Terminal Embedding**
Embed fully functional terminal using react-xtermjs with secure command execution.
- **Acceptance:** Terminal renders with proper sizing and scrolling
- **Acceptance:** Command execution works with proper environment
- **Acceptance:** Terminal state persists across component re-renders
- **Acceptance:** Security sandbox prevents access to sensitive files

**SHELL-02: Claude Code API Integration**
Connect to Claude Code API for AI-assisted development with notebook context awareness.
- **Acceptance:** Claude commands execute through terminal interface
- **Acceptance:** API responses display in terminal with proper formatting
- **Acceptance:** Current notebook card content provides context for commands
- **Acceptance:** Error handling manages API limits and connection issues

**SHELL-03: Project Context Awareness**
Make terminal aware of current project state including notebook content and main application data.
- **Acceptance:** Commands can reference current notebook card
- **Acceptance:** Commands can query Isometry database for context
- **Acceptance:** File operations respect project directory structure
- **Acceptance:** Environment variables include project-specific paths

**SHELL-04: Command Router**
Implement command routing that distinguishes between system commands and Claude Code calls.
- **Acceptance:** System commands execute in local terminal environment
- **Acceptance:** Claude Code commands route to API with proper formatting
- **Acceptance:** Command history includes both types with clear indicators
- **Acceptance:** Tab completion works for available commands

### Preview Component Requirements (PREV)

**PREV-01: Browser Engine Integration**
Integrate WKWebView for universal content rendering including web pages and local files.
- **Acceptance:** Web content renders with full browser functionality
- **Acceptance:** Local markdown files render with proper styling
- **Acceptance:** PDF files display with zoom and scroll controls
- **Acceptance:** Image files display with appropriate sizing

**PREV-02: D3 Visualization Support**
Render D3.js visualizations from notebook content with live updates during editing.
- **Acceptance:** D3 charts render from JSON data in markdown
- **Acceptance:** Visualizations update when data changes in editor
- **Acceptance:** Multiple visualization types supported (graphs, charts, maps)
- **Acceptance:** Visualization performance handles 1000+ data points

**PREV-03: Export Functionality**
Provide multiple export formats for notebook content including PDF, HTML, and raw data.
- **Acceptance:** Markdown exports with proper formatting
- **Acceptance:** PDF generation includes visualizations and images
- **Acceptance:** HTML export maintains interactive features
- **Acceptance:** Data export provides CSV/JSON for analysis

**PREV-04: Live Preview Updates**
Automatically update preview content when capture or shell components change state.
- **Acceptance:** Markdown changes reflect immediately in preview
- **Acceptance:** Shell command outputs trigger preview refresh
- **Acceptance:** Data visualizations update without manual refresh
- **Acceptance:** Preview scrolling position maintained during updates

### Integration Requirements (INT)

**INT-01: Data Flow Synchronization**
Ensure bidirectional data flow between notebook components and main Isometry application.
- **Acceptance:** Notebook cards appear in main app filters and searches
- **Acceptance:** Changes in main app reflect in open notebook cards
- **Acceptance:** PAFV projections include notebook card data
- **Acceptance:** LATCH filters work across all card sources

**INT-02: State Management Consistency**
Maintain consistent state across all components while preserving performance.
- **Acceptance:** Context updates propagate to all subscribed components
- **Acceptance:** State changes don't cause unnecessary re-renders
- **Acceptance:** Component unmounting doesn't lose unsaved work
- **Acceptance:** Browser refresh preserves notebook session state

**INT-03: Theme and Styling Unity**
Apply consistent theming across notebook components using existing CSS variables.
- **Acceptance:** All components respect current theme (NeXTSTEP/Modern)
- **Acceptance:** Theme switching affects notebook components immediately
- **Acceptance:** Custom CSS follows existing Tailwind conventions
- **Acceptance:** Component styling scales properly on different screen sizes

**INT-04: Performance Optimization**
Maintain 60fps performance with large datasets and complex visualizations.
- **Acceptance:** Component rendering stays under 16ms per frame
- **Acceptance:** SQLite queries complete under 100ms for real-time features
- **Acceptance:** Memory usage stays under 500MB with 1000+ cards
- **Acceptance:** Bundle size remains under 10MB compressed

## Version 2 (Future) Requirements

These requirements are explicitly deferred to maintain v1 scope:

- **Advanced slash commands** with complex DSL parsing
- **Real-time collaboration** with conflict resolution
- **Plugin architecture** for extensible commands
- **Advanced terminal features** beyond basic embedding
- **Custom visualization builders** beyond D3 integration
- **Mobile-responsive layouts** for tablet/phone
- **Offline synchronization** with conflict resolution

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| CAP-01 | Phase 2 | Pending |
| CAP-02 | Phase 2 | Pending |
| CAP-03 | Phase 2 | Pending |
| CAP-04 | Phase 2 | Pending |
| SHELL-01 | Phase 3 | Pending |
| SHELL-02 | Phase 3 | Pending |
| SHELL-03 | Phase 3 | Pending |
| SHELL-04 | Phase 3 | Pending |
| PREV-01 | Phase 4 | Pending |
| PREV-02 | Phase 4 | Pending |
| PREV-03 | Phase 4 | Pending |
| PREV-04 | Phase 4 | Pending |
| INT-01 | Phase 4 | Pending |
| INT-02 | Phase 4 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |

**Total v1 Requirements:** 20
**Requirements by Category:**
- Foundation: 4 requirements
- Capture: 4 requirements
- Shell: 4 requirements
- Preview: 4 requirements
- Integration: 4 requirements