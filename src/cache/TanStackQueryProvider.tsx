/**
 * TanStack Query Provider with intelligent caching configuration
 *
 * Integrates with existing CacheInvalidation system for unified invalidation
 * across both TanStack Query and live data systems. Configured with research-
 * recommended 5-minute staleTime and 30-minute gcTime for optimal performance.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient as useTanStackQueryClient
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Create QueryClient with intelligent cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Research-recommended: 5-minute staleTime for frequently accessed data
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Research-recommended: 30-minute gcTime for memory management
      gcTime: 1000 * 60 * 30, // 30 minutes
      // Background refetch for stale-while-revalidate pattern
      refetchOnWindowFocus: false, // Prevent excessive refetches
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: false, // Don't retry mutations automatically
    },
  },
});

/**
 * TanStack Query Provider with DevTools integration
 */
export function TanStackQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

/**
 * Export query client instance for direct access
 */
export { queryClient };

/**
 * Hook to access the QueryClient instance
 */
export function useQueryClient() {
  return useTanStackQueryClient();
}

/**
 * Query client context for external access
 */
const QueryClientContext = createContext<QueryClient | null>(null);

/**
 * Provider wrapper for external query client access
 */
export function QueryClientContextProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientContext.Provider value={queryClient}>
      {children}
    </QueryClientContext.Provider>
  );
}

/**
 * Hook to get query client from context (fallback method)
 */
export function useQueryClientContext() {
  const context = useContext(QueryClientContext);
  if (!context) {
    // Fallback to the singleton instance
    return queryClient;
  }
  return context;
}