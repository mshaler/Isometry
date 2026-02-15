# Phase 101: UI Integration - Research

**Researched:** 2026-02-15
**Domain:** React UI component refactoring with TanStack Query integration
**Confidence:** HIGH

## Summary

Phase 101 refactors UI components to replace hardcoded LATCH filter values with dynamic discovery queries implemented in Phase 100. The primary targets are `CardDetailModal.tsx` (folder/status dropdowns with hardcoded options) and `LATCHFilter.tsx` (hardcoded priority range [1, 10]). A secondary target is `property-classifier.ts` which has hardcoded numeric defaults.

Phase 100 delivered production-ready hooks (`useFacetValues`, `useSetting`) and services (`facet-discovery.ts`, `settings.ts`) with TanStack Query caching, 5-minute staleTime for discovery, and json_valid() guards for multi-select facets. All infrastructure is tested and operational.

The refactoring follows a straightforward pattern: replace hardcoded arrays/constants with hook calls, add loading/error states, display discovered values in dropdowns, and handle empty states gracefully. No new patterns or libraries are required—this is pure integration work using established codebase patterns.

**Primary recommendation:** Use Phase 100 hooks directly in components, follow existing TanStack Query patterns in the codebase, add simple empty state handling, and write integration tests to verify dropdowns populate from actual database queries.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI component framework | Project foundation, functional components with hooks |
| TypeScript | 5.x | Type safety | Strict mode enabled, no `any` allowed |
| TanStack Query | ^5.90.20 | Server state management and caching | Already used extensively (15+ hook files), replaces Redux/Zustand |
| sql.js | Latest | SQLite WASM for browser | Phase 100 foundation, synchronous queries wrapped in async queryFn |
| Vite | Latest | Build tool and dev server | Fast HMR, project build system |
| Vitest | Latest | Testing framework | Project test runner, Jest-compatible API |

### Supporting (Already Available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | N/A (components copied) | Unstyled UI primitives | When native `<select>` needs enhancement (optional for Phase 101) |
| Tailwind CSS | Latest | Utility-first styling | All component styling in project |
| React Testing Library | Latest | Component testing | Testing hook integration and UI behavior |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query hooks | Direct db.exec() calls | Lose caching, loading states, error handling—**not recommended** |
| Native `<select>` | shadcn Select component | More features (search, multi-select) but higher complexity—**defer to polish phase** |
| Inline hardcoded defaults | Settings table fallbacks | Settings add indirection—**only when user preferences needed** |

**Installation:**
No new dependencies required. All necessary libraries already installed.

## Architecture Patterns

### Recommended Project Structure

Phase 101 modifies existing files—no new directories needed:

```
src/
├── components/
│   ├── CardDetailModal.tsx      # Plan 101-01: Replace hardcoded folder/status options
│   └── LATCHFilter.tsx           # Plan 101-02: Replace hardcoded priority range
├── services/
│   └── property-classifier.ts    # Plan 101-02: Remove hardcoded numeric defaults
├── hooks/
│   ├── useFacetValues.ts         # Phase 100 deliverable (use as-is)
│   └── useSettings.ts            # Phase 100 deliverable (use as-is)
└── services/
    ├── facet-discovery.ts        # Phase 100 deliverable (use as-is)
    └── settings.ts               # Phase 100 deliverable (use as-is)
```

### Pattern 1: Using Discovery Hooks in Components

**What:** Replace hardcoded dropdown options with `useFacetValues()` hook calls.

**When to use:** Any component with hardcoded LATCH filter values (folder, status, tags, priority).

**Example:**
```typescript
// BEFORE (CardDetailModal.tsx lines 185-192)
<CardFormSelect
  label="Folder"
  options={[
    { value: '', label: 'No folder' },
    { value: 'work', label: 'Work' },
    { value: 'personal', label: 'Personal' },
    // ... more hardcoded options
  ]}
/>

// AFTER (Pattern from useFacetValues.ts + existing component patterns)
import { useFolderValues } from '@/hooks/useFacetValues';

function CardDetailModal({ card, isOpen, onClose }: CardDetailModalProps) {
  const { data: folderValues, isLoading: foldersLoading } = useFolderValues();

  const folderOptions = [
    { value: '', label: 'No folder' },
    ...(folderValues || []).map(v => ({ value: v.value, label: v.value }))
  ];

  return (
    <CardFormSelect
      label="Folder"
      options={folderOptions}
      isLoading={foldersLoading}
    />
  );
}
```

**Source:** Phase 100 deliverable `src/hooks/useFacetValues.ts` lines 44-52 (convenience hooks), combined with existing component patterns.

### Pattern 2: Status Colors from Settings

**What:** Replace hardcoded status→color mapping with settings lookup.

**When to use:** When UI needs user-configurable colors for status badges/indicators.

**Example:**
```typescript
// BEFORE (CardDetailModal.tsx lines 436-444)
const getStatusColor = (status?: string) => {
  switch (status) {
    case 'active': return '#10b981';
    case 'completed': return '#6b7280';
    // ... more hardcoded colors
  }
};

// AFTER (Pattern from useSettings.ts)
import { useSetting } from '@/hooks/useSettings';

function CardStatusField({ status }: Props) {
  const [statusColors] = useSetting<Record<string, string>>('status_colors', {});

  const getStatusColor = (status?: string) => {
    return statusColors[status || ''] || '#9ca3af'; // neutral gray default
  };

  // ... rest of component
}
```

**Source:** Phase 100 deliverable `src/hooks/useSettings.ts` lines 30-78 (useSetting hook with type parameter).

**Note:** For MVP, neutral gray default is acceptable. Color customization can be Phase 102+ enhancement.

### Pattern 3: Empty State Handling

**What:** Display helpful messages when discovery queries return no values.

**When to use:** Required by UI-05 (empty states when no values discovered).

**Example:**
```typescript
// Pattern combining TanStack Query states with UI feedback
function FolderDropdown() {
  const { data: folders, isLoading, error } = useFolderValues();

  if (isLoading) {
    return <div>Loading folders...</div>;
  }

  if (error) {
    return <div>Error loading folders: {error.message}</div>;
  }

  if (!folders || folders.length === 0) {
    return (
      <div className="text-gray-500 italic">
        No folders found. Create a card with a folder to see options here.
      </div>
    );
  }

  return <Select options={folders} />;
}
```

**Source:** Standard TanStack Query pattern from React Query documentation and existing codebase patterns (e.g., `src/hooks/useGSDFileSync.ts` shows similar loading/error handling).

### Pattern 4: Numeric Range Discovery

**What:** Replace hardcoded priority range [1, 10] with data-driven or settings-based range.

**When to use:** UI-04 requirement (LATCHFilter priority range discovered from data).

**Example:**
```typescript
// BEFORE (LATCHFilter.tsx line 51)
const [priorityRange, setPriorityRange] = useState<[number, number]>([1, 10]);

// AFTER (Option 1: Discover from data)
import { useSQLiteQuery } from '@/hooks';

function LATCHFilter() {
  const { data: priorityStats } = useSQLiteQuery<{ min: number; max: number }>(
    'SELECT MIN(priority) as min, MAX(priority) as max FROM cards WHERE priority IS NOT NULL',
    []
  );

  const defaultRange: [number, number] = [
    priorityStats?.min ?? 1,
    priorityStats?.max ?? 10
  ];

  const [priorityRange, setPriorityRange] = useState(defaultRange);

  // ... rest of component
}

// AFTER (Option 2: Use settings with data fallback)
import { useSetting } from '@/hooks/useSettings';
import { useSQLiteQuery } from '@/hooks';

function LATCHFilter() {
  const [settingsRange] = useSetting<[number, number]>('priority_range', null);
  const { data: dataRange } = useSQLiteQuery(/* query above */);

  const defaultRange: [number, number] = settingsRange || [
    dataRange?.min ?? 1,
    dataRange?.max ?? 10
  ];

  // ... rest
}
```

**Source:** Combining `useSetting` pattern from Phase 100 with `useSQLiteQuery` pattern from existing hooks (e.g., `src/hooks/data/useFacetAggregates.ts`).

**Recommendation:** Option 1 (discover from data) for MVP. Option 2 (settings) for future user preference support.

### Pattern 5: Property Classifier Generic Numeric Handling

**What:** Remove hardcoded `numericColumnsWithDefaults` object, handle all numeric columns generically.

**When to use:** CLASSIFY-01, CLASSIFY-02, CLASSIFY-03 requirements.

**Example:**
```typescript
// BEFORE (property-classifier.ts lines 103-108)
const numericColumnsWithDefaults: Record<string, number> = {
  priority: 0,
  importance: 0,
  sort_order: 0,
};

if (sourceColumn in numericColumnsWithDefaults) {
  const defaultValue = numericColumnsWithDefaults[sourceColumn];
  // ... check for non-default values
}

// AFTER (Generic approach with graceful degradation)
function columnHasData(db: Database, sourceColumn: string): boolean {
  // Always-present columns bypass checks
  const alwaysPresentColumns = ['name', 'created_at', 'modified_at', 'folder', 'tags'];
  if (alwaysPresentColumns.includes(sourceColumn)) {
    return true;
  }

  try {
    // Try numeric check first (assumes 0 is common default)
    const numericResult = db.exec(`
      SELECT COUNT(DISTINCT ${sourceColumn}) as cnt FROM nodes
      WHERE ${sourceColumn} IS NOT NULL
        AND ${sourceColumn} != 0
        AND deleted_at IS NULL
    `);

    if (numericResult[0]?.values[0]?.[0] >= 2) {
      return true; // Has numeric variation
    }

    // Fall back to text check
    const textResult = db.exec(`
      SELECT COUNT(DISTINCT ${sourceColumn}) as cnt FROM nodes
      WHERE ${sourceColumn} IS NOT NULL
        AND TRIM(${sourceColumn}) != ''
        AND deleted_at IS NULL
    `);

    return (textResult[0]?.values[0]?.[0] ?? 0) >= 2;
  } catch (error) {
    // Column doesn't exist or wrong type - gracefully return false
    console.log(`[PropertyClassifier] columnHasData("${sourceColumn}"): false (${error})`);
    return false;
  }
}
```

**Source:** Refactored from existing `property-classifier.ts` lines 96-150. Pattern follows "try-catch for missing columns" approach already used in `discoverDynamicProperties()` (lines 162-195).

### Anti-Patterns to Avoid

- **Bypassing TanStack Query cache:** Don't call `db.exec()` directly in components—always use hooks with caching
- **Hardcoded fallback arrays:** Don't put "just in case" hardcoded values alongside discovery—trust empty state handling
- **Mixing loading states:** Don't show loading spinner for facet values while editing card—fade in options when ready
- **Assuming column existence:** Don't query columns without try-catch or schema checks—gracefully handle missing data
- **Over-engineering settings:** Don't create settings for every dropdown—reserve for actual user preferences

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Facet value caching | Custom useState + useEffect | TanStack Query (Phase 100 hooks) | Handles staleness, refetch on focus, GC, request deduplication automatically |
| Empty dropdown states | Custom "no options" detection | Standard React conditional rendering | Simple, readable, no magic |
| Status color lookup | Complex color derivation logic | Settings table with neutral default | Settings system already exists (Phase 100-01) |
| Priority range discovery | Custom aggregation hook | Direct `useSQLiteQuery` with MIN/MAX | One SQL query, no abstraction needed |
| Type-safe settings access | Generic get/set functions | `useSetting<T>` with TypeScript | Type inference, mutation handling, cache invalidation built-in |

**Key insight:** Phase 100 already built the hard parts (caching, staleness, JSON serialization). Phase 101 is pure integration—don't rebuild what exists.

## Common Pitfalls

### Pitfall 1: Forgetting Loading States in Dropdowns

**What goes wrong:** Dropdowns flash empty/blank while facet values load from database.

**Why it happens:** Discovery queries are async (wrapped sql.js), but components render immediately.

**How to avoid:**
- Always destructure `isLoading` from TanStack Query hooks
- Show loading indicator or disable select during `isLoading`
- Don't rely on stale cache for critical UI (use `enabled` flag if needed)

**Warning signs:**
- Dropdown appears empty on first render then pops in options
- User can interact with dropdown before data loads
- Tests fail intermittently on first load

**Example fix:**
```typescript
const { data: folders, isLoading } = useFolderValues();

<select disabled={isLoading}>
  {isLoading ? <option>Loading...</option> : folders.map(/* ... */)}
</select>
```

### Pitfall 2: Not Handling Empty Discovery Results

**What goes wrong:** UI shows empty dropdowns with no explanation when database has no values for a facet.

**Why it happens:** Discovery queries return `[]` for facets with no data—this is correct behavior but needs UI handling.

**How to avoid:**
- Check `data?.length === 0` explicitly
- Provide helpful empty state message explaining why (e.g., "No folders yet—create a card with a folder")
- Distinguish between loading (`isLoading`), error (`error`), and legitimately empty (`data?.length === 0`)

**Warning signs:**
- Dropdowns show only "No selection" option with no context
- Users don't understand why dropdowns are empty
- Empty states look like loading errors

### Pitfall 3: Hardcoded Defaults as "Fallback Safety"

**What goes wrong:** Developer adds hardcoded array "just in case" discovery fails, creating dual source of truth.

**Why it happens:** Lack of trust in Phase 100 infrastructure or fear of empty states.

**How to avoid:**
- Trust the discovery system—it's tested and operational
- Use neutral defaults (e.g., `[]` for options, `'#9ca3af'` for unknown status) not hardcoded lists
- If discovery truly fails, handle via error state, not silent fallback

**Warning signs:**
- Code has both `useFolderValues()` AND hardcoded folder array
- Comments like "// Backup in case query fails"
- Discovery queries never noticed to be broken because fallback hides the issue

### Pitfall 4: Breaking Existing TypeScript Interfaces

**What goes wrong:** Adding `isLoading` prop to component breaks existing usages without the prop.

**Why it happens:** Component interfaces changed without checking all call sites.

**How to avoid:**
- Make new props optional with defaults: `isLoading?: boolean`
- Run `npm run typecheck` after interface changes
- Search for all component usages before changing required props

**Warning signs:**
- TypeScript errors in unrelated files after component changes
- Pre-commit hook fails on typecheck
- Components render but with missing props warnings

### Pitfall 5: Querying on Every Render

**What goes wrong:** Discovery queries run repeatedly, slowing UI and hitting database unnecessarily.

**Why it happens:** Using `db.exec()` directly instead of TanStack Query hooks with caching.

**How to avoid:**
- ALWAYS use `useFacetValues()`, `useSetting()`, or `useSQLiteQuery()` hooks
- Never call `db.exec()` inside component render functions
- Rely on TanStack Query's built-in caching (5-minute staleTime for discovery)

**Warning signs:**
- Console logs show repeated SQL queries for same data
- Dropdown opening triggers new database queries
- Performance degrades with multiple dropdowns on screen

## Code Examples

Verified patterns from Phase 100 deliverables and existing codebase:

### Example 1: CardDetailModal Folder Dropdown Integration

```typescript
// File: src/components/CardDetailModal.tsx
// Replace lines 177-193 (hardcoded folder options)

import { useFolderValues } from '@/hooks/useFacetValues';

function CardDetailModal({ card, isOpen, onClose, onSave }: CardDetailModalProps) {
  // ... existing state hooks ...

  // NEW: Discover folder values from database
  const { data: folderValues, isLoading: foldersLoading } = useFolderValues();

  // Transform discovery results to dropdown format
  const folderOptions = [
    { value: '', label: 'No folder' },
    ...(folderValues || []).map(fv => ({
      value: fv.value,
      label: fv.value
    }))
  ];

  return (
    <div className="modal">
      {/* ... header ... */}

      <CardFormSelect
        label="Folder"
        editMode={editMode}
        isLoading={isLoading || foldersLoading}  // Combine loading states
        editValue={editedCard.folder || ''}
        displayValue={card.folder || 'No folder'}
        onEdit={(value: string) => setEditedCard(prev => ({ ...prev, folder: value || undefined }))}
        options={folderOptions}
      />

      {/* Empty state hint (optional enhancement) */}
      {!foldersLoading && folderValues?.length === 0 && (
        <p className="text-xs text-gray-500 mt-1">
          No folders found. Type a folder name to create one.
        </p>
      )}
    </div>
  );
}
```

**Source:** Combining `useFolderValues` hook (Phase 100, `src/hooks/useFacetValues.ts` lines 50-52) with existing `CardFormSelect` component pattern (lines 385-418).

### Example 2: Status Dropdown with Dynamic Values and Colors

```typescript
// File: src/components/CardDetailModal.tsx
// Replace lines 421-444 (CardStatusField with hardcoded values)

import { useStatusValues } from '@/hooks/useFacetValues';
import { useSetting } from '@/hooks/useSettings';

function CardStatusField({ editMode, isLoading, editValue, displayValue, onEdit }: CardStatusFieldProps) {
  // Discover status values from actual data
  const { data: statusValues, isLoading: statusLoading } = useStatusValues();

  // Get user-configured status colors (or use neutral default)
  const [statusColors] = useSetting<Record<string, string>>('status_colors', {});

  const statusOptions = [
    { value: '', label: 'No status' },
    ...(statusValues || []).map(sv => ({
      value: sv.value,
      label: sv.value
    }))
  ];

  const getStatusColor = (status?: string) => {
    if (!status) return '#9ca3af'; // neutral gray
    return statusColors[status] || '#9ca3af'; // neutral default for unknown
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Status
      </label>
      {editMode ? (
        <select
          value={editValue}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
          disabled={isLoading || statusLoading}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getStatusColor(displayValue) }}
          />
          <span className="text-gray-900">
            {displayValue || 'No status'}
          </span>
        </div>
      )}
    </div>
  );
}
```

**Source:** Combining `useStatusValues` (Phase 100, `src/hooks/useFacetValues.ts` lines 60-62) with `useSetting` (Phase 100, `src/hooks/useSettings.ts` lines 30-78).

### Example 3: LATCHFilter Priority Range Discovery

```typescript
// File: src/components/LATCHFilter.tsx
// Replace lines 51 and 239-284 (hardcoded priority range [1, 10])

import { useSQLiteQuery } from '@/hooks';

function LATCHFilter({ axis, label, description }: LATCHFilterProps) {
  // Discover actual priority range from data
  const { data: priorityStats } = useSQLiteQuery<{ min: number; max: number }>(
    `SELECT
       COALESCE(MIN(priority), 1) as min,
       COALESCE(MAX(priority), 10) as max
     FROM cards
     WHERE priority IS NOT NULL AND deleted_at IS NULL`,
    [],
    { enabled: axis === 'hierarchy' } // Only query when hierarchy filter active
  );

  // Use discovered range or sensible defaults
  const discoveredRange: [number, number] = [
    priorityStats?.min ?? 1,
    priorityStats?.max ?? 10
  ];

  const [priorityRange, setPriorityRange] = useState<[number, number]>(discoveredRange);

  // ... rest of component unchanged ...

  return (
    <HierarchyTreeView
      tree={tree}
      selectedIds={/* ... */}
      priorityRange={priorityRange}
      onPriorityRangeChange={(range) => {
        setPriorityRange(range);
        // ... update filter logic unchanged ...
      }}
    />
  );
}
```

**Source:** Pattern from existing `useSQLiteQuery` usage (e.g., `src/hooks/data/useFacetAggregates.ts` lines 55-70) combined with SQL aggregate functions.

### Example 4: Property Classifier Generic Numeric Handling

```typescript
// File: src/services/property-classifier.ts
// Replace lines 96-150 (columnHasData with hardcoded numericColumnsWithDefaults)

function columnHasData(db: Database, sourceColumn: string): boolean {
  // Skip columns that are always present and useful
  const alwaysPresentColumns = ['name', 'created_at', 'modified_at', 'folder', 'tags'];
  if (alwaysPresentColumns.includes(sourceColumn)) {
    return true;
  }

  try {
    // Generic approach: check for meaningful variation in ANY column
    // Try numeric check first (most numeric columns default to 0)
    const numericSql = `
      SELECT COUNT(DISTINCT ${sourceColumn}) as cnt FROM nodes
      WHERE ${sourceColumn} IS NOT NULL
        AND ${sourceColumn} != 0
        AND deleted_at IS NULL
    `;
    const numericResult = db.exec(numericSql);
    const numericCount = numericResult.length > 0 && numericResult[0].values.length > 0
      ? Number(numericResult[0].values[0][0])
      : 0;

    if (numericCount >= 2) {
      console.log(`[PropertyClassifier] columnHasData("${sourceColumn}"): true (${numericCount} distinct numeric values)`);
      return true;
    }

    // Fall back to text check (handles both text and numeric as strings)
    const textSql = `
      SELECT COUNT(DISTINCT ${sourceColumn}) as cnt FROM nodes
      WHERE ${sourceColumn} IS NOT NULL
        AND TRIM(CAST(${sourceColumn} AS TEXT)) != ''
        AND deleted_at IS NULL
    `;
    const textResult = db.exec(textSql);
    const textCount = textResult.length > 0 && textResult[0].values.length > 0
      ? Number(textResult[0].values[0][0])
      : 0;

    const hasData = textCount >= 2;
    console.log(`[PropertyClassifier] columnHasData("${sourceColumn}"): ${hasData} (${textCount} distinct values)`);
    return hasData;
  } catch (error) {
    // Column doesn't exist, wrong type, or other SQL error
    // This is NORMAL for schema-on-read—gracefully return false
    console.log(`[PropertyClassifier] columnHasData("${sourceColumn}"): false (error: ${error})`);
    return false;
  }
}
```

**Source:** Refactored from existing implementation (`src/services/property-classifier.ts` lines 96-150) following "try-catch for missing columns" pattern already used in `discoverDynamicProperties()` (lines 159-195).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded dropdown options | Discovery queries with TanStack Query | Phase 100-02 (2026-02-15) | Dropdowns reflect actual data, no schema assumptions |
| Switch-case color mapping | Settings table with neutral defaults | Phase 100-01 (2026-02-15) | User-configurable colors, graceful handling of unknown statuses |
| Assumed priority range [1, 10] | MIN/MAX query from actual data | Phase 101-02 (this phase) | Correct range for any dataset (Notes, Tasks, etc.) |
| Hardcoded numeric defaults dict | Generic try-catch for all columns | Phase 101-02 (this phase) | Handles any numeric column without code changes |

**Deprecated/outdated:**
- **Hardcoded `folderOptions` array**: Replaced by `useFolderValues()` hook (Phase 100-02)
- **Hardcoded `statusOptions` array**: Replaced by `useStatusValues()` hook (Phase 100-02)
- **Hardcoded `numericColumnsWithDefaults` object**: Replaced by generic numeric check (Phase 101-02)
- **`getStatusColor()` switch-case**: Replaced by settings lookup with neutral default (Phase 101-02)

## Open Questions

1. **Status color customization UI**
   - What we know: `useSetting<Record<string, string>>('status_colors', {})` works
   - What's unclear: Should Phase 101 build color picker UI or use neutral defaults?
   - Recommendation: **Use neutral gray default (`#9ca3af`) for MVP**. Defer color picker to Phase 102+ polish. Users can set colors via settings table manually if needed.

2. **Priority range: discover vs. configure**
   - What we know: Can discover MIN/MAX from data OR read from settings
   - What's unclear: Which approach for MVP?
   - Recommendation: **Discover from data for MVP** (simpler, no settings seeding required). Add settings override in Phase 102+ if users need fixed ranges.

3. **Empty dropdown behavior**
   - What we know: Discovery returns `[]` for facets with no data
   - What's unclear: Should empty dropdowns allow text input to create new values?
   - Recommendation: **Phase 101 shows empty state message only**. Text input for new values is a Phase 102+ enhancement (requires create-on-type logic).

4. **Folder dropdown capitalization**
   - What we know: Database has `'work'`, `'personal'` (lowercase)
   - What's unclear: Should UI display as-is or capitalize for display?
   - Recommendation: **Display as-is for MVP** (avoid assumptions about formatting). Add title-case display in Phase 102+ if needed.

## Sources

### Primary (HIGH confidence)

- **Phase 100 deliverables** (executed 2026-02-15):
  - `src/hooks/useFacetValues.ts` - TanStack Query hooks for discovery
  - `src/hooks/useSettings.ts` - Type-safe settings access with caching
  - `src/services/facet-discovery.ts` - Discovery query builders and execution
  - `src/db/settings.ts` - SettingsService CRUD operations
  - `src/services/__tests__/facet-discovery.test.ts` - Comprehensive integration tests
  - `.planning/phases/100-settings-discovery/100-02-PLAN.md` - Implementation spec

- **Existing codebase patterns**:
  - `src/components/CardDetailModal.tsx` (lines 1-507) - Current implementation with hardcoded values
  - `src/components/LATCHFilter.tsx` (lines 1-299) - Hardcoded priority range [1, 10]
  - `src/services/property-classifier.ts` (lines 96-150) - Hardcoded numeric defaults
  - `src/hooks/data/useFacetAggregates.ts` - Example of `useSQLiteQuery` pattern
  - TanStack Query usage in 15+ hook files (standard codebase pattern)

- **Project configuration**:
  - `package.json` - Confirms TanStack Query ^5.90.20 installed
  - `CLAUDE.md` - Architecture constraints (React, TypeScript strict, TDD, no Redux/Zustand)
  - `.planning/REQUIREMENTS.md` (lines 24-36) - Phase 101 requirements UI-01 to UI-05, CLASSIFY-01 to CLASSIFY-03

### Secondary (MEDIUM confidence)

- **TanStack Query v5 patterns**: Official docs show `useQuery` with `queryKey`, `queryFn`, `staleTime`, `enabled` - matches Phase 100 implementation exactly
- **React Testing Library patterns**: Standard `render`, `waitFor`, `screen.getByRole` for testing hooks in components - matches existing test files

### Tertiary (LOW confidence)

None. All research based on existing Phase 100 deliverables and codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and operational in Phase 100
- Architecture: HIGH - Phase 100 deliverables are tested and working, patterns extracted from actual code
- Pitfalls: HIGH - Identified from common TanStack Query mistakes and existing codebase patterns
- Code examples: HIGH - Copied/adapted from Phase 100 deliverables and existing components

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable libraries and patterns, Phase 100 just shipped)

**Phase 100 prerequisites verified:**
- ✅ `useFacetValues`, `useFolderValues`, `useStatusValues`, `useTagValues` hooks operational
- ✅ `useSetting<T>`, `useAllSettings` hooks operational with type safety
- ✅ `discoverFacetValues`, `buildFacetDiscoveryQuery` tested with multi-select and json_valid guards
- ✅ `SettingsService` CRUD operations tested with JSON serialization
- ✅ 5-minute staleTime for discovery, Infinity for settings (per Phase 100 decisions)
- ✅ TanStack Query ^5.90.20 installed and used extensively in codebase

**Ready for planning:** Yes. All infrastructure exists, patterns documented, examples verified.
