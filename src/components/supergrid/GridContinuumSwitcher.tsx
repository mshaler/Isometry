/**
 * Grid Continuum Switcher - Mode switching UI component
 *
 * Provides a visual switcher for the 5 Grid Continuum modes:
 * Gallery (0) → List (1) → Kanban (1 facet) → Grid (2) → SuperGrid (n)
 *
 * Each mode represents a different PAFV axis allocation strategy for the same data.
 */

import { useState } from 'react';
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

// Mode definitions with metadata
const GRID_CONTINUUM_MODES = [
  {
    id: 'gallery' as GridContinuumMode,
    label: 'Gallery',
    icon: '⊞',
    description: 'Gallery: position-only layout (masonry)',
    axisCount: 0
  },
  {
    id: 'list' as GridContinuumMode,
    label: 'List',
    icon: '≡',
    description: 'List: single axis vertical hierarchy',
    axisCount: 1
  },
  {
    id: 'kanban' as GridContinuumMode,
    label: 'Kanban',
    icon: '⫽',
    description: 'Kanban: facet-based column grouping',
    axisCount: 1
  },
  {
    id: 'grid' as GridContinuumMode,
    label: 'Grid',
    icon: '⊞',
    description: 'Grid: 2D row × column matrix',
    axisCount: 2
  },
  {
    id: 'supergrid' as GridContinuumMode,
    label: 'SuperGrid',
    icon: '⊞⁺',
    description: 'SuperGrid: n-dimensional nested headers',
    axisCount: 'n'
  }
] as const;

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

