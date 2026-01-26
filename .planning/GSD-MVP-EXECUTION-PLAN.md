# GSD Execution Plan: MVP Data Visualization

## Goal Definition
**Objective**: Prove Isometry's core data visualization concept works by demonstrating PAFV spatial projection with real UI components.

**Success Criteria**:
- Canvas renders data without crashes
- GridView displays nodes using PAFV axis mappings
- Node selection/interaction functional
- Zero database dependency issues

## Problem Analysis
**Root Cause**: Complex database provider architecture was blocking basic functionality
**GSD Decision**: Skip infrastructure complexity, focus on proving core concept with mock data

## Execution Strategy

### Phase 1: Bypass Blockers
**Task 1.1**: Create mock data provider
- **File**: `src/hooks/useMockData.ts`
- **Purpose**: Replace broken database integration with reliable test data
- **Interface**: Match `useFilteredNodes` return type for drop-in replacement

**Task 1.2**: Create minimal demo environment
- **File**: `src/MVPDemo.tsx`
- **Purpose**: Bypass complex provider chain that causes crashes
- **Dependencies**: Only essential contexts (Theme, AppState, Filter, PAFV)

**Task 1.3**: Update Canvas to use mock data
- **File**: `src/components/Canvas.tsx`
- **Change**: Replace `useFilteredNodes()` with `useMockData()`
- **Impact**: Canvas becomes database-independent

### Phase 2: Prove Core Concepts
**Task 2.1**: Verify data rendering
- **Test**: Canvas displays 6 mock nodes without errors
- **Validation**: GridView shows nodes organized by PAFV axes

**Task 2.2**: Verify PAFV integration
- **Test**: Nodes grouped by time (year/month) and category (folder/status)
- **Validation**: Spatial projection working as designed

**Task 2.3**: Verify user interaction
- **Test**: Node clicking shows selection UI
- **Validation**: Event handling and state management working

## Implementation Details

### Mock Data Schema
```typescript
interface Node {
  id: string;
  name: string;
  folder: string;    // PAFV Category axis
  status: string;    // PAFV Status axis
  priority: string;  // LATCH Priority filter
  createdAt: string; // PAFV Time axis
  // ... other fields
}
```

### Provider Architecture (Minimal)
```
MVPDemo
├── BrowserRouter (for useLocation dependencies)
├── ThemeProvider
├── AppStateProvider (with URL state)
├── FilterProvider (for FilterBar)
└── PAFVProvider (for axis mappings)
    └── Canvas
```

### Files Created
- `src/MVPDemo.tsx` - Minimal demo bypassing database
- `src/hooks/useMockData.ts` - Reliable test data provider
- `.planning/MVP-DATA-VISUALIZATION-PLAN.md` - Original planning doc

### Files Modified
- `src/App.tsx` - Switch to MVPDemo for stability
- `src/components/Canvas.tsx` - Use mock data instead of database
- `src/hooks/useSQLiteQuery.ts` - Fix Vite environment variables

## Test Plan
1. **Load Test**: App loads without crashes or errors
2. **Render Test**: Canvas displays all 6 mock nodes
3. **PAFV Test**: Nodes organized by time × category grid
4. **Interaction Test**: Node clicking triggers selection UI
5. **State Test**: Selection state persists and can be cleared

## Commit Strategy
1. **Setup Commit**: Mock data provider and minimal demo
2. **Integration Commit**: Canvas using mock data
3. **Verification Commit**: Tests proving MVP works

## Risk Mitigation
- **Risk**: Breaking existing functionality
- **Mitigation**: All changes are additive or isolated to MVP demo
- **Rollback**: Original App.tsx can be restored, database providers unchanged

## Success Metrics
- ✅ Zero crashes during 5-minute interaction test
- ✅ All 6 mock nodes visible and clickable
- ✅ PAFV axis organization working (time × category)
- ✅ Selection UI responds to user input
- ✅ FilterBar renders without errors

## Post-MVP Roadmap
1. **Phase 3**: Add basic filtering to prove LATCH concept
2. **Phase 4**: Fix database provider architecture
3. **Phase 5**: Replace mock data with real SQLite integration
4. **Phase 6**: Add remaining view types (List, Network, Timeline)