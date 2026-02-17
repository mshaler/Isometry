/**
 * Grid Continuum Switcher - Mode switching UI component
 *
 * Provides a visual switcher for the 5 Grid Continuum modes:
 * Gallery (0) -> List (1) -> Kanban (1 facet) -> Grid (2) -> SuperGrid (n)
 *
 * Each mode represents a different PAFV axis allocation strategy for the same data.
 *
 * Keyboard shortcuts: Cmd+1 = Gallery, Cmd+2 = List, Cmd+3 = Kanban,
 * Cmd+4 = Grid, Cmd+5 = SuperGrid (also works with Ctrl on Windows/Linux)
 */

import { useState, useCallback, useEffect } from 'react';
import type { GridContinuumMode } from '@/types/view';
import './GridContinuumSwitcher.css';

interface GridContinuumSwitcherProps {
  /** Current active mode */
  currentMode: GridContinuumMode;
  /** Callback when mode changes */
  onModeChange: (mode: GridContinuumMode) => void;
  /** Show visual feedback during transitions */
  showTransitionFeedback?: boolean;
  /** CSS class name */
  className?: string;
}

// Mode definitions with metadata (including keyboard shortcut hints)
const GRID_CONTINUUM_MODES = [
  {
    id: 'gallery' as GridContinuumMode,
    label: 'Gallery',
    icon: '\u229E', // Box drawing character
    description: 'Gallery: position-only layout (masonry) - Cmd+1',
    shortcut: '1',
    axisCount: 0
  },
  {
    id: 'list' as GridContinuumMode,
    label: 'List',
    icon: '\u2261', // Identical to
    description: 'List: single axis vertical hierarchy - Cmd+2',
    shortcut: '2',
    axisCount: 1
  },
  {
    id: 'kanban' as GridContinuumMode,
    label: 'Kanban',
    icon: '\u2AFD', // Double solidus
    description: 'Kanban: facet-based column grouping - Cmd+3',
    shortcut: '3',
    axisCount: 1
  },
  {
    id: 'grid' as GridContinuumMode,
    label: 'Grid',
    icon: '\u229E', // Box drawing character
    description: 'Grid: 2D row x column matrix - Cmd+4',
    shortcut: '4',
    axisCount: 2
  },
  {
    id: 'supergrid' as GridContinuumMode,
    label: 'SuperGrid',
    icon: '\u229E\u207A', // Box + superscript plus
    description: 'SuperGrid: n-dimensional nested headers - Cmd+5',
    shortcut: '5',
    axisCount: 'n'
  }
] as const;

// Build a lookup map from key to mode
const KEY_TO_MODE: Record<string, GridContinuumMode> = {
  '1': 'gallery',
  '2': 'list',
  '3': 'kanban',
  '4': 'grid',
  '5': 'supergrid',
};

/**
 * GridContinuumSwitcher component
 */
export function GridContinuumSwitcher({
  currentMode,
  onModeChange,
  showTransitionFeedback = false,
  className = ''
}: GridContinuumSwitcherProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeClick = (mode: GridContinuumMode) => {
    if (mode === currentMode) return; // No-op for current mode

    setIsTransitioning(true);
    onModeChange(mode);

    // Reset transition feedback
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Keyboard shortcut handler (Cmd+1-5 on macOS, Ctrl+1-5 on Windows/Linux)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle when Cmd (macOS) or Ctrl (Windows/Linux) is pressed
    if (!(event.metaKey || event.ctrlKey)) return;

    const mode = KEY_TO_MODE[event.key];
    if (mode && mode !== currentMode) {
      event.preventDefault();
      onModeChange(mode);
    }
  }, [currentMode, onModeChange]);

  // Register global keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      role="group"
      aria-label="Grid Continuum Mode Switcher"
      className={`grid-continuum-switcher ${
        showTransitionFeedback ? 'grid-continuum-switcher--transitioning' : ''
      } ${isTransitioning ? 'grid-continuum-switcher--transitioning' : ''} ${className}`}
    >
      <div className="grid-continuum-switcher__modes">
        {GRID_CONTINUUM_MODES.map((mode) => {
          const isActive = mode.id === currentMode;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeClick(mode.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleModeClick(mode.id);
                }
              }}
              className={`grid-continuum-switcher__mode ${
                isActive ? 'active' : ''
              }`}
              aria-pressed={isActive}
              title={mode.description}
            >
              <span className="grid-continuum-switcher__mode-icon" aria-hidden="true">
                {mode.icon}
              </span>
              <span className="grid-continuum-switcher__mode-label">
                {mode.label}
              </span>
              <span className="grid-continuum-switcher__mode-axes" aria-hidden="true">
                {mode.axisCount} axis{mode.axisCount === 1 ? '' : 'es'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode progression indicator */}
      <div className="grid-continuum-switcher__progression" aria-hidden="true">
        <div
          className="grid-continuum-switcher__progression-bar"
          style={{
            width: `${(GRID_CONTINUUM_MODES.findIndex(m => m.id === currentMode) + 1) * 20}%`
          }}
        />
      </div>
    </div>
  );
}
