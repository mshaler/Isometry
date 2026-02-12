/**
 * EncodingDropdown Component
 *
 * A dropdown for selecting color or size encoding properties.
 * Displays available properties with visual preview (gradient for color, scale for size).
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Palette, Maximize2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { EncodingConfig, EncodingType } from '@/types/pafv';
import type { ClassifiedProperty } from '@/services/property-classifier';

// ============================================================================
// Props
// ============================================================================

export interface EncodingDropdownProps {
  /** Label for the dropdown ("Color" or "Size") */
  label: string;
  /** Current encoding config or null */
  value: EncodingConfig | null;
  /** Available properties to encode */
  availableProperties: ClassifiedProperty[];
  /** Callback when encoding changes */
  onChange: (config: EncodingConfig | null) => void;
  /** Encoding type determines icon and filtering */
  encodingType: 'color' | 'size';
}

// ============================================================================
// Color Scales
// ============================================================================

/** Default color scales for different encoding types */
const COLOR_SCALES = {
  numeric: ['#3B82F6', '#8B5CF6', '#EF4444'], // blue → purple → red
  categorical: ['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EF4444', '#06B6D4'],
  ordinal: ['#93C5FD', '#3B82F6', '#1D4ED8'], // light blue → dark blue
};

// ============================================================================
// Component
// ============================================================================

export function EncodingDropdown({
  label,
  value,
  availableProperties,
  onChange,
  encodingType,
}: EncodingDropdownProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Filter properties based on encoding type
  const filteredProperties = availableProperties.filter(prop => {
    if (encodingType === 'size') {
      // Size encoding only works with numeric properties
      return prop.facetType === 'number';
    }
    // Color encoding works with all types
    return true;
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine encoding type from property facet type
  const getEncodingType = (prop: ClassifiedProperty): EncodingType => {
    if (prop.facetType === 'number') return 'numeric';
    if (prop.facetType === 'select' || prop.facetType === 'multi_select') return 'categorical';
    return 'ordinal';
  };

  // Handle property selection
  const handleSelect = (prop: ClassifiedProperty | null) => {
    if (!prop) {
      onChange(null);
    } else {
      onChange({
        property: prop.sourceColumn,
        type: getEncodingType(prop),
      });
    }
    setIsOpen(false);
  };

  // Get display name for current value
  const getDisplayName = (): string => {
    if (!value) return 'None';
    const prop = availableProperties.find(p => p.sourceColumn === value.property);
    return prop?.name || value.property;
  };

  // Render gradient preview for color encoding
  const renderColorPreview = (type: EncodingType) => {
    const colors = COLOR_SCALES[type];
    return (
      <div
        className="w-12 h-3 rounded-sm"
        style={{
          background: `linear-gradient(to right, ${colors.join(', ')})`,
        }}
      />
    );
  };

  // Theme-aware styling
  const buttonClasses = `
    w-full px-3 py-1.5 flex items-center justify-between gap-2
    text-sm rounded transition-colors
    ${isNeXTSTEP
      ? 'bg-[#d4d4d4] border-t border-l border-[#ffffff] border-b border-r border-b-[#707070] border-r-[#707070]'
      : 'bg-white border border-gray-200 hover:bg-gray-50'
    }
  `;

  const dropdownClasses = `
    absolute top-full left-0 right-0 mt-1 z-50
    rounded shadow-lg max-h-60 overflow-y-auto
    transition-all duration-150 ease-out
    ${isNeXTSTEP
      ? 'bg-[#d4d4d4] border border-[#707070]'
      : 'bg-white border border-gray-200'
    }
    ${isOpen
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 -translate-y-2 pointer-events-none'
    }
  `;

  const optionClasses = (isSelected: boolean) => `
    w-full px-3 py-2 flex items-center justify-between gap-2
    text-sm text-left transition-colors cursor-pointer
    ${isSelected
      ? isNeXTSTEP
        ? 'bg-[#4A90D9] text-white'
        : 'bg-blue-50 text-blue-700'
      : isNeXTSTEP
        ? 'hover:bg-[#c0c0c0]'
        : 'hover:bg-gray-50'
    }
  `;

  const labelClasses = `
    text-[10px] font-medium uppercase tracking-wide mb-1
    ${isNeXTSTEP ? 'text-[#404040]' : 'text-gray-500'}
  `;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={labelClasses}>
        {encodingType === 'color' ? (
          <span className="flex items-center gap-1">
            <Palette className="w-3 h-3" />
            {label}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Maximize2 className="w-3 h-3" />
            {label}
          </span>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClasses}
        type="button"
      >
        <span className="flex items-center gap-2 truncate">
          {value && encodingType === 'color' && renderColorPreview(value.type)}
          <span>{getDisplayName()}</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={dropdownClasses}>
        {/* None option */}
        <button
          onClick={() => handleSelect(null)}
          className={optionClasses(value === null)}
          type="button"
        >
          <span>None</span>
        </button>

        {/* Divider */}
        {filteredProperties.length > 0 && (
          <div className={`border-t ${isNeXTSTEP ? 'border-[#909090]' : 'border-gray-200'}`} />
        )}

        {/* Property options */}
        {filteredProperties.map(prop => {
          const isSelected = value?.property === prop.sourceColumn;
          const encType = getEncodingType(prop);

          return (
            <button
              key={prop.id}
              onClick={() => handleSelect(prop)}
              className={optionClasses(isSelected)}
              type="button"
            >
              <span className="flex items-center gap-2 truncate">
                {encodingType === 'color' && renderColorPreview(encType)}
                <span>{prop.name}</span>
              </span>
              <span className={`text-xs ${isNeXTSTEP ? 'text-[#707070]' : 'text-gray-400'}`}>
                {encType}
              </span>
            </button>
          );
        })}

        {/* Empty state */}
        {filteredProperties.length === 0 && (
          <div className={`px-3 py-2 text-sm ${isNeXTSTEP ? 'text-[#707070]' : 'text-gray-400'}`}>
            No {encodingType === 'size' ? 'numeric ' : ''}properties available
          </div>
        )}
      </div>
    </div>
  );
}
