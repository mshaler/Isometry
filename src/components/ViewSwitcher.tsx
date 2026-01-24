/**
 * ViewSwitcher - Toggle between Grid, List, and Kanban views
 *
 * Three toggle buttons with active state highlighting.
 * Kanban is disabled for MVP.
 *
 * @module components/ViewSwitcher
 */

import React from 'react';
import '../styles/ViewSwitcher.css';

export type ViewMode = 'grid' | 'list' | 'kanban';

export interface ViewSwitcherProps {
  /** Current active view mode */
  currentView: ViewMode;

  /** Callback when view mode changes */
  onViewChange: (mode: ViewMode) => void;
}

/**
 * ViewSwitcher component - toggle between visualization modes.
 *
 * @example
 * ```tsx
 * <ViewSwitcher
 *   currentView="grid"
 *   onViewChange={(mode) => console.log('Switched to:', mode)}
 * />
 * ```
 */
export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher" role="tablist" aria-label="View mode selection">
      <button
        className={`view-button ${currentView === 'grid' ? 'active' : ''}`}
        onClick={() => onViewChange('grid')}
        role="tab"
        aria-selected={currentView === 'grid'}
        aria-label="Grid view"
        title="Grid view - cards in 2D grid"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>Grid</span>
      </button>

      <button
        className={`view-button ${currentView === 'list' ? 'active' : ''}`}
        onClick={() => onViewChange('list')}
        role="tab"
        aria-selected={currentView === 'list'}
        aria-label="List view"
        title="List view - cards in vertical list"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect
            x="1"
            y="12"
            width="14"
            height="3"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span>List</span>
      </button>

      <button
        className={`view-button ${currentView === 'kanban' ? 'active' : ''}`}
        onClick={() => onViewChange('kanban')}
        disabled
        role="tab"
        aria-selected={currentView === 'kanban'}
        aria-label="Kanban view (disabled)"
        title="Kanban view - coming soon"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="6" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="1" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>Kanban</span>
      </button>
    </div>
  );
}

export default ViewSwitcher;
