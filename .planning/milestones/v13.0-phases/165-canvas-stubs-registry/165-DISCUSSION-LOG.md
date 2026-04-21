# Phase 165: Canvas Stubs + Registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 165-canvas-stubs-registry
**Areas discussed:** Registry architecture, Sidecar rendering, Stub visual content, File organization

---

## Registry Architecture

### Q1: Registry structure

| Option | Description | Selected |
|--------|-------------|----------|
| Module-level Map + lookup function | Map<string, CanvasRegistryEntry> in registry.ts. Export register() and getCanvasFactory() returning a CanvasFactory closure. SuperWidget never sees the Map. | ✓ |
| Plain object registry | Record<string, CanvasRegistryEntry> with lookup helper. Simpler but less type-safe. | |
| Self-registering stubs | Each stub calls register() on import as a side effect. | |

**User's choice:** Module-level Map + lookup function (Recommended)
**Notes:** None

### Q2: Registration mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit wiring point | registerAllStubs() function called once during app init. Clear, debuggable. | ✓ |
| Self-registering on import | Each stub calls register() as module side effect. More automatic but harder to trace. | |

**User's choice:** Explicit wiring point (Recommended)
**Notes:** None

### Q3: CanvasRegistryEntry shape

| Option | Description | Selected |
|--------|-------------|----------|
| canvasType + factory + optional defaultExplorerId | Minimal shape: { canvasType, create, defaultExplorerId? }. Only View entries set defaultExplorerId. | ✓ |
| Discriminated union by canvasType | Three entry types with compiler-enforced constraints. More code upfront. | |
| You decide | Claude picks simplest shape satisfying CANV-04 and CANV-05. | |

**User's choice:** canvasType + factory + optional defaultExplorerId
**Notes:** None

---

## Sidecar Rendering

### Q1: Sidecar implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Stub creates sidecar DOM itself | ViewCanvasStub.mount() creates child div with data-sidecar in Bound mode. Self-contained. | ✓ |
| Sidecar managed by SuperWidget | SuperWidget creates sidecar element, passes to ViewCanvasStub. More coupling. | |
| You decide | Claude picks approach best satisfying CANV-02 while keeping SuperWidget decoupled. | |

**User's choice:** Stub creates sidecar DOM itself (Recommended)
**Notes:** None

### Q2: Binding parameter flow

| Option | Description | Selected |
|--------|-------------|----------|
| Constructor parameter | ViewCanvasStub constructor takes binding: CanvasBinding. Factory closure captures from Projection. | ✓ |
| Extend CanvasComponent with setBinding() | Optional setBinding() method on interface. Avoids destroy/recreate but widens interface. | |
| You decide | Claude picks simplest approach consistent with Phase 164's destroy-then-mount lifecycle. | |

**User's choice:** Constructor parameter (Recommended)
**Notes:** None

---

## Stub Visual Content

### Q1: What stubs display

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal placeholder text | Display canvasType and canvasId as text (e.g., "[Explorer: canvas-1]"). Data attributes are real contract. | ✓ |
| Data attributes only | Empty divs with data attributes. No visible text. Purest stub. | |
| Styled placeholders | Light background + centered label. More visual but throwaway CSS. | |

**User's choice:** Minimal placeholder text (Recommended)
**Notes:** None

---

## File Organization

### Q1: File layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat in superwidget/ | registry.ts + 3 stub files directly in src/superwidget/. Matches existing flat pattern. | ✓ |
| stubs/ subdirectory | src/superwidget/stubs/ for stubs + registry.ts at top level. Easy to delete stubs/ dir later. | |
| canvas/ subdirectory | src/superwidget/canvas/ containing registry + all stubs. Groups canvas concerns. | |

**User's choice:** Flat in superwidget/ (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact data-render-count increment logic in stubs
- Whether getCanvasFactory() is called once at construction or lazily
- Internal structure of registerAllStubs()
- Whether EditorCanvasStub constructor takes binding param

## Deferred Ideas

None — discussion stayed within phase scope.
