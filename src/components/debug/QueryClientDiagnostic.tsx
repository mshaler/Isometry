import React from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cacheUtils } from '../../services/queryClient';

/**
 * QueryClient diagnostic component to verify TanStack Query setup
 *
 * Shows cache status, default options, and performs basic query tests
 * to confirm QueryClient is operational.
 */
export const QueryClientDiagnostic: React.FC = () => {
  const queryClient = useQueryClient();
  const cacheStats = cacheUtils.getCacheStats();

  // Test basic query functionality
  const { data: testData, isLoading, error } = useQuery({
    queryKey: ['test-query'],
    queryFn: async () => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      return { message: 'QueryClient is working!', timestamp: Date.now() };
    },
    staleTime: 30000, // 30 seconds
  });

  const defaultOptions = queryClient.getDefaultOptions();

  return (
    <div className="p-6 bg-gray-50 border-2 border-blue-500 rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">TanStack Query Diagnostic</h2>

      {/* Connection Status */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
        <div className="bg-white p-3 rounded border">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${queryClient ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              QueryClient: {queryClient ? 'Connected' : 'Not Available'}
            </span>
          </div>
        </div>
      </section>

      {/* Cache Statistics */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Cache Statistics</h3>
        <div className="bg-white p-3 rounded border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Queries:</span> {cacheStats.totalQueries}
            </div>
            <div>
              <span className="font-medium">Active Queries:</span> {cacheStats.activeQueries}
            </div>
            <div>
              <span className="font-medium">Stale Queries:</span> {cacheStats.staleQueries}
            </div>
            <div>
              <span className="font-medium">Cached Queries:</span> {cacheStats.cachedQueries}
            </div>
          </div>
        </div>
      </section>

      {/* Basic Query Test */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Basic Query Test</h3>
        <div className="bg-white p-3 rounded border">
          {isLoading && (
            <div className="text-yellow-600">Loading test query...</div>
          )}
          {error && (
            <div className="text-red-600">
              Error: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}
          {testData && (
            <div className="text-green-600">
              <div className="font-medium">✓ Query successful</div>
              <div className="text-sm mt-1">
                Message: {testData.message}<br />
                Timestamp: {new Date(testData.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Default Options */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Default Options</h3>
        <div className="bg-white p-3 rounded border">
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Stale Time:</span> {
                typeof defaultOptions.queries?.staleTime === 'number'
                  ? `${defaultOptions.queries.staleTime}ms`
                  : 'Function/Variable'
              }
            </div>
            <div>
              <span className="font-medium">GC Time:</span> {defaultOptions.queries?.gcTime}ms
            </div>
            <div>
              <span className="font-medium">Refetch on Window Focus:</span> {
                defaultOptions.queries?.refetchOnWindowFocus ? 'Yes' : 'No'
              }
            </div>
            <div>
              <span className="font-medium">Refetch on Reconnect:</span> {
                defaultOptions.queries?.refetchOnReconnect ? 'Yes' : 'No'
              }
            </div>
          </div>
        </div>
      </section>

      {/* Mutation Cache */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Mutation Cache</h3>
        <div className="bg-white p-3 rounded border">
          <div className="text-sm">
            <div>
              <span className="font-medium">Mutation Cache:</span> {
                queryClient.getMutationCache() ? 'Available' : 'Not Available'
              }
            </div>
            <div>
              <span className="font-medium">Pending Mutations:</span> {
                queryClient.isMutating()
              }
            </div>
          </div>
        </div>
      </section>

      {/* Cache Actions */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Cache Actions</h3>
        <div className="bg-white p-3 rounded border">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => cacheUtils.clearCache()}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear All Cache
            </button>
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Invalidate All
            </button>
            <button
              onClick={() => {
                console.log('QueryClient instance:', queryClient);
                console.log('Cache stats:', cacheStats);
                console.log('Default options:', defaultOptions);
              }}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Log to Console
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default QueryClientDiagnostic;