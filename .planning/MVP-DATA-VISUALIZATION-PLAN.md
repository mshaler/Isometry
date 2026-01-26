# GSD Plan: MVP Data Visualization

## Goal
Get basic data visualization working in Isometry to prove core PAFV + LATCH concepts work.

## Current State Analysis
- ❌ App crashes due to complex database provider dependencies
- ❌ Native API integration is incomplete and blocking
- ✅ Canvas component exists and can consume data
- ✅ GridView component exists with PAFV integration
- ✅ Mock data created with proper Node interface

## Gap to MVP Success
1. **Immediate blocker**: Remove database dependencies that are causing crashes
2. **Core need**: Show Canvas rendering data from any source
3. **Proof of concept**: Demonstrate PAFV axis mapping works
4. **Basic filtering**: Show LATCH filtering concept works

## Execution Plan

### Phase 1: Get App Loading (CRITICAL)
- [✅] Create minimal MVPDemo component bypassing complex providers
- [✅] Use mock data instead of database
- [ ] Verify app loads without errors
- [ ] See Canvas with mock data rendered

### Phase 2: Prove Data Visualization Works
- [ ] Verify GridView displays mock nodes in table format
- [ ] Test PAFV axis mapping (drag chips to change grouping)
- [ ] Confirm node clicking works
- [ ] Take screenshot showing working visualization

### Phase 3: Basic Filtering
- [ ] Add simple filter toggle (e.g., "Show High Priority Only")
- [ ] Filter mock data based on toggle
- [ ] Show Canvas updates when filter changes
- [ ] Prove LATCH concept works

### Phase 4: Documentation
- [ ] Document what works
- [ ] List what's missing for full implementation
- [ ] Create plan for re-enabling database integration

## Success Criteria
- ✅ App loads without crashes
- ✅ Canvas shows data in GridView
- ✅ PAFV axis mapping works (drag & drop)
- ✅ Basic filtering changes what's displayed
- ✅ Can click nodes and see selection

## Next Steps After MVP
1. Fix database provider architecture
2. Replace mock data with real database
3. Add remaining view types (List, Network, etc.)
4. Implement full LATCH DSL compiler