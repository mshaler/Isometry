/**
 * CategoryColorPicker - Visual color picker for category tags
 *
 * Provides:
 * - Color palette grid (24 colors)
 * - Tag pill display with assigned colors
 * - Tag selection for color assignment
 * - Tag filtering inclusion
 */

import React, { useState, useMemo } from 'react';
import { CategoryTagPill } from './CategoryTagPill';
import { useTagColors } from '../state/TagColorContext';
import { DEFAULT_PALETTE, PALETTE_NAMES, getContrastText } from '../utils/tag-colors';

export interface CategoryColorPickerProps {
  /** Available tags to display */
  tags: string[];

  /** Currently selected/included tags for filtering */
  selectedTags: Set<string>;

  /** Called when selected tags change */
  onSelectedTagsChange: (tags: Set<string>) => void;

  /** Optional tag usage counts for sorting */
  tagCounts?: Map<string, number>;

  /** Optional className */
  className?: string;
}

type SortMode = 'alphabetical' | 'color' | 'usage';

/**
 * CategoryColorPicker component
 */
export function CategoryColorPicker({
  tags,
  selectedTags,
  onSelectedTagsChange,
  tagCounts,
  className = '',
}: CategoryColorPickerProps) {
  const { tagColors, setTagColor, getTagColor } = useTagColors();
  const [tagForColorAssignment, setTagForColorAssignment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [colorFilterMode, setColorFilterMode] = useState(false);

  /**
   * Handle color swatch click - assign color OR filter by color
   */
  const handleColorClick = (color: string) => {
    if (colorFilterMode) {
      // Filter by color: select all tags with this color
      const tagsWithColor = tags.filter((tag) => getTagColor(tag) === color);
      onSelectedTagsChange(new Set(tagsWithColor));
    } else if (tagForColorAssignment) {
      // Assign color to selected tag
      setTagColor(tagForColorAssignment, color);
      // Keep tag selected for further color changes
    }
  };

  /**
   * Handle tag pill click - toggle filter inclusion
   */
  const handleTagClick = (tag: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tag)) {
      newSelected.delete(tag);
    } else {
      newSelected.add(tag);
    }
    onSelectedTagsChange(newSelected);
  };

  /**
   * Handle tag pill right-click - select for color assignment
   */
  const handleTagContextMenu = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    setTagForColorAssignment(tag);
  };

  /**
   * Handle tag pill double-click - select for color assignment
   */
  const handleTagDoubleClick = (tag: string) => {
    setTagForColorAssignment(tag);
  };

  /**
   * Filter and sort tags
   */
  const filteredAndSortedTags = useMemo(() => {
    // Filter by search query
    let filtered = tags;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = tags.filter((tag) => tag.toLowerCase().includes(query));
    }

    // Sort by selected mode
    const sorted = [...filtered];
    switch (sortMode) {
      case 'alphabetical':
        sorted.sort((a, b) => a.localeCompare(b));
        break;

      case 'color':
        sorted.sort((a, b) => {
          const colorA = getTagColor(a);
          const colorB = getTagColor(b);
          return colorA.localeCompare(colorB);
        });
        break;

      case 'usage':
        if (tagCounts) {
          sorted.sort((a, b) => {
            const countA = tagCounts.get(a) || 0;
            const countB = tagCounts.get(b) || 0;
            return countB - countA; // Descending order (most used first)
          });
        } else {
          sorted.sort((a, b) => a.localeCompare(b));
        }
        break;
    }

    return sorted;
  }, [tags, searchQuery, sortMode, getTagColor, tagCounts]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Color Palette Grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Color Palette
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={colorFilterMode}
              onChange={(e) => setColorFilterMode(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Filter by color
          </label>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {DEFAULT_PALETTE.map((color, index) => (
            <button
              key={color}
              onClick={() => handleColorClick(color)}
              className={`
                w-10 h-10 rounded-md
                border-2
                transition-all
                hover:scale-110
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                ${tagForColorAssignment && getTagColor(tagForColorAssignment) === color ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
              `}
              style={{ backgroundColor: color }}
              title={PALETTE_NAMES[index] || color}
              aria-label={`${PALETTE_NAMES[index] || color} color`}
            />
          ))}
        </div>
      </div>

      {/* Selected Tag Info */}
      {tagForColorAssignment && (
        <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Assigning color to:
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: getTagColor(tagForColorAssignment),
              color: getContrastText(getTagColor(tagForColorAssignment)),
            }}
          >
            {tagForColorAssignment}
          </div>
          <button
            onClick={() => setTagForColorAssignment(null)}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <div>• Click tag to include in filter</div>
        <div>• Double-click tag to assign color</div>
        {colorFilterMode ? (
          <div>• Click color swatch to select all tags with that color</div>
        ) : (
          <div>• Click color swatch to assign to selected tag</div>
        )}
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tags ({filteredAndSortedTags.length}/{tags.length})
        </div>
        <div className="flex gap-2">
          {/* Search input */}
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Sort dropdown */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="alphabetical">A-Z</option>
            <option value="color">Color</option>
            <option value="usage">Usage</option>
          </select>
        </div>
      </div>

      {/* Tag Pills */}
      <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        {filteredAndSortedTags.length === 0 ? (
          <div className="text-sm text-gray-400 dark:text-gray-500 italic">
            {searchQuery.trim() ? 'No matching tags' : 'No tags available'}
          </div>
        ) : (
          filteredAndSortedTags.map((tag) => (
            <div
              key={tag}
              onDoubleClick={() => handleTagDoubleClick(tag)}
              onContextMenu={(e) => handleTagContextMenu(e, tag)}
              className={`
                ${tagForColorAssignment === tag ? 'ring-2 ring-blue-400' : ''}
              `}
            >
              <CategoryTagPill
                tag={tag}
                color={getTagColor(tag)}
                selected={selectedTags.has(tag)}
                onClick={() => handleTagClick(tag)}
              />
            </div>
          ))
        )}
      </div>

      {/* Selection Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSelectedTagsChange(new Set(tags))}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Select All
        </button>
        <button
          onClick={() => onSelectedTagsChange(new Set())}
          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Deselect All
        </button>
      </div>
    </div>
  );
}
