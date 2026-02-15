/**
 * EmbedToolbar - View switching toolbar for Isometry Embeds
 *
 * Provides controls for switching between embed types (SuperGrid, Network, Timeline)
 * and displays current filter information.
 *
 * Key patterns:
 * - contentEditable={false} prevents TipTap capturing toolbar clicks (CALL-03)
 * - Unicode escapes for icons to avoid encoding issues (CALL-02)
 * - aria-pressed for accessibility
 *
 * @see Phase 98-03: Embed Configuration UI
 */
import { memo, useCallback } from 'react';
import { EmbedType, EmbedAttributes } from '../extensions/embed-types';

/**
 * View option configuration
 */
interface ViewOption {
  type: EmbedType;
  label: string;
  icon: string;
  title: string;
}

/**
 * Available view types with icons (Unicode escapes for encoding safety)
 */
const VIEW_OPTIONS: ViewOption[] = [
  {
    type: 'supergrid',
    label: 'Grid',
    icon: '\u25A6', // Grid/table icon (U+25A6)
    title: 'SuperGrid - Dimensional pivot table',
  },
  {
    type: 'network',
    label: 'Network',
    icon: '\u2B21', // Hexagon for network node (U+2B21)
    title: 'Network Graph - Force-directed visualization',
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: '\u2794', // Arrow right (U+2794)
    title: 'Timeline - Chronological view',
  },
];

/**
 * Props for EmbedToolbar component
 */
interface EmbedToolbarProps {
  /** Current embed type */
  currentType: EmbedType;
  /** Callback to change embed type */
  onTypeChange: (type: EmbedType) => void;
  /** Current embed attributes for filter display */
  attrs: Partial<EmbedAttributes>;
}

/**
 * Format filter display from embed attributes
 */
function formatFilterDisplay(attrs: Partial<EmbedAttributes>): string | null {
  const parts: string[] = [];

  // Show PAFV projection info for SuperGrid
  if (attrs.type === 'supergrid') {
    const xAxis = attrs.xAxis || 'category';
    const xFacet = attrs.xFacet || 'folder';
    const yAxis = attrs.yAxis || 'time';
    const yFacet = attrs.yFacet || 'year';
    parts.push(`${xAxis}/${xFacet} \u00D7 ${yAxis}/${yFacet}`);
  }

  // Show time facet for Timeline
  if (attrs.type === 'timeline' && attrs.xFacet) {
    parts.push(`by ${attrs.xFacet}`);
  }

  // Show title if present
  if (attrs.title) {
    parts.unshift(attrs.title);
  }

  return parts.length > 0 ? parts.join(' \u2022 ') : null;
}

/**
 * EmbedToolbar component - controls for embed view switching
 *
 * Renders above the embed visualization with:
 * - View toggle buttons (SuperGrid, Network, Timeline)
 * - Current filter/projection display
 */
export const EmbedToolbar = memo(function EmbedToolbar({
  currentType,
  onTypeChange,
  attrs,
}: EmbedToolbarProps) {
  const filterDisplay = formatFilterDisplay({ ...attrs, type: currentType });

  const handleTypeClick = useCallback(
    (type: EmbedType) => {
      if (type !== currentType) {
        onTypeChange(type);
      }
    },
    [currentType, onTypeChange]
  );

  return (
    <div className="embed-toolbar" contentEditable={false}>
      {/* View toggle buttons */}
      <div className="embed-toolbar__views" role="tablist" aria-label="Embed view type">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.type}
            className={`embed-toolbar__view-btn ${
              currentType === option.type ? 'embed-toolbar__view-btn--active' : ''
            }`}
            onClick={() => handleTypeClick(option.type)}
            aria-pressed={currentType === option.type}
            title={option.title}
            role="tab"
            aria-selected={currentType === option.type}
          >
            <span className="embed-toolbar__view-icon">{option.icon}</span>
            <span className="embed-toolbar__view-label">{option.label}</span>
          </button>
        ))}
      </div>

      {/* Filter/projection display */}
      {filterDisplay && (
        <div className="embed-toolbar__filter" title="Current projection">
          <span className="embed-toolbar__filter-icon">{'\u0024'}</span>
          <span className="embed-toolbar__filter-text">{filterDisplay}</span>
        </div>
      )}
    </div>
  );
});

export default EmbedToolbar;
