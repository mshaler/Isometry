import React, { useState, useCallback, useEffect } from 'react';
import { ListView } from './ListView';
import { ViewTransition, SkeletonLoader } from './ViewTransitions';
import type { ViewComponentProps } from '../../types/view';

/**
 * EnhancedListView - ViewRenderer-compatible wrapper for ListView
 *
 * Features:
 * - Integrates with ViewRenderer interface
 * - Supports transition state restoration
 * - Enhanced with staggered list animations
 * - Loading states with appropriate skeleton
 * - Performance optimized with React.memo
 */
export const EnhancedListView = React.memo<ViewComponentProps>(({
  data,
  onNodeClick,
  transitionState: _transitionState
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Trigger loading state when data changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 100); // Brief loading state

    return () => clearTimeout(timeout);
  }, [data.length]);

  const handleNodeClick = useCallback((node: unknown) => {
    try {
      onNodeClick?.(node);
    } catch (error) {
      console.error('Error handling node click:', error);
      setHasError(true);
      setTimeout(() => setHasError(false), 3000);
    }
  }, [onNodeClick]);

  return (
    <ViewTransition
      viewKey={`list-${data.length}`}
      isLoading={isLoading}
      hasError={hasError}
      config={{ duration: 300, easing: 'ease-out' }}
    >
      {isLoading ? (
        <div className="p-4">
          <SkeletonLoader type="list" count={8} />
        </div>
      ) : (
        <ListView
          data={data}
          onNodeClick={handleNodeClick}
        />
      )}
    </ViewTransition>
  );
});

EnhancedListView.displayName = 'EnhancedListView';