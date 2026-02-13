/**
 * Bridge Performance Stub
 *
 * The bridge infrastructure was eliminated in v4 (sql.js replaces the Swift-JS bridge).
 * This stub provides type-compatible exports so legacy test utilities compile.
 * The actual bridge performance testing is no longer needed.
 */

export interface BridgeStressTestResult {
  averageLatency: number;
  stress?: {
    throughput: number;
  };
  // Legacy properties for compatibility with migration-e2e.ts
  passed: boolean;
  recommendations: string[];
  results?: unknown[];
}

export const PERFORMANCE_TARGETS = {
  bridgeLatency: 50,
  databaseOps: 100,
  syncLatency: 200,
  memoryOverhead: 100,
} as const;

/**
 * @deprecated Bridge was eliminated in v4. This is a no-op stub.
 */
export async function bridgePerformanceTest(
  _environment?: unknown,
  _mode?: string
): Promise<BridgeStressTestResult> {
  return {
    averageLatency: 0,
    stress: { throughput: 0 },
    passed: true,
    recommendations: [],
    results: [],
  };
}
