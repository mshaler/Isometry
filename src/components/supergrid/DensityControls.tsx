/**
 * DensityControls - Janus Density Model UI Controls
 *
 * Simple, focused controls for the two orthogonal density dimensions:
 * - Value Density (Zoom): Collapse leaf values into parents (slider)
 * - Extent Density (Pan): Hide/show empty cells (toggle buttons)
 *
 * This is a pure UI control component. Data transformation is handled
 * by generateDensityQuery and filterEmptyCells in DataManager.
 */

import React, { useCallback } from 'react';
import type { ExtentMode } from '@/d3/SuperGridEngine/DataManager';

export interface DensityControlsProps {
  /** Current value density level (0 = leaf, higher = more collapsed) */
  valueDensity: number;
  /** Maximum value density level based on axis hierarchy depth */
  maxValueLevel: number;
  /** Current extent density mode */
  extentDensity: ExtentMode;
  /** Callback when value density slider changes */
  onValueDensityChange: (level: number) => void;
  /** Callback when extent density mode changes */
  onExtentDensityChange: (mode: ExtentMode) => void;
  /** Optional label for value density (default: shows current level) */
  valueDensityLabel?: string;
  /** Disabled state */
  disabled?: boolean;
}

const EXTENT_MODES: { value: ExtentMode; label: string }[] = [
  { value: 'dense', label: 'Dense' },
  { value: 'sparse', label: 'Sparse' },
  { value: 'ultra-sparse', label: 'Ultra-Sparse' },
];

/**
 * DensityControls: Janus density model UI
 *
 * Provides two orthogonal controls:
 * 1. Value Density slider (0 to maxValueLevel)
 * 2. Extent Density toggle (dense | sparse | ultra-sparse)
 */
export function DensityControls({
  valueDensity,
  maxValueLevel,
  extentDensity,
  onValueDensityChange,
  onExtentDensityChange,
  valueDensityLabel,
  disabled = false,
}: DensityControlsProps) {
  // Handle slider change
  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(event.target.value, 10);
      onValueDensityChange(newValue);
    },
    [onValueDensityChange]
  );

  // Handle extent mode button click
  const handleExtentClick = useCallback(
    (mode: ExtentMode) => {
      if (!disabled) {
        onExtentDensityChange(mode);
      }
    },
    [onExtentDensityChange, disabled]
  );

  return (
    <div className="density-controls" data-testid="density-controls">
      {/* Value Density Slider */}
      <div className="density-controls__section">
        <label className="density-controls__label" htmlFor="value-density-slider">
          Value Density
          {valueDensityLabel && (
            <span className="density-controls__label-detail">
              {valueDensityLabel}
            </span>
          )}
        </label>
        <div className="density-controls__slider-container">
          <input
            id="value-density-slider"
            type="range"
            role="slider"
            min={0}
            max={maxValueLevel}
            value={valueDensity}
            onChange={handleSliderChange}
            disabled={disabled}
            aria-label="Value Density Level"
            aria-valuemin={0}
            aria-valuemax={maxValueLevel}
            aria-valuenow={valueDensity}
            className="density-controls__slider"
          />
          <span className="density-controls__value">{valueDensity}</span>
        </div>
      </div>

      {/* Extent Density Toggle */}
      <div className="density-controls__section">
        <label className="density-controls__label">Extent Density</label>
        <div
          className="density-controls__toggle-group"
          role="group"
          aria-label="Extent Density Mode"
        >
          {EXTENT_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`density-controls__toggle-button ${
                extentDensity === value ? 'density-controls__toggle-button--active' : ''
              }`}
              onClick={() => handleExtentClick(value)}
              disabled={disabled}
              data-active={extentDensity === value}
              aria-pressed={extentDensity === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .density-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 12px;
          background: var(--supergrid-control-bg, #f8f9fa);
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .density-controls__section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .density-controls__label {
          font-size: 12px;
          font-weight: 600;
          color: var(--supergrid-label-color, #374151);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .density-controls__label-detail {
          font-weight: 400;
          color: var(--supergrid-label-detail, #6b7280);
        }

        .density-controls__slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .density-controls__slider {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: var(--supergrid-slider-track, #e5e7eb);
          appearance: none;
          cursor: pointer;
        }

        .density-controls__slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--supergrid-slider-thumb, #3b82f6);
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .density-controls__slider:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .density-controls__value {
          font-size: 14px;
          font-weight: 500;
          color: var(--supergrid-value-color, #1f2937);
          min-width: 20px;
          text-align: center;
        }

        .density-controls__toggle-group {
          display: flex;
          gap: 4px;
          background: var(--supergrid-toggle-bg, #e5e7eb);
          border-radius: 6px;
          padding: 4px;
        }

        .density-controls__toggle-button {
          flex: 1;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--supergrid-toggle-text, #4b5563);
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .density-controls__toggle-button:hover:not(:disabled) {
          background: var(--supergrid-toggle-hover, rgba(255, 255, 255, 0.5));
        }

        .density-controls__toggle-button--active,
        .density-controls__toggle-button[data-active="true"] {
          background: var(--supergrid-toggle-active-bg, white);
          color: var(--supergrid-toggle-active-text, #1f2937);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .density-controls__toggle-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default DensityControls;
