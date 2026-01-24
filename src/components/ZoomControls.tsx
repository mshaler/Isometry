/**
 * ZoomControls - Zoom in/out controls with scale display
 *
 * Plus/minus buttons to adjust zoom level.
 * Current zoom level displayed as percentage.
 *
 * @module components/ZoomControls
 */

import React from 'react';
import '../styles/ZoomControls.css';

export interface ZoomControlsProps {
  /** Current zoom scale (1.0 = 100%) */
  currentScale: number;

  /** Callback when zoom changes */
  onZoom: (scale: number) => void;

  /** Minimum zoom level (default: 0.1) */
  minScale?: number;

  /** Maximum zoom level (default: 10.0) */
  maxScale?: number;

  /** Zoom step increment (default: 0.1) */
  zoomStep?: number;
}

/**
 * ZoomControls component - adjust grid zoom level.
 *
 * @example
 * ```tsx
 * <ZoomControls
 *   currentScale={1.5}
 *   onZoom={(scale) => console.log('New zoom:', scale)}
 * />
 * ```
 */
export function ZoomControls({
  currentScale,
  onZoom,
  minScale = 0.1,
  maxScale = 10.0,
  zoomStep = 0.1,
}: ZoomControlsProps) {
  const handleZoomIn = () => {
    const newScale = Math.min(currentScale + zoomStep, maxScale);
    onZoom(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(currentScale - zoomStep, minScale);
    onZoom(newScale);
  };

  const handleReset = () => {
    onZoom(1.0);
  };

  const canZoomIn = currentScale < maxScale;
  const canZoomOut = currentScale > minScale;
  const isAtDefault = Math.abs(currentScale - 1.0) < 0.01;

  // Format scale as percentage
  const scalePercent = Math.round(currentScale * 100);

  return (
    <div className="zoom-controls" role="group" aria-label="Zoom controls">
      <div className="zoom-buttons">
        {/* Zoom out button */}
        <button
          className="zoom-button"
          onClick={handleZoomOut}
          disabled={!canZoomOut}
          aria-label="Zoom out"
          title={`Zoom out (${Math.round((currentScale - zoomStep) * 100)}%)`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <line
              x1="4"
              y1="8"
              x2="12"
              y2="8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Current zoom display (clickable to reset) */}
        <button
          className={`zoom-display ${isAtDefault ? 'default' : ''}`}
          onClick={handleReset}
          aria-label={`Current zoom: ${scalePercent}%. Click to reset to 100%`}
          title={isAtDefault ? 'Zoom at 100%' : 'Click to reset to 100%'}
        >
          {scalePercent}%
        </button>

        {/* Zoom in button */}
        <button
          className="zoom-button"
          onClick={handleZoomIn}
          disabled={!canZoomIn}
          aria-label="Zoom in"
          title={`Zoom in (${Math.round((currentScale + zoomStep) * 100)}%)`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <line
              x1="8"
              y1="4"
              x2="8"
              y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="4"
              y1="8"
              x2="12"
              y2="8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Optional: Zoom slider for future enhancement */}
      {/* <input
        type="range"
        className="zoom-slider"
        min={minScale}
        max={maxScale}
        step={zoomStep}
        value={currentScale}
        onChange={(e) => onZoom(Number(e.target.value))}
        aria-label="Zoom slider"
      /> */}
    </div>
  );
}

export default ZoomControls;
