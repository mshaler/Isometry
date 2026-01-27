---
phase: D2
plan: DEBUG-D2
type: execute
wave: 1
depends_on: []
files_modified: [
  "src/contexts/EnvironmentContext.tsx",
  "src/context/FocusContext.tsx",
  "src/features/FeatureFlagProvider.tsx",
  "src/features/ConfigurationProvider.tsx",
  "src/features/ABTestProvider.tsx",
  "src/components/views/PerformanceMonitor.tsx"
]
autonomous: true

must_haves:
  truths:
    - "Timer cleanup prevents memory leaks on component unmount"
    - "Event listeners are properly removed when components unmount"
    - "useEffect cleanup functions handle all async operations"
    - "Performance monitoring doesn't cause memory accumulation"
    - "React Context providers properly clean up resources"
  artifacts:
    - path: "src/contexts/EnvironmentContext.tsx"
      provides: "Timeout cleanup for DOM announcements"
      pattern: "clearTimeout"
    - path: "src/context/FocusContext.tsx"
      provides: "Event listener cleanup verification"
      pattern: "removeEventListener"
    - path: "src/features/FeatureFlagProvider.tsx"
      provides: "Cache cleanup interval management"
      pattern: "clearInterval.*useEffect"
    - path: "src/components/views/PerformanceMonitor.tsx"
      provides: "requestAnimationFrame cleanup"
      pattern: "cancelAnimationFrame"
  key_links:
    - from: "useEffect cleanup functions"
      to: "timer and listener cleanup"
      via: "return () => { clear... }"
      pattern: "useEffect.*return.*clear"
    - from: "Component unmount"
      to: "resource cleanup"
      via: "useEffect dependency arrays"
      pattern: "useEffect.*\\[.*\\].*return"
---

<objective>
Systematic memory and performance leak detection and resolution across context providers and timer usage.

Purpose: Eliminate memory leaks from uncleaned timers, event listeners, and React effects to ensure stable long-running application performance with proper resource management.

Output: Production-safe memory management across all identified components with verified cleanup patterns and memory leak prevention.
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-quality/DEBUG-D1-SUMMARY.md

# DEBUG D1 Foundation Established
✅ Test infrastructure with stable execution platform (>97% performance improvement)
✅ Comprehensive crypto mocking and WebKit bridge testing
✅ Promise rejection handling and performance optimization
✅ 86 failing tests eliminated with reliable foundation

# Context Provider Analysis
@src/contexts/EnvironmentContext.tsx (HTTP API connection testing, DOM announcement cleanup)
@src/context/FocusContext.tsx (Event listener management, focus tracking)
@src/features/FeatureFlagProvider.tsx (Cache management, WebView bridge listeners)
@src/features/ConfigurationProvider.tsx (Hot reload intervals, native communication)
@src/features/ABTestProvider.tsx (Message handlers, experiment tracking)
@src/components/views/PerformanceMonitor.tsx (Frame tracking, requestAnimationFrame loops)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Timer Leak Detection and Cleanup Verification</name>
  <files>
    src/contexts/EnvironmentContext.tsx
    src/features/ConfigurationProvider.tsx
    src/components/views/PerformanceMonitor.tsx
  </files>
  <action>
    Fix timer leak vulnerabilities and implement comprehensive cleanup:

    **EnvironmentContext.tsx:**
    - Line 136: Add AbortController timeout cleanup to prevent dangling timeout reference
    - Line 72: Store announcement timeout in ref for cleanup on component unmount
    - Implement useRef for timeout tracking and cleanup in useEffect return

    **ConfigurationProvider.tsx:**
    - Line 641: Ensure hot reload interval properly clears on component unmount
    - Add interval ref tracking and verify clearInterval in cleanup function
    - Fix enableHotReload/hotReloadInterval dependency array for useEffect

    **PerformanceMonitor.tsx:**
    - Line 89: requestAnimationFrame tracking loop lacks cleanup mechanism
    - Add cancelAnimationFrame in component cleanup and stop tracking on unmount
    - Store animation frame ID in ref for proper cleanup
    - Line 169: Add updateIntervalRef cleanup verification and memory leak prevention

    Pattern: All timers must be stored in refs and cleaned up in useEffect return functions.
    Avoid: Dangling setTimeout, setInterval, or requestAnimationFrame without cleanup.
  </action>
  <verify>
    grep -n "setTimeout\|setInterval\|requestAnimationFrame" src/contexts/EnvironmentContext.tsx src/features/ConfigurationProvider.tsx src/components/views/PerformanceMonitor.tsx
    grep -n "clearTimeout\|clearInterval\|cancelAnimationFrame" src/contexts/EnvironmentContext.tsx src/features/ConfigurationProvider.tsx src/components/views/PerformanceMonitor.tsx
    grep -n "useRef.*Timeout\|useRef.*Interval\|useRef.*Frame" src/contexts/EnvironmentContext.tsx src/features/ConfigurationProvider.tsx src/components/views/PerformanceMonitor.tsx
  </verify>
  <done>All timer creation paired with proper cleanup mechanisms, refs used for cleanup tracking, and useEffect return functions properly clear all timers</done>
</task>

<task type="auto">
  <name>Task 2: Event Listener Cleanup and Focus Management Audit</name>
  <files>
    src/context/FocusContext.tsx
    src/features/FeatureFlagProvider.tsx
    src/features/ConfigurationProvider.tsx
    src/features/ABTestProvider.tsx
  </files>
  <action>
    Audit and fix event listener memory leaks across context providers:

    **FocusContext.tsx:**
    - Lines 144-146: Verify event listener cleanup in unregisterComponent function
    - Lines 82-86: Ensure cleanup of existing listeners before re-registration
    - Add componentListeners.current.clear() on component unmount
    - Verify all addEventListener calls have corresponding removeEventListener

    **Provider Components (FeatureFlag, Configuration, ABTest):**
    - Lines 454/661/670: window.addEventListener('message') cleanup verification
    - Ensure return () => window.removeEventListener is properly implemented
    - Verify handleNativeMessage functions are not creating closures that leak
    - Check dependency arrays for useEffect with event listeners

    **Memory Leak Prevention:**
    - Implement event listener tracking with Map for debugging
    - Add useRef for listener function stability across renders
    - Ensure cleanup functions are called on unmount, not just re-render

    Pattern: Every addEventListener must have corresponding removeEventListener in useEffect cleanup.
    Avoid: Event listeners without cleanup, listener function recreation on every render.
  </action>
  <verify>
    grep -A5 -B5 "addEventListener" src/context/FocusContext.tsx src/features/FeatureFlagProvider.tsx src/features/ConfigurationProvider.tsx src/features/ABTestProvider.tsx
    grep -A5 -B5 "removeEventListener" src/context/FocusContext.tsx src/features/FeatureFlagProvider.tsx src/features/ConfigurationProvider.tsx src/features/ABTestProvider.tsx
    grep -n "useEffect.*\\[\\]" src/context/FocusContext.tsx src/features/FeatureFlagProvider.tsx src/features/ConfigurationProvider.tsx src/features/ABTestProvider.tsx
  </verify>
  <done>All event listeners properly cleaned up with matching addEventListener/removeEventListener pairs, stable listener function references, and proper useEffect cleanup</done>
</task>

<task type="auto">
  <name>Task 3: React Effect Dependency and Cleanup Validation</name>
  <files>
    src/contexts/EnvironmentContext.tsx
    src/features/FeatureFlagProvider.tsx
    src/features/ConfigurationProvider.tsx
    src/features/ABTestProvider.tsx
  </files>
  <action>
    Comprehensive useEffect cleanup validation and dependency array fixes:

    **Effect Dependency Analysis:**
    - EnvironmentContext: Line 292 useEffect dependency [forcedMode, enableAutoDetection] verification
    - FeatureFlagProvider: Line 460 cache cleanup effect dependency [evaluationCache] causes re-creation
    - ConfigurationProvider: Line 638 hot reload effect with [enableHotReload, hotReloadInterval] deps
    - ABTestProvider: Effect dependency validation for user assignment and experiment tracking

    **Cleanup Function Verification:**
    - Ensure all async operations have cleanup handlers (fetch AbortController, Promise cancellation)
    - Add cleanup for setState calls after component unmount prevention
    - Implement isMounted ref pattern for async state updates
    - Verify return functions clean up all side effects

    **Memory Management:**
    - Add useRef for stable function references to prevent effect re-execution
    - Implement proper dependency arrays to avoid unnecessary re-renders
    - Add cleanup for cache Maps and local state to prevent accumulation

    Pattern: useEffect return functions must clean up ALL side effects from that effect.
    Avoid: setState after unmount, missing dependencies, infinite effect loops.
  </action>
  <verify>
    grep -A10 "useEffect" src/contexts/EnvironmentContext.tsx src/features/FeatureFlagProvider.tsx src/features/ConfigurationProvider.tsx src/features/ABTestProvider.tsx | grep -E "(return|cleanup|clear|cancel)"
    grep -n "\\[.*evaluationCache.*\\]" src/features/FeatureFlagProvider.tsx
    grep -n "useRef.*isMounted" src/contexts/EnvironmentContext.tsx src/features/FeatureFlagProvider.tsx src/features/ConfigurationProvider.tsx src/features/ABTestProvider.tsx
  </verify>
  <done>All useEffect hooks have proper cleanup functions, dependency arrays prevent unnecessary re-execution, and async operations include unmount protection</done>
</task>

</tasks>

<verification>
## Memory Leak Prevention Validation

1. **Timer Management Verification:**
   ```bash
   # Verify all timers have cleanup
   grep -r "setTimeout\|setInterval\|requestAnimationFrame" src/ | grep -v test | grep -v "clearTimeout\|clearInterval\|cancelAnimationFrame"

   # Ensure cleanup pattern implementation
   grep -r "clearTimeout\|clearInterval\|cancelAnimationFrame" src/contexts/ src/features/ src/components/views/
   ```

2. **Event Listener Audit:**
   ```bash
   # Count addEventListener vs removeEventListener balance
   grep -r "addEventListener" src/ | wc -l
   grep -r "removeEventListener" src/ | wc -l

   # Verify cleanup in useEffect returns
   grep -A15 "useEffect" src/context/FocusContext.tsx | grep "removeEventListener"
   ```

3. **Performance Monitoring:**
   ```bash
   # Run test suite to verify no new memory leaks introduced
   npm test -- --testNamePattern="memory|leak|cleanup"

   # Check for cleanup patterns in modified files
   grep -n "return.*clear\|return.*cancel\|return.*remove" src/contexts/ src/features/
   ```

4. **React Effect Validation:**
   ```bash
   # Verify useEffect cleanup functions exist
   grep -B5 -A15 "useEffect" src/contexts/EnvironmentContext.tsx | grep -E "(return|cleanup)"
   ```
</verification>

<success_criteria>
- [ ] All setTimeout, setInterval, and requestAnimationFrame calls have corresponding cleanup mechanisms
- [ ] Event listeners are properly removed when components unmount using stable function references
- [ ] useEffect hooks include return functions that clean up all side effects and async operations
- [ ] Context providers implement proper resource cleanup preventing memory accumulation
- [ ] Performance monitoring components properly clean up tracking loops and intervals
- [ ] Test suite continues to pass with enhanced memory management (stable foundation from D1)
- [ ] No new memory leaks introduced as verified by cleanup pattern auditing
</success_criteria>

<output>
After completion, create `.planning/phases/D2-memory-leaks/DEBUG-D2-SUMMARY.md`
</output>