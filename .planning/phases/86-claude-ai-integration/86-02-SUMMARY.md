---
phase: 86-claude-ai-integration
plan: 02
subsystem: claude-ai
tags: [project-context, architecture-awareness, latch-graph-pafv]

# Dependency graph
requires:
  - Basic chat interface (86-01)
provides:
  - Isometry architecture context in Claude conversations
  - Active card context injection
  - Filter state awareness
affects: [86-03, 86-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [context-builder, system-prompt-injection]

key-files:
  created:
    - src/services/claude-ai/projectContext.ts
    - src/hooks/useProjectContext.ts
  modified:
    - src/services/claude-ai/index.ts
    - src/hooks/index.ts
    - src/hooks/useClaudeAI.ts
    - src/components/claude-ai/ClaudeAIChat.tsx

key-decisions:
  - "Architecture context always included by default"
  - "LATCH/GRAPH/PAFV/SuperGrid concepts in system prompt"
  - "Active card context shows name, folder, tags, content preview"
  - "Filter state converted to record for prompt inclusion"

patterns-established:
  - "buildSystemPrompt() for context-aware prompts"
  - "useProjectContext hook for gathering context"
  - "Context indicator in chat empty state"

# Metrics
duration: ~6 min
completed: 2026-02-14
---

# Phase 86 Plan 02: Project Context Summary

**Isometry architecture awareness for Claude AI conversations**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-02-14
- **Completed:** 2026-02-14
- **Tasks:** 4 automated (all complete)
- **Files created:** 2
- **Files modified:** 4

## Accomplishments

- projectContext.ts: Rich system prompt builder with architecture reference
- useProjectContext hook: Gathers active card and filter context
- useClaudeAI updated: Accepts projectContext, includeArchitecture options
- ClaudeAIChat updated: Passes context, shows architecture enabled indicator

## Context Included in Conversations

1. **PAFV** - Planes/Axes/Facets/Values spatial projection system
2. **LATCH** - Location/Alphabet/Time/Category/Hierarchy filtering
3. **GRAPH** - Link/Nest/Sequence/Affinity edge types
4. **LPG** - Labeled Property Graph model
5. **SuperGrid** - Nested dimensional headers with density controls
6. **Three-Canvas Notebook** - Capture/Shell/Preview layout
7. **Tech Stack** - sql.js, D3.js, React, TypeScript
8. **Active Card** - Name, folder, tags, content preview (when available)
9. **Active Filters** - Current filter state from FilterContext

## Files Created

- `src/services/claude-ai/projectContext.ts` - System prompt builder
- `src/hooks/useProjectContext.ts` - Context gathering hook

## Files Modified

- `src/services/claude-ai/index.ts` - Export context types
- `src/hooks/index.ts` - Export useProjectContext
- `src/hooks/useClaudeAI.ts` - Accept projectContext option
- `src/components/claude-ai/ClaudeAIChat.tsx` - Pass context, show indicator

## Testing Points

Ask Claude these questions to verify context:
1. "What is SuperGrid?" → Should explain nested headers, density controls
2. "What are the LATCH dimensions?" → Should list Location, Alphabet, Time, Category, Hierarchy
3. "How does GRAPH relate to edges?" → Should explain LINK, NEST, SEQUENCE, AFFINITY
4. "What is PAFV?" → Should explain Planes, Axes, Facets, Values

## Decisions Made

- **Architecture always included:** `includeArchitecture` defaults to true
- **Context indicator:** Shows "Isometry architecture context enabled" in empty state
- **Active card display:** Shows card name with purple highlight when card is active
- **SQL query pattern:** Uses `WHERE 1=0` for empty result when no activeNodeId

## Deviations from Plan

- None

## Issues Encountered

- useSQLiteQuery doesn't accept null, used `WHERE 1=0` pattern instead

## Next Phase

Phase 86-03: MCP Server Integration
- Register tools and resources for Claude
- Enable file operations and database queries
- Add command execution capabilities

---
*Phase: 86-claude-ai-integration*
*Status: COMPLETE*
