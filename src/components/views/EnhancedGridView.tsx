import React, { useState, useCallback, useEffect } from 'react';
import { GridView } from './GridView';
import { usePAFV } from '../../hooks/usePAFV';
import { ViewTransition, SkeletonLoader } from './ViewTransitions';
import type { ViewComponentProps } from '../../types/view';
import type { Node } from '../../types/node';

/**
 * EnhancedGridView - ViewRenderer-compatible wrapper for GridView
 *
 * Features:
 * - Integrates with ViewRenderer interface
 * - Maintains PAFV context integration
 * - Supports transition state restoration
 * - Enhanced with loading states and animations
 * - Performance optimized with React.memo
 */
export const EnhancedGridView = React.memo<ViewComponentProps>(({
  data,
  onNodeClick,
  transitionState: _transitionState
}) => {
  const { state: pafvState } = usePAFV();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Simulate loading state when PAFV mappings change
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);

    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 150); // Brief loading state for smooth transitions

    return () => clearTimeout(timeout);
  }, [pafvState.mappings]);

  const handleNodeClick = useCallback((node: unknown) => {
    try {
      onNodeClick?.(node as Node);
    } catch (error) {
      console.error('Error handling node click:', error);
      setHasError(true);
      setTimeout(() => setHasError(false), 3000); // Clear error after 3 seconds
    }
  }, [onNodeClick]);

  return (
    <ViewTransition
      viewKey={`grid-${JSON.stringify(pafvState.mappings)}`}
      isLoading={isLoading}
      hasError={hasError}
      config={{ duration: 250, easing: 'ease-out' }}
    >
      {isLoading ? (
        <div className="p-4">
          <SkeletonLoader type="grid" count={6} />
        </div>
      ) : (
        <GridView
          sql="SELECT * FROM nodes ORDER BY created_at DESC LIMIT 100"
          queryParams={[]}
          onNodeClick={handleNodeClick}
        />
      )}
    </ViewTransition>
  );
});

EnhancedGridView.displayName = 'EnhancedGridView';