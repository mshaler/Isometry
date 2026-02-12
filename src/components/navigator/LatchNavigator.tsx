/**
 * LatchNavigator Component
 *
 * 6-column grid layout for LATCH+GRAPH property buckets.
 * Each column shows a header with icon/count and a vertical list of property chips with checkboxes.
 * Matches Figma design specification for Navigator 1.
 *
 * Layout:
 * ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
 * │    L    │    A    │    T    │    C    │    H    │  GRAPH  │
 * ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
 * │ ☐ prop1 │ ☐ prop1 │ ☐ prop1 │ ☐ prop1 │ ☐ prop1 │ ☐ prop1 │
 * │ ☑ prop2 │ ☑ prop2 │ ☑ prop2 │ ☑ prop2 │ ☑ prop2 │ ☑ prop2 │
 * └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, SortAsc, Clock, Tag, GitBranch, Network } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePropertyClassification } from '@/hooks/data/usePropertyClassification';
import type { ClassifiedProperty, PropertyBucket } from '@/services/property-classifier';

// ============================================================================
// Constants
// ============================================================================

/** Column configuration for LATCH+GRAPH buckets */
const LATCH_COLUMNS: Array<{
  key: PropertyBucket;
  label: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { key: 'L', label: 'Location', icon: <MapPin className="w-3.5 h-3.5" />, color: '#22C55E' },
  { key: 'A', label: 'Alphabet', icon: <SortAsc className="w-3.5 h-3.5" />, color: '#3B82F6' },
  { key: 'T', label: 'Time', icon: <Clock className="w-3.5 h-3.5" />, color: '#8B5CF6' },
  { key: 'C', label: 'Category', icon: <Tag className="w-3.5 h-3.5" />, color: '#F59E0B' },
  { key: 'H', label: 'Hierarchy', icon: <GitBranch className="w-3.5 h-3.5" />, color: '#EF4444' },
  { key: 'GRAPH', label: 'Graph', icon: <Network className="w-3.5 h-3.5" />, color: '#06B6D4' },
];

// ============================================================================
// PropertyChip Component
// ============================================================================

interface PropertyChipProps {
  property: ClassifiedProperty;
  checked: boolean;
  color: string;
  onToggle: () => void;
  isGraph?: boolean;
}

function PropertyChip({ property, checked, color, onToggle, isGraph = false }: PropertyChipProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  return (
    <label
      className={`
        group relative flex items-center gap-1.5 h-6 px-1.5 cursor-pointer
        transition-all duration-150 text-[11px]
        ${checked
          ? isNeXTSTEP
            ? 'bg-[#505050]'
            : 'bg-blue-50'
          : isNeXTSTEP
            ? 'hover:bg-[#3A3A3A]'
            : 'hover:bg-gray-100'
        }
      `}
      style={{
        borderLeft: `2px solid ${checked ? color : 'transparent'}`,
      }}
      title={isGraph ? 'Graph properties (axis mapping coming soon)' : property.name}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-3 h-3 accent-blue-500 cursor-pointer"
        disabled={isGraph}
      />
      <span className={`
        truncate flex-1
        ${isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-700'}
        ${checked ? 'font-medium' : 'opacity-80'}
      `}>
        {property.name}
      </span>
    </label>
  );
}

// ============================================================================
// LatchNavigator Component
// ============================================================================

export interface LatchNavigatorProps {
  /** Callback when a property's enabled state changes */
  onPropertyToggle?: (propertyId: string, enabled: boolean) => void;
  /** Set of enabled property IDs (external control) */
  enabledProperties?: Set<string>;
}

export function LatchNavigator({ onPropertyToggle, enabledProperties }: LatchNavigatorProps) {
  const { theme } = useTheme();
  const { classification, isLoading, error } = usePropertyClassification();

  // Local state for checked properties (if not externally controlled)
  const [localEnabled, setLocalEnabled] = useState<Set<string>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState<Set<PropertyBucket>>(new Set());

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Use external or local enabled set
  const enabled = enabledProperties ?? localEnabled;

  // Toggle column collapse
  const toggleColumn = (columnKey: PropertyBucket) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  // Toggle property enabled state
  const toggleProperty = (property: ClassifiedProperty) => {
    if (onPropertyToggle) {
      onPropertyToggle(property.id, !enabled.has(property.id));
    } else {
      setLocalEnabled(prev => {
        const next = new Set(prev);
        if (next.has(property.id)) {
          next.delete(property.id);
        } else {
          next.add(property.id);
        }
        return next;
      });
    }
  };

  // Container styling
  const containerClasses = `
    w-full max-h-44 overflow-y-auto
    ${isNeXTSTEP
      ? 'bg-[#252525] border-b border-[#3A3A3A]'
      : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }
  `;

  // Loading state
  if (isLoading) {
    return (
      <div className={containerClasses.trim().replace(/\s+/g, ' ')}>
        <div className={`p-2 text-xs ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-500'}`}>
          Loading properties...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={containerClasses.trim().replace(/\s+/g, ' ')}>
        <div className="p-2 text-xs text-red-500">Error: {error}</div>
      </div>
    );
  }

  // No data
  if (!classification) {
    return null;
  }

  return (
    <div className={containerClasses.trim().replace(/\s+/g, ' ')}>
      <div className="grid grid-cols-6 gap-0.5 p-1">
        {LATCH_COLUMNS.map((column) => {
          const properties = classification[column.key] || [];
          const enabledCount = properties.filter(p => enabled.has(p.id)).length;
          const isCollapsed = collapsedColumns.has(column.key);
          const isGraph = column.key === 'GRAPH';

          return (
            <div
              key={column.key}
              className={`
                flex flex-col overflow-hidden rounded
                ${isNeXTSTEP ? 'bg-[#2D2D2D]' : 'bg-gray-50'}
              `}
            >
              {/* Column Header */}
              <button
                onClick={() => toggleColumn(column.key)}
                className={`
                  flex items-center justify-between px-1.5 py-1 min-h-[28px]
                  transition-colors
                  ${isNeXTSTEP ? 'hover:bg-[#3A3A3A]' : 'hover:bg-gray-100'}
                `}
                style={{ borderBottom: `2px solid ${column.color}` }}
                type="button"
              >
                <div className="flex items-center gap-1">
                  <span style={{ color: column.color }}>{column.icon}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${
                    isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-700'
                  }`}>
                    {column.key === 'GRAPH' ? 'G' : column.key}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-500'}`}>
                    {enabledCount}/{properties.length}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className={`w-3 h-3 ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'}`} />
                  ) : (
                    <ChevronDown className={`w-3 h-3 ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'}`} />
                  )}
                </div>
              </button>

              {/* Property List */}
              {!isCollapsed && (
                <div className="flex flex-col overflow-y-auto max-h-24">
                  {properties.length === 0 ? (
                    <div className={`px-1.5 py-1 text-[10px] italic ${
                      isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'
                    }`}>
                      No properties
                    </div>
                  ) : (
                    properties.map(property => (
                      <PropertyChip
                        key={property.id}
                        property={property}
                        checked={enabled.has(property.id)}
                        color={column.color}
                        onToggle={() => toggleProperty(property)}
                        isGraph={isGraph}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
