# Phase 10: Progress Reporting + Polish - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users importing large datasets receive live progress feedback through the Worker Bridge, with extended timeouts preventing silent hangs and FTS optimization keeping search fast post-import. This phase adds progress notifications to the existing ETL pipeline, UI feedback for import operations, and post-import FTS optimization.

</domain>

<decisions>
## Implementation Decisions

### Progress Notification Format
- **Data payload:** `{processed, total, rate, source, filename}` — includes cards/second rate for UI display
- **Granularity:** Fire every 100 cards (matches SQLiteWriter batch boundary)
- **No stage info:** Single progress stream, all stages blended into one
- **Include filename:** User sees which file is being imported alongside source type

### Main-Thread UI Integration
- **Display type:** Toast notification in top-right corner
- **Non-blocking:** User can navigate, view existing cards while import runs
- **Progress display:** Shows rate during import: "Importing... 342/523 cards (48 cards/sec)"
- **Completion:** Toast with summary ("Imported 523 cards"), auto-dismisses after 5 seconds
- **Error handling:** Toast shows "Imported 520 cards, 3 errors" with expandable details on click
- **No cancel button:** Once started, import runs to completion
- **Highlight effect:** Newly imported cards get brief highlight animation when viewed

### Timeout Behavior
- **Fixed 300s:** No user-configurable timeout
- **No pre-timeout warning:** 300s is generous, show error only if timeout actually occurs
- **Timeout error message:** Actionable — "Import timed out. Try importing in smaller batches."
- **Partial data:** Keep committed batches — user sees partially imported data

### FTS Optimization Feedback
- **Transparent phase:** Progress shows "Importing... 100% (finalizing)" during FTS optimize
- **FTS threshold:** Claude's discretion based on technical factors
- **FTS failure handling:** Silent retry later — import succeeds, FTS optimize retries on next search

### Claude's Discretion
- FTS optimization threshold (when to run optimize)
- Toast animation and styling details
- Exact highlight animation for new cards
- Error detail panel implementation
- Progress rate smoothing algorithm

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkerBridge` (src/worker/WorkerBridge.ts): Already has correlation ID plumbing, pending requests map, timeout handling
- `protocol.ts`: Has `WorkerRequestType` union ready for new notification type
- `SQLiteWriter` (src/etl/SQLiteWriter.ts): Already has 100-card batch loop with `setTimeout(0)` yields — progress emission point exists
- `ImportOrchestrator`: Pipeline stages (parse → dedup → write → catalog) are clear insertion points

### Established Patterns
- Worker messages use typed `WorkerRequest`/`WorkerResponse` with correlation IDs
- `ETL_TIMEOUT` constant exists in protocol.ts — can extend pattern
- FTS triggers disabled/rebuilt for bulk imports (BULK_THRESHOLD = 500)

### Integration Points
- `WorkerBridge.importFile()` — will emit notifications to registered callback
- Main thread needs `onnotification` callback registration pattern
- Toast component needed (no existing toast system in codebase)

</code_context>

<specifics>
## Specific Ideas

- Toast should feel lightweight, not intrusive — similar to Slack's upload progress
- Rate display should update smoothly, not jump around
- Highlight animation should be subtle — brief glow, not flashy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-progress-reporting-polish*
*Context gathered: 2026-03-02*
