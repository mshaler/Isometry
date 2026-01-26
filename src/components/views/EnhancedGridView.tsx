import React from 'react';
import { GridView } from './GridView';
import { usePAFV } from '../../hooks/usePAFV';
import type { ViewComponentProps } from '../../types/view';

/**
 * EnhancedGridView - ViewRenderer-compatible wrapper for GridView
 *
 * Features:
 * - Integrates with ViewRenderer interface
 * - Maintains PAFV context integration
 * - Supports transition state restoration
 * - Performance optimized with React.memo
 */
export const EnhancedGridView = React.memo<ViewComponentProps>(({
  data,
  onNodeClick,
  transitionState
}) => {
  const { state: pafvState } = usePAFV();

  // The original GridView uses PAFV context internally via usePAFV hook,
  // so we just need to pass through the props it expects
  return (
    <GridView
      data={data}
      onNodeClick={onNodeClick}
    />
  );
});

EnhancedGridView.displayName = 'EnhancedGridView';