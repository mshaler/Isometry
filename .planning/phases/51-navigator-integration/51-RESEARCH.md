# Phase 51: Navigator UI Integration - Research

**Researched:** 2026-02-10
**Domain:** React component integration, drag-and-drop UI, LATCH+GRAPH property classification
**Confidence:** HIGH

## Summary

Phase 51 connects the Phase 50 `usePropertyClassification` hook to the Navigator UI, replacing hardcoded LATCH axes with dynamic buckets from the database. The codebase already has strong foundations: (1) `usePropertyClassification` hook with caching and refresh support, (2) react-dnd v16 for drag-and-drop, (3) `AccordionSection` component for expandable buckets, and (4) existing `AxisNavigator` showing the facet-to-plane mapping pattern.

The implementation requires refactoring `SimplePAFVNavigator` (inside Navigator.tsx) to consume `usePropertyClassification()` instead of the hardcoded `availableAxes` array. Each LATCH bucket becomes an expandable section showing individual facets. The GRAPH bucket adds edge types and computed metrics. Dragging a facet to a plane well updates PAFV state via the existing `setMapping()` function.

The existing architecture supports this cleanly. The main complexity is adapting the `ClassifiedProperty` interface from Phase 50 to work with react-dnd's `useDrag`/`useDrop` hooks, ensuring facet metadata (bucket, sourceColumn, facetType) propagates to the PAFV context for query generation.

**Primary recommendation:** Refactor `SimplePAFVNavigator` to consume `usePropertyClassification()`, wrap LATCH+GRAPH buckets in `AccordionSection` components, and adapt drag-and-drop to use `ClassifiedProperty` instead of raw strings.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2+ | UI framework | Already in use, hooks API required |
| react-dnd | 16.0.1 | Drag-and-drop | Already in use by PAFVNavigator, HTML5Backend |
| react-dnd-html5-backend | 16.0.1 | DnD backend | Standard browser DnD API |
| TypeScript | 5.x (strict) | Type safety | Project standard, no `any` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.294.0 | Icons | ChevronRight for accordion, bucket icons |
| tailwindcss | 3.3.5 | Styling | Theme-aware styling (NeXTSTEP/Modern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dnd | useDragDrop hook (custom) | Custom hook already exists in codebase, but react-dnd is more battle-tested for complex scenarios |
| AccordionSection | @radix-ui/react-accordion | AccordionSection already theme-aware, radix adds dependency |
| inline facet rendering | separate FacetChip component | Component extraction good for reuse, but inline simpler for initial integration |

**Installation:**
```bash
# All dependencies already present
npm install  # No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Navigator.tsx           # Main container, contains SimplePAFVNavigator
│   ├── PAFVNavigator.tsx       # Advanced DnD navigator (separate implementation)
│   └── ui/
│       └── AccordionSection.tsx # Existing expandable section component
├── hooks/
│   └── data/
│       └── usePropertyClassification.ts # Phase 50 hook (existing)
├── services/
│   └── property-classifier.ts  # Phase 50 service (existing)
└── types/
    └── pafv.ts                 # AxisMapping, Plane, LATCHAxis types
```

### Pattern 1: Classification-Driven Navigator
**What:** Navigator renders LATCH+GRAPH buckets from `usePropertyClassification()` output, not hardcoded arrays.
**When to use:** Any UI that displays available properties/facets for filtering or axis assignment.
**Example:**
```typescript
// Source: Phase 51 integration pattern
function SimplePAFVNavigator() {
  const { classification, isLoading, error, refresh } = usePropertyClassification();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!classification) return null;

  // Render LATCH buckets
  const buckets: Array<{ key: PropertyBucket; label: string; icon: ReactNode }> = [
    { key: 'L', label: 'Location', icon: <MapPin /> },
    { key: 'A', label: 'Alphabet', icon: <SortAsc /> },
    { key: 'T', label: 'Time', icon: <Clock /> },
    { key: 'C', label: 'Category', icon: <Tag /> },
    { key: 'H', label: 'Hierarchy', icon: <GitBranch /> },
    { key: 'GRAPH', label: 'Graph', icon: <Network /> },
  ];

  return (
    <div>
      {buckets.map(bucket => (
        <AccordionSection key={bucket.key} title={bucket.label} icon={bucket.icon}>
          {classification[bucket.key].map(property => (
            <DraggableFacet key={property.id} property={property} />
          ))}
        </AccordionSection>
      ))}
    </div>
  );
}
```

### Pattern 2: DraggableFacet with ClassifiedProperty
**What:** Wrap each facet in a draggable component that carries full property metadata.
**When to use:** When facet needs to be dragged to a plane well and metadata must survive the transfer.
**Example:**
```typescript
// Source: react-dnd documentation + existing PAFVNavigator pattern
interface DraggableFacetProps {
  property: ClassifiedProperty;
}

const FACET_ITEM_TYPE = 'FACET';

function DraggableFacet({ property }: DraggableFacetProps) {
  const [{ isDragging }, drag] = useDrag({
    type: FACET_ITEM_TYPE,
    item: () => ({
      id: property.id,
      name: property.name,
      bucket: property.bucket,
      sourceColumn: property.sourceColumn,
      facetType: property.facetType,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`facet-chip ${isDragging ? 'opacity-50' : ''}`}
      draggable
    >
      {property.name}
    </div>
  );
}
```

### Pattern 3: PlaneDropZone with Axis Update
**What:** Drop zone that receives facets and calls PAFV setMapping with appropriate AxisMapping.
**When to use:** When connecting drag-and-drop to PAFV state.
**Example:**
```typescript
// Source: existing PAFVNavigator + usePAFV hook
interface PlaneDropZoneProps {
  plane: Plane;
  currentMapping: AxisMapping | null;
}

function PlaneDropZone({ plane, currentMapping }: PlaneDropZoneProps) {
  const { setMapping, removeMapping } = usePAFV();

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: FACET_ITEM_TYPE,
    drop: (item: DraggedFacetItem) => {
      // Map property bucket to LATCHAxis
      const axisMap: Record<LATCHBucket, LATCHAxis> = {
        L: 'location',
        A: 'alphabet',
        T: 'time',
        C: 'category',
        H: 'hierarchy',
      };

      const axis = item.bucket === 'GRAPH'
        ? 'category'  // GRAPH properties map to category axis by default
        : axisMap[item.bucket as LATCHBucket];

      setMapping({
        plane,
        axis,
        facet: item.sourceColumn || item.id,
      });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div ref={drop} className={`plane-well ${isOver && canDrop ? 'highlight' : ''}`}>
      {currentMapping ? (
        <MappedAxis mapping={currentMapping} onRemove={() => removeMapping(plane)} />
      ) : (
        <span>Drop facet here</span>
      )}
    </div>
  );
}
```

### Pattern 4: Bucket Icons with Lucide
**What:** Use lucide-react icons consistently for LATCH+GRAPH bucket visual indicators.
**When to use:** Bucket headers in Navigator accordion sections.
**Example:**
```typescript
// Source: lucide-react documentation + existing AXIS_CONFIG pattern
import { MapPin, SortAsc, Clock, Tag, GitBranch, Network } from 'lucide-react';

const BUCKET_ICONS: Record<PropertyBucket, React.FC<{ className?: string }>> = {
  L: MapPin,
  A: SortAsc,
  T: Clock,
  C: Tag,
  H: GitBranch,
  GRAPH: Network,
};

const BUCKET_LABELS: Record<PropertyBucket, string> = {
  L: 'Location',
  A: 'Alphabet',
  T: 'Time',
  C: 'Category',
  H: 'Hierarchy',
  GRAPH: 'Graph',
};
```

### Anti-Patterns to Avoid
- **Hardcoded axis arrays:** The current `availableAxes` array bypasses the facets table. Always use `usePropertyClassification()`.
- **Ignoring property metadata in drag:** Just passing `property.id` loses bucket/sourceColumn info needed for query generation.
- **Mixing LATCHBucket ('L') with LATCHAxis ('location'):** The classifier uses single letters; PAFV uses full names. Map explicitly.
- **Direct db.exec in component:** Always use the hook, never call `classifyProperties()` directly from Navigator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion UI | Custom expand/collapse state | AccordionSection component | Already theme-aware, tested |
| Drag-and-drop | HTML5 DnD API directly | react-dnd hooks | react-dnd handles edge cases (drag preview, drop zones, nested) |
| Property classification | Manual facets query | usePropertyClassification() | Phase 50 provides caching, refresh, error handling |
| Bucket-to-axis mapping | Inline switch statements | BUCKET_TO_AXIS constant map | Single source of truth, easier to maintain |

**Key insight:** Phase 50 and existing UI components provide all building blocks. Phase 51 is integration, not new implementation.

## Common Pitfalls

### Pitfall 1: LATCH Bucket vs Axis Type Mismatch
**What goes wrong:** `classification.T` returns `LATCHBucket = 'T'` but `setMapping()` expects `LATCHAxis = 'time'`. Drop silently fails or creates invalid mapping.
**Why it happens:** Phase 50 uses single-letter buckets (database convention); PAFV uses full axis names (UI convention).
**How to avoid:** Create explicit mapping constant and use it in drop handler.
**Warning signs:** Dropped facets don't appear in plane wells; PAFV mappings array is empty or has `undefined` axis.

```typescript
// Explicit mapping
const BUCKET_TO_AXIS: Record<LATCHBucket, LATCHAxis> = {
  L: 'location',
  A: 'alphabet',
  T: 'time',
  C: 'category',
  H: 'hierarchy',
};
```

### Pitfall 2: GRAPH Bucket Handling
**What goes wrong:** GRAPH properties (edge types, metrics) don't map cleanly to LATCH axes. Dropping "LINK" edge type on a plane well causes confusion.
**Why it happens:** GRAPH is not a spatial axis like LATCH; it represents relationships.
**How to avoid:** Either (a) disable dragging for GRAPH properties, or (b) map GRAPH to a special "relationship" facet that colors/sizes by edge count.
**Warning signs:** User drops "Degree" metric on X-axis but grid doesn't know how to interpret it.

**Recommendation:** For Phase 51 MVP, make GRAPH bucket visible but facets non-draggable. Add "Coming soon" tooltip. Full GRAPH support in future phase.

### Pitfall 3: Missing DndProvider
**What goes wrong:** `useDrag` and `useDrop` throw "Cannot call useDrag outside of a DndProvider" error.
**Why it happens:** Navigator mounts before or outside the DndProvider wrapper.
**How to avoid:** Ensure DndProvider wraps the entire Navigator component tree, not just one sub-component.
**Warning signs:** React error boundary triggers, console error about missing context.

```typescript
// Pattern: Wrap at the top of the Navigator tree
export function Navigator() {
  return (
    <DndProvider backend={HTML5Backend}>
      <NavigatorContent />
    </DndProvider>
  );
}
```

### Pitfall 4: Stale Classification After Facet Changes
**What goes wrong:** User adds a facet via settings; Navigator doesn't show it.
**Why it happens:** `usePropertyClassification()` cache not invalidated.
**How to avoid:** Call `refresh()` after any operation that modifies facets table.
**Warning signs:** New facets don't appear; disabled facets still show.

```typescript
// Pattern: Expose refresh to parent
const { classification, refresh } = usePropertyClassification();

// After facet CRUD operation
await addFacet(newFacet);
refresh();  // Force re-classification
```

### Pitfall 5: Accessibility Missing on Draggable Elements
**What goes wrong:** Screen readers can't interact with facet chips; keyboard users can't drag.
**Why it happens:** Relying solely on mouse-based drag-and-drop.
**How to avoid:** Add ARIA attributes, keyboard handlers for arrow keys, and focus management.
**Warning signs:** Lighthouse accessibility audit fails; keyboard-only users can't use Navigator.

**Recommendation:** Phase 51 focuses on mouse DnD. Track accessibility as future requirement.

## Code Examples

Verified patterns from existing implementation:

### Consuming usePropertyClassification
```typescript
// Source: /src/hooks/data/usePropertyClassification.ts (existing API)
const { classification, isLoading, error, refresh } = usePropertyClassification();

// classification.L - Location facets
// classification.A - Alphabet facets
// classification.T - Time facets (created, modified, due)
// classification.C - Category facets (folder, tags, status)
// classification.H - Hierarchy facets (priority)
// classification.GRAPH - Edge types + metrics (6 items)
```

### AccordionSection Usage
```typescript
// Source: /src/components/ui/AccordionSection.tsx (existing component)
<AccordionSection
  title="Time"
  icon={<Clock className="w-4 h-4" />}
  badge={<span className="text-xs text-gray-500">{classification.T.length}</span>}
  defaultExpanded={true}
>
  {classification.T.map(prop => (
    <DraggableFacet key={prop.id} property={prop} />
  ))}
</AccordionSection>
```

### react-dnd DraggableChip Pattern
```typescript
// Source: /src/components/PAFVNavigator.tsx (existing pattern lines 18-60)
const [{ isDragging }, drag] = useDrag({
  type: ItemType,
  item: { well, index, chip },
  collect: (monitor) => ({ isDragging: monitor.isDragging() }),
});

const [, drop] = useDrop({
  accept: ItemType,
  hover: (item: { well: keyof Wells; index: number }) => {
    if (item.well !== well || item.index !== index) {
      moveChip(item.well as keyof Wells, item.index, well, index);
      item.well = well;
      item.index = index;
    }
  },
});
```

### PAFV setMapping Signature
```typescript
// Source: /src/state/PAFVContext.tsx (existing API)
interface AxisMapping {
  plane: Plane;      // 'x' | 'y' | 'color' | 'size' | 'shape'
  axis: LATCHAxis;   // 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy'
  facet: string;     // e.g., 'created_at', 'folder', 'priority'
}

setMapping({ plane: 'x', axis: 'time', facet: 'created_at' });
```

### ClassifiedProperty Interface
```typescript
// Source: /src/services/property-classifier.ts (existing type)
export interface ClassifiedProperty {
  id: string;              // 'created', 'folder', 'edge_type_LINK'
  name: string;            // 'Created', 'Folder', 'LINK'
  bucket: PropertyBucket;  // 'L' | 'A' | 'T' | 'C' | 'H' | 'GRAPH'
  sourceColumn: string;    // 'created_at', 'folder', 'edge_type'
  facetType: string;       // 'date', 'select', 'edge_type'
  enabled: boolean;        // true
  sortOrder: number;       // 0, 1, 2...
  isEdgeProperty: boolean; // false for LATCH, true for GRAPH edge types
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded LATCH_AXES array | usePropertyClassification from facets table | Phase 51 (now) | Dynamic property discovery |
| Manual axis chips | AccordionSection with facets | Phase 51 (now) | Hierarchical facet organization |
| String-based drag items | Typed ClassifiedProperty drag | Phase 51 (now) | Full metadata preserved in DnD |
| Single axis level | Bucket > Facet two-level hierarchy | Phase 51 (now) | Time > created, modified, due |

**Deprecated/outdated:**
- `availableAxes` constant in SimplePAFVNavigator - replaced by classification buckets
- `AXIS_CONFIG` record in AxisNavigator - replaced by ClassifiedProperty metadata
- `FACET_OPTIONS` hardcoded record - replaced by facets from database

## Open Questions

1. **How should GRAPH properties be handled in axis mapping?**
   - What we know: GRAPH bucket contains edge types (LINK, NEST, SEQUENCE, AFFINITY) and metrics (Degree, Weight)
   - What's unclear: Should these be draggable? If yes, what axis do they map to?
   - Recommendation: Make GRAPH visible but non-draggable in Phase 51 MVP. Add "Coming soon" indicator.

2. **Should empty buckets be shown?**
   - What we know: If user disables all Time facets, classification.T is empty array
   - What's unclear: Hide empty accordion sections or show "(No facets enabled)" message?
   - Recommendation: Show empty sections with message "No enabled facets" + link to settings

3. **How to handle facet selection within bucket (e.g., which Time facet to use)?**
   - What we know: Current AxisNavigator has facet dropdown after axis is assigned to plane
   - What's unclear: Do we need facet dropdown, or is drag-specific-facet sufficient?
   - Recommendation: Dragging a specific facet (e.g., "Created") is clearer than drag bucket + select facet. Remove dropdown pattern.

4. **Should Navigator support both chip-based wells and bucket-based navigation?**
   - What we know: PAFVNavigator uses chip-based wells (Available, Rows, Columns, Layers); SimplePAFVNavigator uses axis buttons
   - What's unclear: Are these complementary or should they merge?
   - Recommendation: Phase 51 focuses on SimplePAFVNavigator refactoring. PAFVNavigator chip wells remain separate.

## Sources

### Primary (HIGH confidence)
- Existing implementation: /src/hooks/data/usePropertyClassification.ts - React hook with caching
- Existing implementation: /src/services/property-classifier.ts - Classification service
- Existing implementation: /src/components/PAFVNavigator.tsx - react-dnd patterns
- Existing implementation: /src/components/ui/AccordionSection.tsx - Theme-aware accordion
- Existing implementation: /src/state/PAFVContext.tsx - PAFV state management
- Existing implementation: /src/types/pafv.ts - AxisMapping, LATCHAxis, Plane types
- Package.json: react-dnd 16.0.1, react-dnd-html5-backend 16.0.1 installed

### Secondary (MEDIUM confidence)
- [react-dnd documentation](https://react-dnd.github.io/react-dnd/docs/overview) - Official DnD patterns
- Phase 50 RESEARCH.md - Classification architecture decisions
- Existing tests: /src/components/Navigator.test.tsx - Test patterns

### Tertiary (LOW confidence)
- N/A - all critical information verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in use, verified from package.json
- Architecture: HIGH - patterns extracted from existing working code
- Pitfalls: HIGH - identified from type mismatches between existing code
- Code examples: HIGH - all examples from verified working code in repository

**Research date:** 2026-02-10
**Valid until:** 30 days (stable domain, internal integration, no ecosystem churn expected)

**Implementation readiness:** All building blocks exist. Phase 51 is pure integration of existing components.
