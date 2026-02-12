import { useState } from 'react';
import { usePAFV } from '@/state/PAFVContext';
import { DENSITY_LEVEL_INFO, type DensityLevel } from '@/types/pafv';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * DensitySlider - Janus model vertical slider for sparse ↔ dense control
 *
 * 4-notch semantic levels:
 * 1. Value Sparsity — Full Cartesian product, every intersection shown
 * 2. Extent Density — Populated-only, hide empty rows/columns
 * 3. View Density — Matrix view, aggregation rows visible
 * 4. Region Density — Mixed sparse + dense regions
 *
 * Design adapted from Figma export (DensitySlider.tsx)
 */
export function DensitySlider() {
  const { state, setDensityLevel } = usePAFV();
  const { theme } = useTheme();
  const [hoveredLevel, setHoveredLevel] = useState<DensityLevel | null>(null);

  const densityLevels: DensityLevel[] = [4, 3, 2, 1]; // Top to bottom: Dense → Sparse

  // Theme-aware colors
  const isNeXTSTEP = theme === 'NeXTSTEP';
  const bgColor = isNeXTSTEP ? 'bg-[#2D2D2D]' : 'bg-gray-100';
  const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';
  const textColor = isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-900';
  const mutedColor = isNeXTSTEP ? 'text-[#999]' : 'text-gray-500';
  const trackBg = isNeXTSTEP
    ? 'bg-gradient-to-b from-[#3A3A3A] to-[#1E1E1E]'
    : 'bg-gradient-to-b from-gray-300 to-gray-100';

  return (
    <div className="flex flex-col items-center h-full py-2">
      {/* Dense Label (top) */}
      <div className="text-center mb-2">
        <div className={`text-[10px] font-mono ${mutedColor} uppercase tracking-wide`}>
          Dense
        </div>
        <div className={textColor}>▦</div>
      </div>

      {/* Vertical Slider Track */}
      <div
        className={`
          relative flex-1 w-10 ${trackBg} rounded-lg border ${borderColor}
          min-h-[120px] max-h-[200px]
        `}
      >
        {/* Notch positions */}
        {densityLevels.map((level, index) => {
          const positionPercent = (index / (densityLevels.length - 1)) * 100;
          const isActive = state.densityLevel === level;
          const isHovered = hoveredLevel === level;
          const info = DENSITY_LEVEL_INFO[level];

          return (
            <button
              key={level}
              onClick={() => setDensityLevel(level)}
              onMouseEnter={() => setHoveredLevel(level)}
              onMouseLeave={() => setHoveredLevel(null)}
              className="absolute left-1/2 -translate-x-1/2 w-8 h-6 flex items-center justify-center cursor-pointer group"
              style={{ top: `calc(${positionPercent}% - 12px)` }}
              title={`${info.label}: ${info.description}`}
            >
              {/* Tick mark */}
              <div
                className={`
                  w-6 h-1 rounded transition-all
                  ${isActive ? 'bg-[#4A90D9]' : isNeXTSTEP ? 'bg-[#666]' : 'bg-gray-400'}
                  ${isHovered && !isActive ? 'scale-110 bg-[#4A90D9]/50' : ''}
                `}
              />

              {/* Active level indicator */}
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-mono font-bold text-white bg-[#4A90D9] rounded-full w-4 h-4 flex items-center justify-center">
                    {level}
                  </span>
                </div>
              )}

              {/* Hover tooltip - positioned to the left */}
              {isHovered && (
                <div
                  className={`
                    absolute right-full mr-2 w-36 ${bgColor} border ${borderColor}
                    rounded p-2 shadow-lg pointer-events-none z-50
                  `}
                >
                  <div className={`text-[10px] font-semibold ${textColor} mb-0.5`}>
                    {info.label}
                  </div>
                  <div className={`text-[9px] ${mutedColor} leading-tight`}>
                    {info.description}
                  </div>
                </div>
              )}
            </button>
          );
        })}

        {/* Active position ring indicator */}
        <div
          className="absolute left-1/2 w-8 h-8 rounded-full bg-[#4A90D9]/20 border-2 border-[#4A90D9] transition-all duration-300 pointer-events-none"
          style={{
            top: `calc(${(densityLevels.indexOf(state.densityLevel) / (densityLevels.length - 1)) * 100}% - 16px)`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Sparse Label (bottom) */}
      <div className="text-center mt-2">
        <div className={textColor}>◻</div>
        <div className={`text-[10px] font-mono ${mutedColor} uppercase tracking-wide`}>
          Sparse
        </div>
      </div>

      {/* Current level info */}
      <div className={`mt-2 p-1.5 ${bgColor} border ${borderColor} rounded text-center w-full max-w-[80px]`}>
        <div className={`text-[9px] font-mono ${mutedColor} uppercase tracking-wide`}>
          L{state.densityLevel}
        </div>
        <div className={`text-[10px] ${textColor} truncate`}>
          {DENSITY_LEVEL_INFO[state.densityLevel].label.split(' ')[0]}
        </div>
      </div>
    </div>
  );
}
