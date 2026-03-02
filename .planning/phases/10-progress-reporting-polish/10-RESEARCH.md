# Phase 10: Progress Reporting + Polish - Research

**Researched:** 2026-03-02
**Domain:** Worker Bridge notification protocol, Toast UI component, FTS optimization
**Confidence:** HIGH — all findings derived from live codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Progress Notification Format**
- Data payload: `{processed, total, rate, source, filename}` — includes cards/second rate for UI display
- Granularity: Fire every 100 cards (matches SQLiteWriter batch boundary)
- No stage info: Single progress stream, all stages blended into one
- Include filename: User sees which file is being imported alongside source type

**Main-Thread UI Integration**
- Display type: Toast notification in top-right corner
- Non-blocking: User can navigate, view existing cards while import runs
- Progress display: Shows rate during import: "Importing... 342/523 cards (48 cards/sec)"
- Completion: Toast with summary ("Imported 523 cards"), auto-dismisses after 5 seconds
- Error handling: Toast shows "Imported 520 cards, 3 errors" with expandable details on click
- No cancel button: Once started, import runs to completion
- Highlight effect: Newly imported cards get brief highlight animation when viewed

**Timeout Behavior**
- Fixed 300s: No user-configurable timeout
- No pre-timeout warning: 300s is generous, show error only if timeout actually occurs
- Timeout error message: Actionable — "Import timed out. Try importing in smaller batches."
- Partial data: Keep committed batches — user sees partially imported data

**FTS Optimization Feedback**
- Transparent phase: Progress shows "Importing... 100% (finalizing)" during FTS optimize
- FTS threshold: Claude's discretion based on technical factors
- FTS failure handling: Silent retry later — import succeeds, FTS optimize retries on next search

### Claude's Discretion

- FTS optimization threshold (when to run optimize)
- Toast animation and styling details
- Exact highlight animation for new cards
- Error detail panel implementation
- Progress rate smoothing algorithm

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETL-19 | Progress notifications as `WorkerNotification` type (no correlation ID), posted at 100-card batch boundaries; payload `{processed, total, source}`; main thread subscribes via `onnotification` callback; `etl:import` uses 300s timeout vs 30s default | Codebase inspection shows: no `WorkerNotification` type exists yet; `WorkerMessage` union must be extended; `WorkerBridge.handleMessage` must branch on notification; `importFile()` already swaps config.timeout but has a mutation bug; SQLiteWriter batch loop is the emission point; `self.postMessage` in worker.ts is the posting mechanism |
</phase_requirements>

---

## Summary

Phase 10 is an additive polish phase with three independent concerns wired together: (1) a new side-channel notification type in the Worker Bridge protocol, (2) a Toast UI component on the main thread that consumes those notifications, and (3) a post-import FTS `optimize` call in SQLiteWriter. Each concern is self-contained; the integration risk is low because the Worker Bridge protocol already supports typed message discrimination.

The codebase inspection reveals that `ETL_TIMEOUT` (300,000ms) is already defined in `protocol.ts` and `importFile()` already performs the timeout swap. However, there is a correctness problem: `this.config` is declared `private readonly`, meaning the reference itself cannot be reassigned, but the object's properties *can* be mutated. The current pattern of mutating `this.config.timeout` directly is not thread-safe across concurrent imports. The fix is to pass the timeout as a parameter to `send()` (or use a per-request timeout override) rather than mutating shared config state.

The FTS `optimize` is already invoked by `SQLiteWriter.rebuildFTS()`, which runs only for bulk imports (>500 cards, FTS triggers disabled). For non-bulk imports (incremental inserts with FTS triggers active), `optimize` is never called. The phase 10 requirement asks for `optimize` after *any* bulk import. The existing code already satisfies this for the FTS-disabled path. What is missing is: calling `optimize` standalone after incremental imports above a threshold, and surfacing the "finalizing" progress event to the user during that optimize call.

No Toast component, `WorkerNotification` type, or `onnotification` callback pattern exists anywhere in the codebase. All three must be built from scratch, following established CSS custom property conventions (`design-tokens.css`) and the TypeScript class patterns seen in providers and views.

**Primary recommendation:** Build in the order specified in the phase description — protocol types first, then WorkerBridge callback registration, then orchestrator emission, then timeout fix, then FTS optimize placement, then Toast UI, then integration tests.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native Web Worker `postMessage` | Browser standard | Side-channel notification delivery from Worker to main thread | Already the project's IPC mechanism; no new dependency |
| TypeScript discriminated unions | 5.9 (project standard) | Type-safe `WorkerNotification` alongside `WorkerResponse` | Project uses exhaustive switches everywhere; same pattern |
| CSS custom properties | Browser standard | Toast styling consistent with `design-tokens.css` tokens | All view components use design tokens; no CSS-in-JS |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `setTimeout(0)` yield | Browser standard | Cooperative yielding between SQLiteWriter batches | Already used in SQLiteWriter batch loop; progress emission happens here |
| `performance.now()` | Browser standard | Cards-per-second rate calculation | Higher precision than `Date.now()` for sub-second intervals |
| FTS5 `optimize` command | SQLite FTS5 built-in | Merge fragmented FTS segments post-import | After bulk insert completes; already called in `rebuildFTS()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate notification branch in `handleMessage` | Dedicated `EventTarget` or `BroadcastChannel` | Additional complexity; postMessage is already the IPC boundary |
| CSS class toggle for toast visibility | Web Animations API | CSS transitions are simpler and consistent with existing `.view-loading` pattern |
| Per-request timeout parameter in `send()` | Global config mutation (current approach) | Per-request is safer for concurrent imports; config mutation is a correctness bug |

**Installation:** No new packages required. This phase uses only existing project infrastructure.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── worker/
│   ├── protocol.ts          # Add WorkerNotification union and import_progress type
│   └── WorkerBridge.ts      # Add onnotification callback + per-request timeout override
├── etl/
│   ├── ImportOrchestrator.ts  # Accept onProgress callback, pass to SQLiteWriter
│   └── SQLiteWriter.ts        # Call onProgress callback at batch boundaries; optimize threshold
└── ui/
    └── ImportToast.ts       # New: Toast component (pure TypeScript + CSS class manipulation)
```

### Pattern 1: WorkerNotification Type Extension

**What:** Add a new discriminated union member to `WorkerMessage` that carries no correlation ID. The worker posts it via `self.postMessage` directly; WorkerBridge discriminates on `type === 'import_progress'` in `handleMessage`.

**When to use:** Any time the Worker needs to push data to the main thread without a corresponding request (fire-and-forget broadcast).

**Example:**

```typescript
// protocol.ts additions

/**
 * Notification posted by Worker with no correlation ID.
 * Main thread receives these via WorkerBridge.onnotification callback.
 * No response is expected or sent.
 */
export interface WorkerNotification {
  type: 'import_progress';
  payload: ImportProgressPayload;
}

export interface ImportProgressPayload {
  processed: number;
  total: number;
  /** Cards per second, smoothed over last batch */
  rate: number;
  source: SourceType;
  filename: string | undefined;
}

// Extend the WorkerMessage union:
export type WorkerMessage =
  | WorkerReadyMessage
  | WorkerInitErrorMessage
  | WorkerResponse
  | WorkerNotification;          // NEW

// Type guard for notification discrimination:
export function isNotification(msg: unknown): msg is WorkerNotification {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WorkerNotification).type === 'import_progress'
  );
}
```

**Source:** Live codebase inspection — `protocol.ts` lines 359-362 (`WorkerMessage` union), lines 371-404 (existing type guards pattern).

### Pattern 2: onnotification Callback Registration in WorkerBridge

**What:** A simple callback property on `WorkerBridge` that consumers set. `handleMessage` calls it when a `WorkerNotification` arrives (after discriminating with `isNotification`).

**When to use:** When main-thread code needs to react to unsolicited Worker messages without polling.

**Example:**

```typescript
// WorkerBridge.ts additions

// In class body:
/** Callback invoked for each WorkerNotification received */
onnotification: ((notification: WorkerNotification) => void) | null = null;

// In handleMessage(), add branch before the isResponse check:
if (isNotification(message)) {
  if (this.onnotification) {
    this.onnotification(message);
  }
  return;
}
```

**Source:** Live codebase inspection — `WorkerBridge.handleMessage` at line 420; existing `isReadyMessage`/`isInitErrorMessage` branching pattern.

### Pattern 3: Timeout Fix — Per-Request Timeout Override

**What:** The current `importFile()` mutates `this.config.timeout` then restores it. This is safe only for serial imports; concurrent calls would race. Fix by passing the timeout as a parameter to `send()` internally.

**When to use:** Any time different request types need different timeouts.

**Correct approach (two options):**

Option A — Pass timeout to `send()` as optional parameter:
```typescript
// In send():
async send<T extends WorkerRequestType>(
  type: T,
  payload: WorkerPayloads[T],
  timeoutOverride?: number   // NEW optional parameter
): Promise<WorkerResponses[T]> {
  const timeout = timeoutOverride ?? this.config.timeout;
  // Use `timeout` instead of `this.config.timeout` in setTimeout call
}

// In importFile():
return await this.send('etl:import', payload, ETL_TIMEOUT);
// Remove the config mutation entirely
```

Option B — Keep current mutation pattern but document it as single-import constraint. This is acceptable given the project's use case (one import at a time from UI), but Option A is cleaner.

**Recommendation:** Option A — cleaner, no mutation of shared state.

**Source:** Live codebase inspection — `WorkerBridge.ts` lines 299-310 (current mutation pattern), lines 368-411 (`send()` implementation).

### Pattern 4: Progress Emission in SQLiteWriter

**What:** Accept an optional callback in `writeCards()` and call it at each batch boundary after the `setTimeout(0)` yield (so the main thread has a chance to process the notification before the next batch starts).

**When to use:** Whenever a long-running operation needs incremental progress reporting without blocking.

**Example:**

```typescript
// In SQLiteWriter:
export type ProgressCallback = (processed: number, total: number) => void;

async writeCards(
  cards: CanonicalCard[],
  isBulkImport = false,
  onProgress?: ProgressCallback
): Promise<void> {
  // ...existing setup...

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    this.insertBatch(batch);

    const processed = Math.min(i + BATCH_SIZE, cards.length);

    // Yield to event loop — progress notification happens here
    if (i + BATCH_SIZE < cards.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Emit progress AFTER yield so main thread gets the event
    onProgress?.(processed, cards.length);
  }

  // ...FTS rebuild...
}
```

**Source:** Live codebase inspection — `SQLiteWriter.ts` lines 38-55 (existing batch loop with `setTimeout(0)` yield).

### Pattern 5: ImportOrchestrator Progress Wiring

**What:** `ImportOrchestrator.import()` must accept a progress callback and pass it to `SQLiteWriter`. The callback must also emit `import_progress` via `self.postMessage` in the Worker context.

**Key decision:** The `ImportOrchestrator` lives inside the Worker. It cannot call `self.postMessage` directly without a reference to the posting function. The cleanest approach is to pass a `postNotification` callback from the handler into the orchestrator.

**Example:**

```typescript
// In etl-import.handler.ts:
export async function handleETLImport(
  db: Database,
  payload: WorkerPayloads['etl:import']
): Promise<WorkerResponses['etl:import']> {
  const orchestrator = new ImportOrchestrator(db);

  // Wire progress emission to self.postMessage
  orchestrator.onProgress = (processed, total, rate) => {
    const notification: WorkerNotification = {
      type: 'import_progress',
      payload: {
        processed,
        total,
        rate,
        source: payload.source,
        filename: payload.options?.filename,
      },
    };
    self.postMessage(notification);
  };

  return orchestrator.import(payload.source, payload.data, options);
}
```

**Source:** Live codebase inspection — `etl-import.handler.ts` (full file, thin delegation pattern); `worker.ts` lines 345-352 (existing `self.postMessage` usage).

### Pattern 6: FTS Optimize Threshold

**What:** Determine when to call `optimize` standalone (i.e., for incremental imports that didn't disable FTS triggers). The existing `rebuildFTS()` already calls `optimize` for bulk imports. The additional case is: after *any* import that inserted a significant number of cards.

**Claude's discretion:** Recommend running `optimize` when `toInsert.length > 100`. This covers any import that creates meaningful FTS segment fragmentation. The command is fast (<50ms for typical datasets) and idempotent.

**Implementation in SQLiteWriter:**

```typescript
// New standalone method:
optimizeFTS(): void {
  try {
    this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
  } catch {
    // Silent failure — import already succeeded; FTS optimize retries on next search
    // (FTS failure handling: per CONTEXT.md, silent retry later)
  }
}
```

Called from `ImportOrchestrator.import()` after `writeCards()` completes, when `dedupResult.toInsert.length > 100` and `!isBulkImport` (bulk path already calls it via `rebuildFTS()`).

**Source:** Live codebase inspection — `SQLiteWriter.ts` lines 184-191 (`rebuildFTS()` already calls `optimize`).

### Pattern 7: Toast Component

**What:** A pure TypeScript class that creates and manages a DOM element positioned `fixed` in the top-right corner. Uses CSS class toggles for visibility and CSS transitions for animation. Follows the `design-tokens.css` custom property system.

**When to use:** UI feedback for long-running background operations.

**Structure:**

```typescript
// src/ui/ImportToast.ts
export class ImportToast {
  private el: HTMLDivElement;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private totalCards = 0;

  constructor(container: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'import-toast';
    this.el.setAttribute('aria-live', 'polite');
    container.appendChild(this.el);
  }

  showProgress(processed: number, total: number, rate: number, filename?: string): void { ... }
  showFinalizing(): void { ... }
  showSuccess(result: ImportResult): void { ... }
  showError(message: string): void { ... }
  dismiss(): void { ... }
  destroy(): void { ... }
}
```

**CSS follows existing project conventions:**

```css
/* Uses design-tokens.css variables */
.import-toast {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  z-index: 9999;
  min-width: 280px;
  max-width: 400px;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--bg-surface);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  pointer-events: none;
}

.import-toast.is-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

**Source:** `design-tokens.css` (full file), `views.css` `.view-loading` and `.view-error-banner` patterns.

### Pattern 8: Highlight Animation for Newly Imported Cards

**Claude's discretion:** A `@keyframes import-highlight` that flashes the card background from accent color (12% opacity) to transparent over 1.5 seconds. Applied via a CSS class added to card DOM elements after import, removed after animation ends via `animationend` event.

```css
@keyframes import-highlight {
  0%   { background-color: rgba(74, 158, 255, 0.12); }
  100% { background-color: transparent; }
}

.card-import-highlight {
  animation: import-highlight 1.5s ease-out forwards;
}
```

The `insertedIds` from `ImportResult` enables the main thread to query and highlight the correct cards.

### Anti-Patterns to Avoid

- **Mutating `this.config.timeout`:** Current `importFile()` does this. It is safe only for sequential imports. Fix with per-request timeout parameter to `send()`.
- **Calling `optimize` inside the FTS trigger disable/rebuild path twice:** `rebuildFTS()` already calls `optimize`. Do not add a second `optimize` call for the bulk path — only add it for the incremental (non-bulk) path.
- **Registering `onnotification` after `importFile()` is called:** The callback must be set before the import begins. Document this contract.
- **Blocking the Worker during FTS optimize:** `optimize` is synchronous but fast. It runs inside the Worker after all card inserts complete. Do not yield between inserts and optimize — the yield happens between batches, and optimize runs once at the end.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate smoothing | Custom exponential moving average | Simple sliding window over last batch duration | Simpler, sufficient for a progress display that updates every 100 cards; EMA adds complexity without visible benefit |
| Toast positioning | Absolute positioning relative to a parent | CSS `position: fixed` with top/right | Fixed positioning survives scroll and view transitions; matches Slack-style UX decision |
| Animation timing | JavaScript `requestAnimationFrame` loop | CSS `transition` on `.is-visible` class toggle | CSS transitions are off main thread; rAF loop adds overhead and D3 `.transition()` crashes jsdom per known debt |
| Notification queue | Custom message bus or event emitter | Direct `onnotification` callback property | Simpler; only one import runs at a time; queue adds complexity without benefit |

**Key insight:** The Worker Bridge postMessage channel is already the project's IPC boundary. A side-channel notification is just another branch in `handleMessage` — no new infrastructure needed.

---

## Common Pitfalls

### Pitfall 1: isNotification check must come BEFORE isResponse check

**What goes wrong:** `WorkerNotification` messages have no `id` or `success` field. The `isResponse` type guard checks for both `id` and `success`. If a notification arrives and `isNotification` is not checked first, it falls through to "Unknown message type" in debug mode and is silently dropped.

**Why it happens:** Current `handleMessage` branches: `isReadyMessage` → `isInitErrorMessage` → `isResponse` → unknown. A fourth branch for `isNotification` must be inserted before the `isResponse` check (though any order before the final fallthrough is technically correct, convention says most-common last).

**How to avoid:** Insert `isNotification` branch in `handleMessage` before the `isResponse` branch. Add a type guard test in the protocol tests.

**Warning signs:** `onnotification` callback never fires during an import; no runtime errors (messages are silently dropped).

### Pitfall 2: progress emits total=0 for the first batch

**What goes wrong:** The `total` count is only known after parsing completes and dedup runs. If `writeCards()` is called before total is known, the first notification carries `total: 0`.

**Why it happens:** SQLiteWriter sees the array passed to it — that's the total for the write phase, not the overall import total including updates and connections.

**How to avoid:** Pass `total` as the full `dedupResult.toInsert.length + dedupResult.toUpdate.length` from `ImportOrchestrator`. The orchestrator knows this value before calling `writeCards()`. SQLiteWriter receives `cards.length` as its local total, but the orchestrator's callback wrapper can substitute the full total.

**Warning signs:** Progress toast shows "0/523" on first event then jumps to correct total.

### Pitfall 3: concurrent import calls racing on `this.config.timeout`

**What goes wrong:** If two `importFile()` calls overlap (unlikely but possible), the second call restores the original timeout in `finally`, interrupting the first call's extended timeout.

**Why it happens:** `this.config.timeout` is shared mutable state.

**How to avoid:** Fix by passing `timeoutOverride` parameter to `send()` (Pattern 3 above). No shared state mutation.

**Warning signs:** Large import times out at 30s instead of 300s when triggered while another bridge operation is in-flight.

### Pitfall 4: FTS optimize called twice in bulk path

**What goes wrong:** `rebuildFTS()` already calls `optimize`. If the new standalone `optimizeFTS()` is called without checking `isBulkImport`, the bulk path calls it twice — harmless but wasteful.

**How to avoid:** Guard with `if (!isBulkImport)` before calling `optimizeFTS()` in `ImportOrchestrator`, since `rebuildFTS()` handles the bulk case.

**Warning signs:** Two FTS `optimize` calls visible in SQLite trace logs; minor latency spike at end of large imports.

### Pitfall 5: Toast self-dismissal race with completion event

**What goes wrong:** The progress toast auto-dismisses after 5 seconds. If the import finishes at second 4.9, the completion toast replaces the progress toast, then the dismiss timer fires at second 5 and removes the *completion* toast before the user reads it.

**How to avoid:** The `showSuccess()` call must cancel the existing dismiss timer (`clearTimeout(this.dismissTimer)`) before setting a new 5-second timer for the success state. Each state transition resets the timer.

**Warning signs:** Completion toast disappears almost immediately after appearing.

---

## Code Examples

Verified patterns from codebase inspection:

### WorkerMessage union extension (existing pattern in protocol.ts)

```typescript
// Current (line 359-363):
export type WorkerMessage =
  | WorkerReadyMessage
  | WorkerInitErrorMessage
  | WorkerResponse;

// After Phase 10:
export type WorkerMessage =
  | WorkerReadyMessage
  | WorkerInitErrorMessage
  | WorkerResponse
  | WorkerNotification;
```

### self.postMessage notification from Worker (existing pattern in worker.ts)

```typescript
// Existing usage (lines 345-352, postSuccessResponse):
function postSuccessResponse<T>(id: string, data: T): void {
  const response: WorkerResponse<T> = { id, success: true, data };
  self.postMessage(response);
}

// New notification pattern (no id, no success):
function postNotification(notification: WorkerNotification): void {
  self.postMessage(notification);
}
```

### SQLiteWriter batch loop with progress (extending existing pattern)

```typescript
// Current (SQLiteWriter.ts lines 38-54):
for (let i = 0; i < cards.length; i += BATCH_SIZE) {
  const batch = cards.slice(i, i + BATCH_SIZE);
  this.insertBatch(batch);

  if (i + BATCH_SIZE < cards.length) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// Phase 10 extension:
const batchStart = performance.now();
for (let i = 0; i < cards.length; i += BATCH_SIZE) {
  const batch = cards.slice(i, i + BATCH_SIZE);
  const batchWriteStart = performance.now();
  this.insertBatch(batch);

  const processed = Math.min(i + BATCH_SIZE, cards.length);
  const elapsed = performance.now() - batchWriteStart;
  const rate = Math.round((batch.length / elapsed) * 1000); // cards/sec

  await new Promise(resolve => setTimeout(resolve, 0));
  onProgress?.(processed, cards.length, rate);
}
```

### FTS optimize (already in rebuildFTS, add standalone variant)

```typescript
// Existing (SQLiteWriter.ts line 190):
this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");

// New standalone (silent failure per CONTEXT.md):
optimizeFTS(): void {
  try {
    this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
  } catch {
    // Silent — import succeeded; FTS recover on next search
  }
}
```

### Toast CSS (follows design-tokens.css conventions)

```css
/* Follows existing pattern from views.css */
.import-toast {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  z-index: 9999;
  min-width: 280px;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--bg-surface);
  border: 1px solid rgba(74, 158, 255, 0.3); /* --accent at 30% */
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  pointer-events: none;
}
.import-toast.is-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.import-toast-progress {
  height: 3px;
  background-color: var(--accent);
  border-radius: var(--radius-sm);
  transition: width var(--transition-fast);
  margin-top: var(--space-xs);
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Global config mutation for per-request timeout | Per-request timeout override parameter | Phase 10 should fix this; mutation existed from Phase 8 as a known gap |
| `optimize` only in bulk rebuild path | `optimize` also after incremental imports above threshold | Phase 10 adds incremental path |
| No progress feedback | Toast with live rate display | Phase 10 addition |

**Already implemented (no change needed):**
- `ETL_TIMEOUT = 300_000` constant in `protocol.ts` — exists, correct
- `importFile()` uses extended timeout — exists, just needs mutation fix
- `rebuildFTS()` calls `optimize` — exists for bulk path
- 100-card batch loop with `setTimeout(0)` yield — exists in `SQLiteWriter`

---

## Open Questions

1. **Rate smoothing algorithm**
   - What we know: User decisions say "rate display should update smoothly, not jump around" (CONTEXT.md specifics)
   - What's unclear: Simple per-batch rate vs. rolling average over last N batches
   - Recommendation: Use a 3-batch exponential moving average (`rate = 0.7 * lastRate + 0.3 * batchRate`). Prevents single-batch outliers from jumping the display. Low complexity, easy to implement inline.

2. **Error detail panel expansion**
   - What we know: Toast shows "3 errors" and is "expandable details on click" per CONTEXT.md
   - What's unclear: Whether this is a popover, inline expansion, or modal
   - Recommendation: Inline expansion — clicking the "3 errors" text toggles a `<details>` element within the toast showing the `errors_detail` array. No modal, no popover — keeps it simple and non-blocking.

3. **Highlight animation application point**
   - What we know: `insertedIds` from `ImportResult` is available; cards get "brief highlight animation when viewed"
   - What's unclear: "When viewed" — does this mean when the card enters the DOM, or immediately post-import?
   - Recommendation: Apply highlight class when newly-imported cards are rendered by any view. Store `insertedIds` in a `Set` on `WorkerBridge` (cleared after 60s); views check this set during their `data()` join key function and add `.card-import-highlight` class to matching elements.

4. **FTS optimize threshold for incremental imports**
   - What we know: Claude's discretion; existing bulk threshold is 500 cards
   - Recommendation: 100 cards. This is the batch size; any import creating more than one batch generates meaningful FTS segment fragmentation. The `optimize` command is fast (<50ms) and idempotent, so the threshold can be conservative.

---

## Validation Architecture

**Note:** `workflow.nyquist_validation` is not set in `.planning/config.json` — this section is skipped per research agent instructions.

---

## Sources

### Primary (HIGH confidence)

- **Live codebase — `src/worker/protocol.ts`** — Full file inspection; `WorkerMessage` union (line 359), `ETL_TIMEOUT` (line 489), `WorkerBridgeConfig` (lines 461-476), type guards pattern (lines 371-422)
- **Live codebase — `src/worker/WorkerBridge.ts`** — Full file inspection; `handleMessage` branching (lines 420-458), `importFile()` timeout mutation (lines 294-310), `send()` implementation (lines 368-411)
- **Live codebase — `src/etl/SQLiteWriter.ts`** — Full file inspection; batch loop with yield (lines 38-55), `rebuildFTS()` with `optimize` (lines 184-191), `BULK_THRESHOLD = 500` (line 14)
- **Live codebase — `src/etl/ImportOrchestrator.ts`** — Full file inspection; pipeline flow and where progress callbacks would be wired (lines 60-126)
- **Live codebase — `src/worker/worker.ts`** — Full file inspection; `self.postMessage` pattern (lines 345-369), handler routing (lines 173-328)
- **Live codebase — `src/worker/handlers/etl-import.handler.ts`** — Full file; thin delegation pattern confirmed (29 lines)
- **Live codebase — `src/styles/design-tokens.css`** — Full file; CSS custom properties for toast styling
- **Live codebase — `src/styles/views.css`** — Full file; existing UI component patterns (loading, error banner, card)
- **Live codebase — `vitest.config.ts`** — Test infrastructure: Vitest 4.0, `pool: forks`, `environment: node`, `testTimeout: 10000`
- **Live codebase — `tests/integration/etl-roundtrip.test.ts`** — Integration test pattern; `Database` + `ImportOrchestrator` directly (no Worker mock)
- **Live codebase — `.planning/phases/10-progress-reporting-polish/10-CONTEXT.md`** — User decisions

### Secondary (MEDIUM confidence)

- **Memory / STATE.md** — Phase 8 and 9 accumulated decisions; confirms patterns and known debt

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all infrastructure exists
- Architecture: HIGH — all patterns verified against live codebase
- Pitfalls: HIGH — derived from actual code paths, not speculation
- Toast UI: MEDIUM — no prior toast in codebase; CSS patterns are solid but JS lifecycle is new territory

**Research date:** 2026-03-02
**Valid until:** Stable — this phase builds on locked architecture; valid until Phase 10 implementation complete
