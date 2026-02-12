import { useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { RangeSlider } from './ui/RangeSlider';
import { useTimeDistribution, useFacetValues } from '@/hooks';
import { LATCHFilterService } from '../services/query/LATCHFilterService';
import { MapPin, Type, Clock, Tag, BarChart2, X, ChevronUp, ChevronDown } from 'lucide-react';

export interface LATCHSlidersProps {
  filterService: LATCHFilterService;
  onFilterChange?: () => void;
  className?: string;
}

/**
 * LATCHSliders - Bottom panel with LATCH filter sliders
 *
 * Provides interactive filtering controls for each LATCH axis:
 * - Location: Text DSL input (placeholder for mini-map)
 * - Alphabet: Search + property selector
 * - Time: Histogram + date range slider
 * - Category: Multi-facet chip selection
 * - Hierarchy: Gradient bar + numeric range slider
 */
export function LATCHSliders({
  filterService,
  onFilterChange,
  className = '',
}: LATCHSlidersProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Panel expansion state
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter states
  const [locationQuery, setLocationQuery] = useState('');
  const [alphabetSearch, setAlphabetSearch] = useState('');
  const [alphabetProperty, setAlphabetProperty] = useState('name');
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [hierarchyRange, setHierarchyRange] = useState<[number, number]>([1, 5]);
  const [hierarchyProperty, setHierarchyProperty] = useState('priority');

  // Data hooks
  const timeDistribution = useTimeDistribution('created_at');
  const folderFacets = useFacetValues('folder');
  const tagsFacets = useFacetValues('tags');
  const statusFacets = useFacetValues('status');

  // Theme-aware styling
  const bgColor = isNeXTSTEP ? 'bg-[#252525]' : 'bg-white';
  const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';
  const textColor = isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-900';
  const mutedColor = isNeXTSTEP ? 'text-[#999]' : 'text-gray-500';
  const inputBg = isNeXTSTEP ? 'bg-[#2D2D2D]' : 'bg-gray-100';
  const hoverBg = isNeXTSTEP ? 'hover:bg-[#3A3A3A]' : 'hover:bg-gray-50';

  // LATCH column colors
  const latchColors = {
    L: '#22C55E', // green
    A: '#3B82F6', // blue
    T: '#F59E0B', // amber
    C: '#A855F7', // purple
    H: '#EF4444', // red
  };

  // Clear filter handler
  const handleClearFilter = useCallback((axis: 'L' | 'A' | 'T' | 'C' | 'H') => {
    switch (axis) {
      case 'L':
        setLocationQuery('');
        break;
      case 'A':
        setAlphabetSearch('');
        break;
      case 'T':
        setTimeRange([0, 100]);
        break;
      case 'C':
        setSelectedCategories(new Set());
        break;
      case 'H':
        setHierarchyRange([1, 5]);
        break;
    }
    // Clear all filters for this axis
    filterService.clearFilters(axis);
    onFilterChange?.();
  }, [filterService, onFilterChange]);

  // Time range change handler
  const handleTimeRangeChange = useCallback((newRange: [number, number]) => {
    setTimeRange(newRange);
    if (timeDistribution.minDate && timeDistribution.maxDate) {
      const minTime = timeDistribution.minDate.getTime();
      const maxTime = timeDistribution.maxDate.getTime();
      const range = maxTime - minTime;
      const startDate = new Date(minTime + (newRange[0] / 100) * range);
      const endDate = new Date(minTime + (newRange[1] / 100) * range);

      filterService.addFilter(
        'T',
        'created_at',
        'range',
        [startDate.toISOString(), endDate.toISOString()],
        `Time: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      );
      onFilterChange?.();
    }
  }, [timeDistribution, filterService, onFilterChange]);

  // Category selection handler
  const handleCategoryToggle = useCallback((value: string, facet: string) => {
    const newSelected = new Set(selectedCategories);
    const key = `${facet}:${value}`;

    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedCategories(newSelected);

    // Group selected values by facet
    const byFacet = new Map<string, string[]>();
    for (const k of newSelected) {
      const [f, v] = k.split(':');
      if (!byFacet.has(f)) byFacet.set(f, []);
      byFacet.get(f)!.push(v);
    }

    // Clear existing category filters first
    filterService.clearFilters('C');

    // Add a filter for each facet with selected values
    for (const [facetName, values] of byFacet) {
      filterService.addFilter(
        'C',
        facetName,
        'in_list',
        values,
        `${facetName}: ${values.join(', ')}`
      );
    }
    onFilterChange?.();
  }, [selectedCategories, filterService, onFilterChange]);

  // Hierarchy range change handler
  const handleHierarchyRangeChange = useCallback((newRange: [number, number]) => {
    setHierarchyRange(newRange);
    filterService.addFilter(
      'H',
      hierarchyProperty,
      'range',
      [newRange[0], newRange[1]],
      `${hierarchyProperty}: ${newRange[0]} - ${newRange[1]}`
    );
    onFilterChange?.();
  }, [hierarchyProperty, filterService, onFilterChange]);

  // Render histogram bars for time distribution
  const renderHistogram = () => {
    if (!timeDistribution.buckets.length) {
      return (
        <div className={`h-8 flex items-center justify-center ${mutedColor} text-xs`}>
          No time data
        </div>
      );
    }

    const maxCount = Math.max(...timeDistribution.buckets.map(b => b.count));

    return (
      <div className="h-8 flex items-end gap-px">
        {timeDistribution.buckets.map((bucket, i) => {
          const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${Math.max(2, height)}%`,
                backgroundColor: latchColors.T,
                opacity: 0.6 + (height / 100) * 0.4,
              }}
              title={`${bucket.label}: ${bucket.count} cards`}
            />
          );
        })}
      </div>
    );
  };

  // Render category chips for a facet
  const renderCategoryChips = (
    facetName: string,
    values: { value: string; count: number; color?: string }[],
    label: string
  ) => {
    if (values.length === 0) return null;

    return (
      <div className="mb-2">
        <div className={`text-xs ${mutedColor} mb-1`}>{label}</div>
        <div className="flex flex-wrap gap-1">
          {values.slice(0, 8).map(({ value, count, color }) => {
            const isSelected = selectedCategories.has(`${facetName}:${value}`);
            return (
              <button
                key={value}
                onClick={() => handleCategoryToggle(value, facetName)}
                className={`
                  px-2 py-0.5 text-xs rounded-full border transition-all
                  ${isSelected
                    ? `border-[${latchColors.C}] bg-[${latchColors.C}]/15 ${textColor}`
                    : `${borderColor} ${mutedColor} ${hoverBg}`
                  }
                `}
                style={isSelected ? {
                  borderColor: color || latchColors.C,
                  backgroundColor: `${color || latchColors.C}20`,
                } : undefined}
              >
                {value} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
          {values.length > 8 && (
            <span className={`px-2 py-0.5 text-xs ${mutedColor}`}>
              +{values.length - 8} more
            </span>
          )}
        </div>
      </div>
    );
  };

  // Slider row component
  const SliderRow = ({
    axis,
    icon: Icon,
    label,
    children,
    hasValue,
  }: {
    axis: 'L' | 'A' | 'T' | 'C' | 'H';
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    hasValue: boolean;
  }) => (
    <div className={`flex items-start gap-3 py-2 border-b ${borderColor} last:border-b-0`}>
      {/* Icon and label */}
      <div className="w-24 flex items-center gap-2 pt-1">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: `${latchColors[axis]}20` }}
        >
          <Icon size={14} style={{ color: latchColors[axis] }} />
        </div>
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
      </div>

      {/* Control area */}
      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Clear button */}
      <button
        onClick={() => handleClearFilter(axis)}
        className={`
          w-6 h-6 rounded flex items-center justify-center
          ${hasValue ? `${textColor} ${hoverBg}` : 'opacity-30 cursor-not-allowed'}
        `}
        disabled={!hasValue}
        title="Clear filter"
      >
        <X size={14} />
      </button>
    </div>
  );

  return (
    <div className={`${bgColor} border-t ${borderColor} ${className}`}>
      {/* Header with expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full px-4 py-2 flex items-center justify-between
          ${hoverBg} transition-colors
        `}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${textColor}`}>LATCH Filters</span>
          <div className="flex gap-1">
            {Object.entries(latchColors).map(([axis, color]) => (
              <div
                key={axis}
                className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {axis}
              </div>
            ))}
          </div>
        </div>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {/* Slider rows */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {/* Location */}
          <SliderRow
            axis="L"
            icon={MapPin}
            label="Location"
            hasValue={locationQuery.length > 0}
          >
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="within 50mi of Denver..."
              className={`
                w-full px-3 py-1.5 text-sm rounded border
                ${inputBg} ${borderColor} ${textColor}
                focus:outline-none focus:border-[${latchColors.L}]
              `}
            />
          </SliderRow>

          {/* Alphabet */}
          <SliderRow
            axis="A"
            icon={Type}
            label="Alphabet"
            hasValue={alphabetSearch.length > 0}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={alphabetSearch}
                onChange={(e) => setAlphabetSearch(e.target.value)}
                placeholder="Search..."
                className={`
                  flex-1 px-3 py-1.5 text-sm rounded border
                  ${inputBg} ${borderColor} ${textColor}
                  focus:outline-none focus:border-[${latchColors.A}]
                `}
              />
              <select
                value={alphabetProperty}
                onChange={(e) => setAlphabetProperty(e.target.value)}
                className={`
                  px-2 py-1.5 text-sm rounded border
                  ${inputBg} ${borderColor} ${textColor}
                `}
              >
                <option value="name">Name</option>
                <option value="content">Content</option>
                <option value="summary">Summary</option>
              </select>
            </div>
          </SliderRow>

          {/* Time */}
          <SliderRow
            axis="T"
            icon={Clock}
            label="Time"
            hasValue={timeRange[0] > 0 || timeRange[1] < 100}
          >
            <div className="space-y-2">
              {renderHistogram()}
              <RangeSlider
                min={0}
                max={100}
                value={timeRange}
                onChange={handleTimeRangeChange}
                accentColor={latchColors.T}
              />
              <div className={`flex justify-between text-xs ${mutedColor}`}>
                <span>{timeDistribution.minDate?.toLocaleDateString() || 'Start'}</span>
                <span>{timeDistribution.granularity}</span>
                <span>{timeDistribution.maxDate?.toLocaleDateString() || 'End'}</span>
              </div>
            </div>
          </SliderRow>

          {/* Category */}
          <SliderRow
            axis="C"
            icon={Tag}
            label="Category"
            hasValue={selectedCategories.size > 0}
          >
            <div>
              {renderCategoryChips('folder', folderFacets.values, 'Folders')}
              {renderCategoryChips('tags', tagsFacets.values, 'Tags')}
              {renderCategoryChips('status', statusFacets.values, 'Status')}
              {folderFacets.values.length === 0 &&
               tagsFacets.values.length === 0 &&
               statusFacets.values.length === 0 && (
                <div className={`text-xs ${mutedColor}`}>No category data</div>
              )}
            </div>
          </SliderRow>

          {/* Hierarchy */}
          <SliderRow
            axis="H"
            icon={BarChart2}
            label="Hierarchy"
            hasValue={hierarchyRange[0] > 1 || hierarchyRange[1] < 5}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={hierarchyProperty}
                  onChange={(e) => setHierarchyProperty(e.target.value)}
                  className={`
                    px-2 py-1 text-xs rounded border
                    ${inputBg} ${borderColor} ${textColor}
                  `}
                >
                  <option value="priority">Priority</option>
                  <option value="importance">Importance</option>
                  <option value="sort_order">Sort Order</option>
                </select>
                <div
                  className="flex-1 h-2 rounded"
                  style={{
                    background: `linear-gradient(to right, #3B82F6, #EF4444)`,
                  }}
                />
              </div>
              <RangeSlider
                min={1}
                max={5}
                value={hierarchyRange}
                onChange={handleHierarchyRangeChange}
                step={1}
                accentColor={latchColors.H}
              />
              <div className={`flex justify-between text-xs ${mutedColor}`}>
                <span>Low ({hierarchyRange[0]})</span>
                <span>High ({hierarchyRange[1]})</span>
              </div>
            </div>
          </SliderRow>
        </div>
      )}
    </div>
  );
}
