// Isometry v6.0 — Phase 74: PerfTrace Instrumentation Utility
//
// Wraps performance.mark / performance.measure into a unified API.
// Guards on __PERF_INSTRUMENTATION__ so all calls compile away to no-ops
// in production builds (Vite tree-shaking + dead-code elimination).
//
// Requirements: PROF-01, PROF-02, PROF-03

declare const __PERF_INSTRUMENTATION__: boolean;

/**
 * Begin a named trace span by placing a performance mark at `${name}:start`.
 * No-op when __PERF_INSTRUMENTATION__ is false (production builds).
 */
export function startTrace(name: string): void {
	if (__PERF_INSTRUMENTATION__) {
		performance.mark(`${name}:start`);
	}
}

/**
 * End a named trace span. Creates `${name}:end` mark and a measure from
 * `${name}:start` to `${name}:end`. The measure is retrievable via getTraces().
 * No-op when __PERF_INSTRUMENTATION__ is false (production builds).
 */
export function endTrace(name: string): void {
	if (__PERF_INSTRUMENTATION__) {
		performance.mark(`${name}:end`);
		try {
			performance.measure(name, `${name}:start`, `${name}:end`);
		} catch {
			// Swallow if the start mark was never placed (e.g., disabled mid-flight)
		}
	}
}

/**
 * Retrieve all completed measure entries for the given trace name.
 * Returns an empty array when __PERF_INSTRUMENTATION__ is false.
 */
export function getTraces(name: string): PerformanceEntry[] {
	if (__PERF_INSTRUMENTATION__) {
		return performance.getEntriesByName(name, 'measure');
	}
	return [];
}

/**
 * Clear all marks and measures. Useful between test cases or profiling sessions.
 * No-op when __PERF_INSTRUMENTATION__ is false.
 */
export function clearTraces(): void {
	if (__PERF_INSTRUMENTATION__) {
		performance.clearMarks();
		performance.clearMeasures();
	}
}
