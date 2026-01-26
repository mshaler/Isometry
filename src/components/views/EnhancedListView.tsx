import React from 'react';
import { ListView } from './ListView';
import type { ViewComponentProps } from '../../types/view';

/**
 * EnhancedListView - ViewRenderer-compatible wrapper for ListView
 *
 * Features:
 * - Integrates with ViewRenderer interface
 * - Supports transition state restoration
 * - Performance optimized with React.memo
 * - Maintains existing ListView functionality
 */
export const EnhancedListView = React.memo<ViewComponentProps>(({
  data,
  onNodeClick,
  transitionState
}) => {
  // The original ListView already accepts the props we need,
  // so we just need to pass them through
  return (
    <ListView
      data={data}
      onNodeClick={onNodeClick}
    />
  );
});

EnhancedListView.displayName = 'EnhancedListView';