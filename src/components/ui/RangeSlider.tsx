import { useRef, useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export interface RangeSliderProps {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Current range value [min, max] */
  value: [number, number];
  /** Callback when range changes */
  onChange: (value: [number, number]) => void;
  /** Step increment (default: 1) */
  step?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accent color for the track (hex) */
  accentColor?: string;
}

/**
 * RangeSlider - Dual-thumb range slider component
 *
 * Replaces broken overlapping <input type="range"> pattern.
 * Provides proper event handling for both thumbs without conflicts.
 */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  className = '',
  accentColor,
}: RangeSliderProps) {
  const { theme } = useTheme();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Calculate percentage position from value
  const valueToPercent = useCallback(
    (val: number) => ((val - min) / (max - min)) * 100,
    [min, max]
  );

  // Calculate value from percentage
  const percentToValue = useCallback(
    (percent: number) => {
      const rawValue = (percent / 100) * (max - min) + min;
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step]
  );

  // Get percentage from mouse/touch position
  const getPercentFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const percent = ((clientX - rect.left) / rect.width) * 100;
      return Math.max(0, Math.min(100, percent));
    },
    []
  );

  // Handle thumb drag
  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;

      const percent = getPercentFromEvent(clientX);
      const newValue = percentToValue(percent);

      if (dragging === 'min') {
        // Ensure min doesn't exceed max
        const clampedValue = Math.min(newValue, value[1] - step);
        if (clampedValue !== value[0]) {
          onChange([clampedValue, value[1]]);
        }
      } else {
        // Ensure max doesn't go below min
        const clampedValue = Math.max(newValue, value[0] + step);
        if (clampedValue !== value[1]) {
          onChange([value[0], clampedValue]);
        }
      }
    },
    [dragging, getPercentFromEvent, percentToValue, value, onChange, step]
  );

  // Mouse event handlers
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMove]);

  // Touch event handlers
  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setDragging(null);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, handleMove]);

  const minPercent = valueToPercent(value[0]);
  const maxPercent = valueToPercent(value[1]);

  // Theme-aware colors
  const trackBg = isNeXTSTEP ? 'bg-[#3A3A3A]' : 'bg-gray-200';
  const thumbBg = isNeXTSTEP ? 'bg-[#E0E0E0]' : 'bg-white';
  const thumbBorder = isNeXTSTEP ? 'border-[#555]' : 'border-gray-300';
  const thumbHover = isNeXTSTEP ? 'hover:bg-[#F0F0F0]' : 'hover:bg-gray-50';
  const activeColor = accentColor || (isNeXTSTEP ? '#4A90D9' : '#3B82F6');

  return (
    <div className={`relative h-6 flex items-center ${className}`}>
      {/* Track background */}
      <div
        ref={trackRef}
        className={`absolute w-full h-2 ${trackBg} rounded-full`}
      />

      {/* Active range highlight */}
      <div
        className="absolute h-2 rounded-full"
        style={{
          left: `${minPercent}%`,
          width: `${maxPercent - minPercent}%`,
          backgroundColor: activeColor,
        }}
      />

      {/* Min thumb */}
      <div
        className={`
          absolute w-4 h-4 -ml-2 rounded-full cursor-pointer
          ${thumbBg} border-2 ${thumbBorder} ${thumbHover}
          shadow-sm transition-transform
          ${dragging === 'min' ? 'scale-110 z-20' : 'z-10'}
        `}
        style={{ left: `${minPercent}%` }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging('min');
        }}
        onTouchStart={() => setDragging('min')}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={value[1]}
        aria-valuenow={value[0]}
        aria-label="Minimum value"
        tabIndex={0}
      />

      {/* Max thumb */}
      <div
        className={`
          absolute w-4 h-4 -ml-2 rounded-full cursor-pointer
          ${thumbBg} border-2 ${thumbBorder} ${thumbHover}
          shadow-sm transition-transform
          ${dragging === 'max' ? 'scale-110 z-20' : 'z-10'}
        `}
        style={{ left: `${maxPercent}%` }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging('max');
        }}
        onTouchStart={() => setDragging('max')}
        role="slider"
        aria-valuemin={value[0]}
        aria-valuemax={max}
        aria-valuenow={value[1]}
        aria-label="Maximum value"
        tabIndex={0}
      />
    </div>
  );
}
