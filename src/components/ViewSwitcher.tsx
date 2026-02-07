import React, { useCallback, useEffect } from 'react';
import { ViewType } from '../types/views';

/**
 * ViewSwitcher - React toolbar component for view type selection
 *
 * Features:
 * - Toolbar with view type icons (standard Finder/Numbers pattern)
 * - Keyboard shortcuts: Cmd+1 = List, Cmd+2 = Kanban, Cmd+3 = SuperGrid
 * - View choice persists per-canvas via ViewState localStorage
 * - Integration with ViewContinuum orchestration
 */

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  disabled?: boolean;
  className?: string;
}

export function ViewSwitcher({
  currentView,
  onViewChange,
  disabled = false,
  className = ''
}: ViewSwitcherProps) {

  // ========================================================================
  // Keyboard Shortcut Handling
  // ========================================================================

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle when Cmd (macOS) or Ctrl (Windows/Linux) is pressed
    if (!(event.metaKey || event.ctrlKey)) return;

    // Prevent default browser behavior for our shortcuts
    switch (event.key) {
      case '1':
        event.preventDefault();
        onViewChange(ViewType.LIST);
        break;
      case '2':
        event.preventDefault();
        onViewChange(ViewType.KANBAN);
        break;
      case '3':
        event.preventDefault();
        onViewChange(ViewType.SUPERGRID);
        break;
      default:
        // Let other shortcuts pass through
        break;
    }
  }, [onViewChange]);

  // Register keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // ========================================================================
  // View Switch Handlers
  // ========================================================================

  const handleViewClick = useCallback((view: ViewType) => {
    if (!disabled && view !== currentView) {
      console.log('📊 ViewSwitcher: View change requested:', {
        from: currentView,
        to: view,
        trigger: 'click'
      });
      onViewChange(view);
    }
  }, [currentView, onViewChange, disabled]);

  // ========================================================================
  // View Configuration
  // ========================================================================

  const viewConfigs = [
    {
      type: ViewType.LIST,
      label: 'List View',
      shortcut: '⌘1',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="flex-shrink-0"
        >
          <path d="M2.5 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM2.5 6.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM3 9.5a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1H3zM2.5 12.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
        </svg>
      )
    },
    {
      type: ViewType.KANBAN,
      label: 'Kanban Board',
      shortcut: '⌘2',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="flex-shrink-0"
        >
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v10A1.5 1.5 0 0 1 5.5 14h-3A1.5 1.5 0 0 1 1 12.5v-10zm8.5-.5A1.5 1.5 0 0 1 11 3.5v7A1.5 1.5 0 0 1 9.5 12h-3A1.5 1.5 0 0 1 5 10.5v-7A1.5 1.5 0 0 1 6.5 2h3zm5.5 2A1.5 1.5 0 0 1 16 5.5v4A1.5 1.5 0 0 1 14.5 11h-3A1.5 1.5 0 0 1 10 9.5v-4A1.5 1.5 0 0 1 11.5 4h3z"/>
        </svg>
      )
    },
    {
      type: ViewType.SUPERGRID,
      label: 'SuperGrid',
      shortcut: '⌘3',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="flex-shrink-0"
        >
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
        </svg>
      )
    }
  ];

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className={`view-switcher ${className}`}>
      <div className="flex items-center space-x-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
        {viewConfigs.map((config) => {
          const isActive = currentView === config.type;
          const buttonClasses = [
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors duration-150',
            'text-sm font-medium',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            isActive
              ? 'bg-blue-100 text-blue-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
          ].join(' ');

          return (
            <button
              key={config.type}
              type="button"
              className={buttonClasses}
              onClick={() => handleViewClick(config.type)}
              disabled={disabled}
              title={`${config.label} (${config.shortcut})`}
              aria-label={`Switch to ${config.label}`}
              aria-pressed={isActive}
            >
              {config.icon}
              <span className="hidden sm:inline">{config.label}</span>
              <span className="hidden lg:inline text-xs text-gray-400">
                {config.shortcut}
              </span>
            </button>
          );
        })}
      </div>

      {/* Screen reader announcement for view changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Current view: {viewConfigs.find(c => c.type === currentView)?.label}
      </div>
    </div>
  );
}

// ========================================================================
// Hooks for Integration
// ========================================================================

/**
 * Hook to manage view state with localStorage persistence
 */
export function useViewSwitcher(canvasId: string, defaultView: ViewType = ViewType.SUPERGRID) {
  const [currentView, setCurrentView] = React.useState<ViewType>(() => {
    // Load persisted view from localStorage
    try {
      const storageKey = `isometry-view-state-${canvasId}`;
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.currentView && Object.values(ViewType).includes(parsed.currentView)) {
          return parsed.currentView;
        }
      }
    } catch (error) {
      console.warn('Failed to load view state from localStorage:', error);
    }
    return defaultView;
  });

  const handleViewChange = useCallback((newView: ViewType) => {
    setCurrentView(newView);

    // Persist view choice to localStorage
    try {
      const storageKey = `isometry-view-state-${canvasId}`;
      const existingState = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const updatedState = {
        ...existingState,
        currentView: newView,
        lastModified: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(updatedState));

      console.log('💾 ViewSwitcher: Persisted view choice:', {
        canvasId,
        view: newView,
        timestamp: updatedState.lastModified
      });
    } catch (error) {
      console.warn('Failed to save view state to localStorage:', error);
    }
  }, [canvasId]);

  return {
    currentView,
    setCurrentView: handleViewChange
  };
}

export default ViewSwitcher;