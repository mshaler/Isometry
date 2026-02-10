/**
 * Performance Memory Tab
 *
 * Memory monitoring, management actions, and diagnostic tools
 */

interface MemoryTabProps {
  memoryMetrics?: {
    usedJSHeapSize: number;
    leakDetected: boolean;
  };
  memoryPressure: number;
  onForceGC: () => void;
  onRecordMemorySnapshot: () => void;
  onResetOptimizations: () => void;
}

export function MemoryTab({
  memoryMetrics,
  memoryPressure,
  onForceGC,
  onRecordMemorySnapshot,
  onResetOptimizations
}: MemoryTabProps) {
  return (
    <div className="space-y-6">
      {/* Memory Overview */}
      {memoryMetrics && (
        <div className="bg-white rounded-lg shadow p-4 border">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Memory Overview</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Used Heap (MB)</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {(memoryPressure * 100).toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Memory Pressure (%)</div>
            </div>
            <div>
              <div className={`text-2xl font-semibold ${memoryMetrics.leakDetected ? 'text-red-600' : 'text-green-600'}`}>
                {memoryMetrics.leakDetected ? 'YES' : 'NO'}
              </div>
              <div className="text-sm text-gray-500">Memory Leaks</div>
            </div>
          </div>
        </div>
      )}

      {/* Memory Actions */}
      <div className="bg-white rounded-lg shadow p-4 border">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Memory Management</h4>
        <div className="space-y-4">
          <button
            onClick={onForceGC}
            className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Force Garbage Collection
          </button>
          <button
            onClick={onRecordMemorySnapshot}
            className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Record Memory Snapshot
          </button>
          <button
            onClick={onResetOptimizations}
            className="w-full inline-flex justify-center py-2 px-4 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Reset All Optimizations
          </button>
        </div>
      </div>
    </div>
  );
}