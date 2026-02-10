/**
 * OriginPatternSelector - Toggle between Anchor and Bipolar origin patterns
 *
 * Two preset buttons: Anchor (spreadsheet) and Bipolar (semantic matrix).
 * Includes visual preview diagrams showing where (0,0) is located.
 *
 * @module components/OriginPatternSelector
 */

import type { OriginPattern } from '../types/coordinates';
import '../styles/OriginPatternSelector.css';

export interface OriginPatternSelectorProps {
  /** Current origin pattern */
  currentPattern: OriginPattern;

  /** Callback when pattern changes */
  onPatternChange: (pattern: OriginPattern) => void;
}

/**
 * OriginPatternSelector component - toggle origin patterns.
 *
 * @example
 * ```tsx
 * <OriginPatternSelector
 *   currentPattern="anchor"
 *   onPatternChange={(pattern) => console.warn('Pattern:', pattern)}
 * />
 * ```
 */
export function OriginPatternSelector({
  currentPattern,
  onPatternChange,
}: OriginPatternSelectorProps) {
  return (
    <div className="origin-selector" role="group" aria-label="Origin pattern selection">
      {/* Anchor pattern button */}
      <button
        className={`origin-button ${currentPattern === 'anchor' ? 'active' : ''}`}
        onClick={() => onPatternChange('anchor')}
        aria-pressed={currentPattern === 'anchor'}
        title="Anchor: (0,0) at top-left corner (spreadsheet layout)"
      >
        <div className="origin-button-content">
          <div className="origin-icon">
            {/* Spreadsheet icon: grid with origin at corner */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Grid lines */}
              <line x1="10" y1="4" x2="10" y2="28" stroke="currentColor" strokeWidth="1" />
              <line x1="18" y1="4" x2="18" y2="28" stroke="currentColor" strokeWidth="1" />
              <line x1="26" y1="4" x2="26" y2="28" stroke="currentColor" strokeWidth="1" />
              <line x1="4" y1="10" x2="28" y2="10" stroke="currentColor" strokeWidth="1" />
              <line x1="4" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="1" />
              <line x1="4" y1="26" x2="28" y2="26" stroke="currentColor" strokeWidth="1" />
              {/* Origin marker at top-left */}
              <circle cx="10" cy="10" r="3" fill="currentColor" />
              <text
                x="12"
                y="8"
                fontSize="6"
                fill="currentColor"
                fontFamily="var(--cb-font-mono)"
              >
                (0,0)
              </text>
            </svg>
          </div>
          <div className="origin-label">Anchor</div>
          <div className="origin-description">Corner origin</div>
        </div>
      </button>

      {/* Bipolar pattern button */}
      <button
        className={`origin-button ${currentPattern === 'bipolar' ? 'active' : ''}`}
        onClick={() => onPatternChange('bipolar')}
        aria-pressed={currentPattern === 'bipolar'}
        title="Bipolar: (0,0) at center (semantic matrix like Eisenhower)"
      >
        <div className="origin-button-content">
          <div className="origin-icon">
            {/* Matrix icon: grid with origin at center */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Quadrant lines */}
              <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
              <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="2" />
              {/* Origin marker at center */}
              <circle cx="16" cy="16" r="3" fill="currentColor" />
              <text
                x="18"
                y="14"
                fontSize="6"
                fill="currentColor"
                fontFamily="var(--cb-font-mono)"
              >
                (0,0)
              </text>
              {/* Quadrant labels */}
              <text x="20" y="12" fontSize="8" fill="currentColor" opacity="0.5">
                Q1
              </text>
              <text x="8" y="12" fontSize="8" fill="currentColor" opacity="0.5">
                Q2
              </text>
              <text x="8" y="24" fontSize="8" fill="currentColor" opacity="0.5">
                Q3
              </text>
              <text x="20" y="24" fontSize="8" fill="currentColor" opacity="0.5">
                Q4
              </text>
            </svg>
          </div>
          <div className="origin-label">Bipolar</div>
          <div className="origin-description">Center origin</div>
        </div>
      </button>
    </div>
  );
}

export default OriginPatternSelector;
