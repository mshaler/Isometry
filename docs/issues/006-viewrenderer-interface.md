---
github_issue: 6
title: "P2.1: ViewRenderer Interface"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-2, d3]
phase: phase-2
url: https://github.com/mshaler/Isometry/issues/6
---
# Issue #6: P2.1: ViewRenderer Interface

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/6](https://github.com/mshaler/Isometry/issues/6)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-2`, `d3`

---

## Overview
Define the interface that all view types must implement.

## Requirements
- [ ] Define ViewRenderer interface
- [ ] Support PAFV axis configuration
- [ ] Handle card data input
- [ ] Support transitions between views
- [ ] Define common utilities (scales, positioning)

## Interface Design
```typescript
interface ViewRenderer {
  name: string;
  
  // Configure axes
  setXAxis(facet: Facet | null): void;
  setYAxis(facet: Facet | null): void;
  
  // Render
  render(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: Card[],
    dimensions: { width: number; height: number }
  ): void;
  
  // Transitions
  transitionFrom(previousView: ViewRenderer): void;
  
  // Interaction
  onCardClick?(card: Card): void;
  onCardHover?(card: Card | null): void;
}
```

## Deliverable
- `src/views/types.ts` with interfaces
- `src/views/BaseView.ts` with shared utilities


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 2: Views)
- [[isometry-evolution-timeline]] - Project timeline
