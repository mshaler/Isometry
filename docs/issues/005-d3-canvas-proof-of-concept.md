---
github_issue: 5
title: "P1.5: D3 Canvas Proof of Concept"
state: open
created: 2026-01-16
updated: 2026-01-16
labels: [mvp, phase-1, blocker, d3]
phase: phase-1
url: https://github.com/mshaler/Isometry/issues/5
---
# Issue #5: P1.5: D3 Canvas Proof of Concept

**Status:** OPEN
**GitHub:** [https://github.com/mshaler/Isometry/issues/5](https://github.com/mshaler/Isometry/issues/5)
**Created:** 2026-01-16
**Updated:** 2026-01-16

**Labels:** `mvp`, `phase-1`, `blocker`, `d3`

---

## Overview
Render cards on Canvas using D3 data binding, proving the SQLite → D3 pipeline works.

## Requirements
- [ ] Create useD3 hook for canvas management
- [ ] Fetch data with useSQLiteQuery
- [ ] Bind data with D3's .data().join() pattern
- [ ] Render cards as simple rectangles with titles
- [ ] Handle window resize

## Implementation
```typescript
// src/hooks/useD3.ts
function useD3<T extends SVGElement>(
  renderFn: (svg: d3.Selection<T, unknown, null, undefined>) => void,
  deps: any[]
) {
  const ref = useRef<T>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    renderFn(svg);
  }, deps);
  
  return ref;
}

// src/components/Canvas.tsx
function Canvas() {
  const { data: cards } = useSQLiteQuery<Card>('SELECT * FROM nodes');
  
  const svgRef = useD3<SVGSVGElement>((svg) => {
    svg.selectAll('.card')
      .data(cards ?? [], d => d.id)
      .join('rect')
        .attr('class', 'card')
        .attr('x', (d, i) => (i % 10) * 120)
        .attr('y', (d, i) => Math.floor(i / 10) * 80)
        .attr('width', 100)
        .attr('height', 60)
        .attr('fill', '#fff')
        .attr('stroke', '#000');
  }, [cards]);
  
  return <svg ref={svgRef} className="w-full h-full" />;
}
```

## Deliverable
- `src/hooks/useD3.ts`
- Updated `src/components/Canvas.tsx`
- Cards render from SQLite data


---

## Related

- [[ISOMETRY-MVP-GAP-ANALYSIS]] - MVP Roadmap (Phase 1: Foundation)
- [[isometry-evolution-timeline]] - Project timeline
