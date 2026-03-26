---
phase: 123-directory-discovery
plan: 02
subsystem: typescript-ui
tags: [typescript, ui, css, native-bridge, alto-index, dialog, disc-03]

requires:
  - phase: 123-01
    provides: Swift native:alto-discovery bridge message and directory picker flow

provides:
  - DirectoryDiscoverySheet class with open/close lifecycle and Promise-based API
  - src/styles/directory-discovery.css with all .disc-* CSS classes from UI-SPEC
  - DataExplorerPanel "Choose Alto-Index Folder" CTA button (native context only)
  - NativeBridge handler for native:alto-discovery dispatching alto-discovery custom event
  - main.ts wiring: singleton sheet, onPickAltoDirectory, alto-discovery listener

affects:
  - 123-03 (human verify: end-to-end flow tested in Xcode build)
  - 124-selective-import-partitioning (will receive selected subdirectory paths for actual import)

tech-stack:
  added: []
  patterns:
    - "DirectoryDiscoverySheet: <dialog> + showModal() for native focus trap; Promise-based open/close"
    - "Badge colors: data-type attribute on .disc-row__badge maps to source provenance CSS tokens"
    - "CTA conditional render: window.webkit?.messageHandlers?.nativeBridge guard for native-only button"
    - "Bridge event bus: NativeBridge dispatches CustomEvent('alto-discovery') for main.ts to handle"

key-files:
  created:
    - src/ui/DirectoryDiscoverySheet.ts
    - src/styles/directory-discovery.css
  modified:
    - src/ui/DataExplorerPanel.ts
    - src/native/NativeBridge.ts
    - src/main.ts

key-decisions:
  - "DirectoryDiscoverySheet uses <dialog> showModal() (not AppDialog) — needs checkbox list, not simple confirm"
  - "Badge data-type attribute maps exact Swift subdirectory names to CSS source provenance tokens"
  - "CTA button rendered only when window.webkit?.messageHandlers?.nativeBridge is present — no-op in browser/web"
  - "alto-discovery CustomEvent pattern keeps NativeBridge decoupled from UI — bridge dispatches, main.ts handles"
  - "Phase 124 import wiring deferred per plan scope — selected directories logged only in Phase 123"

requirements-completed: [DISC-03]

duration: ~8min
completed: 2026-03-26
---

# Phase 123 Plan 02: Directory Discovery (TypeScript UI) Summary

**DirectoryDiscoverySheet modal with .disc-* CSS, CTA button in Data Explorer, and native:alto-discovery bridge handler dispatching to main.ts via CustomEvent**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T00:24:00Z
- **Completed:** 2026-03-26T00:32:31Z
- **Tasks:** 2 auto (Task 3 is human-verify checkpoint)
- **Files modified:** 5

## Accomplishments

- `src/ui/DirectoryDiscoverySheet.ts` — modal dialog class with `open(payload, returnFocusEl?)` returning `Promise<DiscoveredSubdirectory[] | null>`. Renders subdirectory list with pre-checked checkboxes and type badges. Empty state when no subdirectories. Exports `AltoDiscoveryPayload` and `DiscoveredSubdirectory` interfaces.
- `src/styles/directory-discovery.css` — `.disc-sheet`, `.disc-row`, `.disc-row__badge`, `.disc-sheet__empty` with all 11 badge data-type rules using source provenance tokens. max-width: 480px per UI-SPEC.
- `src/ui/DataExplorerPanel.ts` — `onPickAltoDirectory` added to config interface; "Choose Alto-Index Folder" button conditionally rendered in native context; `getAltoCTABtn()` public getter for focus restoration.
- `src/native/NativeBridge.ts` — `native:alto-discovery` case dispatches `CustomEvent('alto-discovery', { detail: payload })` for main.ts to handle.
- `src/main.ts` — imports `DirectoryDiscoverySheet`; singleton `discoverySheet`; `onPickAltoDirectory` posts `native:request-alto-discovery`; `alto-discovery` listener opens sheet and logs selection (Phase 124 will handle actual import).

## Task Commits

1. **Task 1: Create DirectoryDiscoverySheet component and CSS** - `be4bfa9a` (feat)
2. **Task 2: Wire CTA button and bridge handler** - `0583ffb3` (feat)

## Files Created/Modified

- `src/ui/DirectoryDiscoverySheet.ts` - New: DirectoryDiscoverySheet class
- `src/styles/directory-discovery.css` - New: .disc-* CSS classes with badge colors
- `src/ui/DataExplorerPanel.ts` - Modified: onPickAltoDirectory config + CTA button + getAltoCTABtn()
- `src/native/NativeBridge.ts` - Modified: native:alto-discovery case added
- `src/main.ts` - Modified: import, singleton, onPickAltoDirectory, alto-discovery listener

## Decisions Made

- `DirectoryDiscoverySheet` uses `<dialog>` with `.showModal()` directly (not via AppDialog utility) because it needs a scrollable list of checkboxes rather than a simple confirm/cancel prompt. The `.app-dialog__btn` and `.app-dialog__actions` classes are reused for visual consistency without adopting the AppDialog control flow.
- Badge `data-type` attribute carries the exact lowercase subdirectory name from Swift (e.g., `safari-history`, `voice-memos`) — this matches the UI-SPEC naming contract and maps to pre-existing source provenance CSS tokens.
- The CTA button is gated on `window.webkit?.messageHandlers?.nativeBridge` so it remains invisible in browser/web testing contexts where the native picker cannot run.
- `NativeBridge.ts` dispatches a DOM `CustomEvent('alto-discovery')` rather than calling UI code directly — preserves the NativeBridge/UI decoupling pattern established across prior phases.

## Checkpoint: Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` — the end-to-end flow (Xcode build + CTA + picker + sheet) requires human verification in the running app. See checkpoint message for verification steps.

## Deviations from Plan

None — plan executed exactly as written. All three files modified per spec, CSS matches UI-SPEC exactly.

## Self-Check: PASSED

- src/ui/DirectoryDiscoverySheet.ts: FOUND
- src/styles/directory-discovery.css: FOUND
- src/ui/DataExplorerPanel.ts: FOUND (contains 'Choose Alto-Index Folder', 'onPickAltoDirectory', 'getAltoCTABtn')
- src/native/NativeBridge.ts: FOUND (contains 'native:alto-discovery')
- src/main.ts: FOUND (contains 'DirectoryDiscoverySheet', 'discoverySheet', 'alto-discovery')
- Commit be4bfa9a (Task 1): FOUND
- Commit 0583ffb3 (Task 2): FOUND
- TypeScript src/ errors: 0

---
*Phase: 123-directory-discovery*
*Completed (Tasks 1-2): 2026-03-26*
