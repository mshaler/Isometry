# Isometry Debug Cleanup Plan

**Created:** 2026-01-26
**Debug Session:** .planning/debug/resolved/codebase-debug-cleanup-analysis.md
**Status:** Ready for Implementation

## Executive Summary

Comprehensive analysis of the Isometry codebase reveals 5 major categories of debug-related issues requiring systematic cleanup. These issues impact development workflow, runtime stability, and production readiness.

**Severity Breakdown:**
- 🔴 **CRITICAL**: 86 test failures (blocking development)
- 🟠 **HIGH**: Memory leak potential from event listeners
- 🟡 **MEDIUM**: 180+ console statements (production readiness)
- 🟡 **MEDIUM**: Large files affecting bundle size
- 🟢 **LOW**: 10 TODO comments

## Phase 1: Critical Test Infrastructure (PRIORITY 1)

### Test Failures - Global Mocking Issues
**Impact:** 86 failed tests, 3 unhandled errors blocking development workflow

#### Root Causes:
1. **Global crypto property override:** `global.crypto = mockCrypto` fails because crypto is read-only
2. **WebKit message handler mocking:** Inconsistent mock structure causing undefined property access
3. **Unhandled promise rejections:** Error-throwing functions not properly caught in tests

#### Action Items:
```typescript
// BEFORE (failing):
global.crypto = mockCrypto;

// AFTER (working):
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});
```

**Files to Fix:**
- `src/db/__tests__/migration-safety-validation.test.ts` - Fix crypto mocking pattern
- `src/utils/__tests__/webview-bridge-reliability.test.ts` - Fix WebKit mock structure
- `src/utils/__tests__/filter-presets.test.ts` - Catch unhandled promise rejections

**Success Criteria:** All 86 failing tests pass, 0 unhandled errors

## Phase 2: Memory Leak Prevention (PRIORITY 2)

### Event Listener Cleanup
**Impact:** Potential memory leaks in production affecting performance

#### Patterns Found:
```typescript
// Missing cleanup in contexts
element.addEventListener('focus', handler);
element.addEventListener('blur', handler);
element.addEventListener('keydown', handler);

// Timer leaks
setInterval(() => {...}, 1000); // No cleanup
setTimeout(() => {...}, 5000);  // In loops
```

#### Action Items:
**Files to Audit:**
- `src/context/FocusContext.tsx` - Add removeEventListener in cleanup
- `src/services/ErrorReportingService.ts` - Add window event cleanup
- `src/db/migration-safety.ts` - Clear intervals in cleanup
- `src/db/PerformanceMonitor.ts` - Clear timeouts in error cases

**Pattern to Implement:**
```typescript
useEffect(() => {
  const handler = (event) => {...};
  element.addEventListener('event', handler);

  return () => {
    element.removeEventListener('event', handler);
  };
}, []);
```

## Phase 3: Console Logging Cleanup (PRIORITY 3)

### Debug Artifact Removal
**Impact:** 180+ console statements affecting production builds

#### Categories Found:
1. **Debug artifacts** (remove): Development-only logging
2. **Error reporting** (keep): Legitimate error handling
3. **Performance monitoring** (conditional): Keep for dev mode only

#### Strategy:
```typescript
// Remove debug artifacts:
console.log('[WebView Bridge] Processing messages'); // DELETE

// Keep error reporting:
console.error('Failed to save preset:', error); // KEEP

// Make conditional:
if (import.meta.env.DEV) {
  console.log('Debug info:', data); // DEV ONLY
}
```

**Files with High Console Usage:**
- `src/utils/webview-bridge.ts` - 15+ console statements
- `src/utils/security-validator.ts` - 12+ console statements
- `src/test/final-migration-validation.test.ts` - 20+ console statements
- `src/contexts/EnvironmentContext.tsx` - 8+ console statements

## Phase 4: Bundle Size Optimization (PRIORITY 4)

### Large File Refactoring
**Impact:** Bundle size and maintainability

#### Files Requiring Refactoring:
1. **`migration-safety.ts` (1227 lines)** - Split into modules
2. **`webview-bridge.ts` (947 lines)** - Extract reliability patterns
3. **`officeDocumentProcessor.ts` (937 lines)** - Split by document type
4. **`security-validator.ts` (682 lines)** - Separate test categories

#### Refactoring Strategy:
```typescript
// migration-safety.ts → Split into:
// - migration-safety-core.ts
// - migration-backup.ts
// - migration-rollback.ts
// - migration-validation.ts
```

## Phase 5: Technical Debt Cleanup (PRIORITY 5)

### TODO/FIXME Resolution
**Impact:** Code clarity and future maintenance

#### Items Found (10 total):
- `src/components/Toolbar.tsx` - "Implement submenus when needed"
- `src/components/Navigator.tsx` - "Replace with SQLite queries"
- `src/components/NavigatorFooter.tsx` - "Replace with dynamic coordinates" (2 items)
- `src/components/CardOverlay.tsx` - "Pass cell coordinates from D3SparsityLayer"
- `src/components/Sidebar.tsx` - "Check for edges table"
- `src/components/notebook/TemplateManager.tsx` - "Show error notification" (3 items)

#### Action Strategy:
1. **Immediate fixes** (5 items) - Simple implementations
2. **Future milestones** (3 items) - Convert to GitHub issues
3. **Architecture dependent** (2 items) - Resolve in Phase 2 implementation

## Implementation Timeline

**Week 1:** Phase 1 (Test Infrastructure)
- Fix global mocking patterns
- Resolve unhandled promise rejections
- Verify all tests passing

**Week 2:** Phase 2 (Memory Leaks)
- Audit event listeners
- Add cleanup patterns
- Performance regression testing

**Week 3:** Phase 3 (Console Cleanup)
- Categorize console statements
- Remove debug artifacts
- Implement conditional logging

**Week 4:** Phase 4 (Bundle Optimization)
- Refactor large files
- Extract modules
- Bundle size validation

**Week 5:** Phase 5 (Technical Debt)
- Resolve TODOs
- Create GitHub issues
- Documentation cleanup

## Success Metrics

### Quantitative Targets:
- **Test Pass Rate:** 100% (630/630 tests passing)
- **Console Statements:** <50 production statements
- **Bundle Size:** <20% reduction for large modules
- **Memory Leaks:** 0 detected in Lighthouse audit
- **TODO Items:** <5 remaining in codebase

### Quality Gates:
- ✅ All tests passing in CI/CD
- ✅ No console errors in production build
- ✅ Lighthouse performance score >90
- ✅ Bundle analysis shows no large chunks
- ✅ Memory usage stable under load testing

## Risk Mitigation

**Testing Strategy:**
- Run full test suite after each phase
- Performance regression testing
- Manual QA on critical user paths
- Staged rollout to production

**Rollback Plan:**
- Git commits per logical change
- Feature flags for large refactors
- Monitoring alerts for performance regressions
- Hotfix pipeline for critical issues

---

**Next Steps:**
1. Create GitHub issues for each phase
2. Assign priorities and owners
3. Set up monitoring for success metrics
4. Begin Phase 1 implementation