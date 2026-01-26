---
phase: D1
plan: DEBUG-D1
type: comprehensive-cleanup
autonomous: true
wave: 1
depends_on: []
---

# Phase D1: Critical Test Infrastructure Cleanup

## Objective

Fix critical test infrastructure issues preventing reliable test execution and proper development workflow. Address 86 failing tests, crypto property mocking inconsistencies, WebKit mock structure issues, and 3 unhandled promise rejections to establish a stable testing foundation.

## Context Files

@/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts
@/Users/mshaler/Developer/Projects/Isometry/src/test/setup.ts
@/Users/mshaler/Developer/Projects/Isometry/src/db/__tests__/migration-safety-validation.test.ts
@/Users/mshaler/Developer/Projects/Isometry/src/test/webview-migration-integration.test.ts

## Tasks

### Task 1: Fix Global Crypto Property Mocking
`type="auto"`

Fix the global.crypto property mocking issues affecting 86 failing tests. The current crypto mock setup is incomplete and causing test failures.

**What to fix:**
- Incomplete crypto.subtle implementation in test setup
- Inconsistent crypto mock between different test files
- Missing crypto.getRandomValues method for WebKit mock compatibility

**Implementation approach:**
- Add comprehensive crypto mock to test setup
- Ensure crypto.getRandomValues is properly mocked for all test scenarios
- Standardize crypto mock structure across all test files

**Verification:**
Run `npm test` and verify crypto-related test failures are resolved.

**Done criteria:** All crypto-related test failures eliminated, consistent crypto mock available globally.

### Task 2: Resolve WebKit Mock Structure Inconsistencies
`type="auto"`

Fix WebKit mock structure inconsistencies that are causing test environment setup failures and bridge-related test failures.

**What to fix:**
- Inconsistent WebView bridge mock implementations
- Missing WebKit structure properties in JSDOM environment
- Incomplete mock coverage for WebView message handlers

**Implementation approach:**
- Standardize WebView bridge mock structure in test setup
- Add missing WebKit properties for JSDOM compatibility
- Implement proper mock hierarchy for WebView bridge components

**Verification:**
Run WebView-related tests and verify proper mock initialization.

**Done criteria:** WebView bridge tests execute without mock structure errors.

### Task 3: Clean Up Unhandled Promise Rejections
`type="auto"`

Identify and fix the 3 unhandled promise rejections in the test suite that are causing test instability and potential false negatives.

**What to fix:**
- Unhandled promise rejections in async test operations
- Missing error handling in test cleanup operations
- Incomplete promise chain handling in migration tests

**Implementation approach:**
- Add proper error handling for all async test operations
- Implement comprehensive test cleanup procedures
- Add promise rejection handlers for test scenarios

**Verification:**
Run full test suite with promise rejection detection enabled.

**Done criteria:** Zero unhandled promise rejections in test execution.

### Task 4: Optimize Test Performance and Reliability
`type="auto"`

Improve test execution performance and reliability to prevent timeout-related failures and ensure consistent test results.

**What to fix:**
- Long test execution times (15+ seconds for some tests)
- Timeout-related test failures in integration tests
- Inconsistent test results between runs

**Implementation approach:**
- Optimize test mock implementations for faster execution
- Reduce unnecessary async delays in test scenarios
- Implement proper test isolation to prevent cross-test interference

**Verification:**
Run test suite multiple times to verify consistent results and improved performance.

**Done criteria:** Test suite execution time reduced by >30%, consistent test results across multiple runs.

## Verification

### Test Infrastructure Validation
1. **Test Execution:** `npm test` completes without infrastructure errors
2. **Mock Functionality:** All mocked APIs (crypto, WebView bridge) function correctly
3. **Promise Handling:** Zero unhandled promise rejections in test output
4. **Performance:** Test suite execution completes in <12 seconds
5. **Consistency:** Multiple test runs produce identical results

### Coverage Validation
1. **Test Coverage:** Maintain >90% code coverage after cleanup
2. **Mock Coverage:** All critical APIs properly mocked
3. **Error Scenarios:** Error handling tests execute reliably

## Success Criteria

- [ ] All 86 crypto-related test failures resolved
- [ ] WebKit mock structure consistently implemented
- [ ] Zero unhandled promise rejections in test suite
- [ ] Test suite execution time improved by >30%
- [ ] 100% test pass rate with reliable, repeatable results
- [ ] Comprehensive test infrastructure foundation for subsequent cleanup phases

## Output

**Primary deliverable:** Fully functional test infrastructure with zero infrastructure-related test failures and reliable execution performance.

**Supporting deliverables:**
- Standardized test setup with comprehensive mocking
- Optimized test performance with consistent execution times
- Clean promise handling throughout test suite
- Foundation for reliable development workflow during remaining cleanup phases

---

*This plan establishes the critical test infrastructure foundation required for reliable execution of subsequent debug cleanup phases D2-D5.*