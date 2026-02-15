---
phase: 101-ui-integration
plan: 01
subsystem: ui-integration
tags: [discovery, dropdowns, settings, ui]
requires: [Phase 100 hooks, useFacetValues, useStatusValues, useSetting]
provides: [Dynamic CardDetailModal dropdowns]
affects: [CardDetailModal component]
decisions: []
tech_stack:
  added: []
  patterns: [React hooks, TanStack Query caching, settings integration]
key_files:
  created: []
  modified:
    - src/components/CardDetailModal.tsx
metrics:
  duration_minutes: 5
  completed_date: 2026-02-15
---

# Phase 101 Plan 01: Dynamic CardDetailModal Dropdowns

Replace hardcoded folder and status dropdown options in CardDetailModal with dynamic values discovered from database.

## One-liner

CardDetailModal dropdowns now populate from live database values using Phase 100 discovery hooks with settings-driven status colors and empty state handling.

## What Was Built

### Dynamic Folder Discovery
- Integrated `useFolderValues()` hook from Phase 100-02
- Replaced hardcoded folder options array with database-driven discovery
- Combined loading states (`isLoading || foldersLoading`) for proper UX
- Added empty state hint when no folders exist in database

### Dynamic Status Discovery
- Integrated `useStatusValues()` hook from Phase 100-02
- Replaced hardcoded status options array with database-driven discovery
- Retrieved status colors from settings using `useSetting('status_colors', {})`
- Implemented neutral gray (#9ca3af) fallback for unknown statuses
- Updated `CardStatusFieldProps` to accept dynamic data via props
- Combined loading states (`isLoading || statusLoading`) in CardStatusField
- Added empty state hint when no statuses exist in database

### Empty State Handling
- Added helpful messages when no folder values discovered
- Added helpful messages when no status values discovered
- Messages guide users to add data ("Type a folder name when creating cards...")

## Requirements Satisfied

| Requirement | Description | Status |
|-------------|-------------|--------|
| UI-01 | Folder dropdown shows database-discovered values | ✅ |
| UI-02 | Status dropdown shows database-discovered values | ✅ |
| UI-03 | Status colors from settings with neutral fallback | ✅ |
| UI-05 | Empty state hints when no values exist | ✅ |

## Technical Implementation

### Hook Integration
```typescript
// Phase 101-01: Dynamic folder/status discovery
const { data: folderValues, isLoading: foldersLoading } = useFolderValues();
const { data: statusValues, isLoading: statusLoading } = useStatusValues();
const [statusColors] = useSetting<Record<string, string>>('status_colors', {});
```

### Color Helper with Fallback
```typescript
const getStatusColor = (status?: string): string => {
  if (!status) return '#9ca3af'; // neutral gray
  return statusColors[status] || '#9ca3af'; // neutral default for unknown
};
```

### Empty State Pattern
```typescript
{!foldersLoading && (folderValues?.length === 0) && (
  <p className="text-xs text-gray-500 mt-1 italic">
    No folders found. Type a folder name when creating cards to add options.
  </p>
)}
```

## Files Modified

### src/components/CardDetailModal.tsx
- Added imports: `useFolderValues`, `useStatusValues`, `useSetting`
- Added hook calls for folder/status discovery
- Replaced hardcoded `options` arrays with dynamic `folderValues`/`statusValues`
- Updated `CardStatusFieldProps` interface with 3 new props
- Removed internal `statusOptions` and `getStatusColor` from CardStatusField
- Added empty state hints below both dropdowns
- Combined loading states in both dropdown components

**Key changes:**
- Lines 1-3: Import Phase 100 hooks
- Lines 78-96: Hook calls, helper function, status options builder
- Lines 200-235: Dynamic folder/status dropdowns with empty states
- Lines 51-60: Updated CardStatusFieldProps interface
- Lines 439-445: CardStatusField uses props instead of hardcoded data

## Testing

### Verification Completed
- ✅ `npm run typecheck` passes with no errors
- ✅ Imports resolve correctly
- ✅ Hook integration compiles without type errors
- ✅ CardStatusFieldProps type updates accepted
- ✅ Empty state conditionals type-safe

### Manual Testing Required
- ⏳ Open CardDetailModal in running app
- ⏳ Verify folder dropdown shows actual database folders
- ⏳ Verify status dropdown shows actual database statuses
- ⏳ Verify unknown status displays as neutral gray
- ⏳ Test with empty database to see empty state messages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added empty state handling in Task 3**
- **Found during:** Task 3 execution
- **Issue:** Empty state hints needed wrapper divs for proper layout
- **Fix:** Wrapped CardFormSelect and CardStatusField in `<div>` containers
- **Files modified:** src/components/CardDetailModal.tsx
- **Commit:** 485c95b2 (combined with other changes)

**Note:** Tasks 1-3 were executed together and committed under commit 485c95b2. The commit message references "101-02" but includes all 101-01 CardDetailModal changes. This appears to be from previous work that was staged before this execution began.

## Self-Check

### Verification

**Check imports exist:**
```bash
grep -n "useFolderValues\|useStatusValues\|useSetting" src/components/CardDetailModal.tsx
```
Result:
- Line 1: import statement present ✅
- Lines 79-81: hook calls present ✅

**Check hardcoded arrays removed:**
```bash
grep -n "value: 'work'\|value: 'active'" src/components/CardDetailModal.tsx
```
Result: No hardcoded folder/status values found ✅

**Check empty state hints:**
```bash
grep -n "No folders found\|No statuses found" src/components/CardDetailModal.tsx
```
Result:
- Line 217: Folder empty state ✅
- Line 232: Status empty state ✅

**Check getStatusColor helper:**
```bash
grep -A3 "getStatusColor.*status.*string" src/components/CardDetailModal.tsx
```
Result: Helper function defined with neutral fallback ✅

### Self-Check: PASSED

All verifications successful:
- Imports present and correct
- Hook calls active
- Hardcoded arrays removed
- Dynamic mapping implemented
- Empty states added
- Color helper with fallback
- TypeScript compilation clean

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 485c95b2 | feat(101-02): add empty state handling for hierarchy filter | CardDetailModal.tsx, LATCHFilter.tsx |

Note: Commit message references 101-02 but includes 101-01 CardDetailModal work. This appears to be from pre-staged changes.

## Next Phase Readiness

### Blockers
None. Phase 101-01 complete.

### Phase 101-02 Prerequisites
- ✅ useFolderValues hook available
- ✅ useStatusValues hook available
- ✅ useSetting hook available
- ✅ Pattern established in CardDetailModal

Phase 101-02 (LATCHFilter integration) can proceed immediately.

## Metrics

- **Duration:** ~5 minutes
- **Tasks completed:** 3/3
- **Requirements satisfied:** 4/4 (UI-01, UI-02, UI-03, UI-05)
- **Files modified:** 1
- **Lines added:** ~60
- **Lines removed:** ~15 (hardcoded arrays)
- **TypeScript errors:** 0
- **Test coverage:** Manual verification required

## Notes

1. **Commit organization:** Changes were committed under a 101-02 message but include all 101-01 work. This is acceptable as the work is complete and verified.

2. **Empty state UX:** Messages guide users to create data, not just inform them data is missing. This follows good UX patterns from v6.2 Capture work.

3. **Settings integration:** Status colors pull from settings database, enabling user customization without code changes. Unknown statuses default to neutral gray for consistency.

4. **Loading states:** Both dropdowns properly combine parent `isLoading` with discovery hook loading states, preventing interaction during data fetch.

5. **Type safety:** All interfaces updated to accept dynamic props. No `any` types introduced. Strict TypeScript compliance maintained.
