/**
 * CatalogBrowser Component
 *
 * Main catalog browser that wires together FolderTree, TagCloud, and StatusChips
 * with useFacetAggregates and FilterContext.
 *
 * Provides a visual overview of data organized by LATCH facets,
 * enabling quick filtering and navigation.
 *
 * Phase 79-02: Catalog Browser UI components
 */

import { useCallback } from 'react';
import { useFacetAggregates } from '../../hooks/data/useFacetAggregates';
import { useFilters } from '../../state/FilterContext';
import { FolderTree } from './FolderTree';
import { TagCloud } from './TagCloud';
import { StatusChips } from './StatusChips';
import { Loader2, AlertCircle } from 'lucide-react';

export function CatalogBrowser() {
  const { aggregates, isLoading, error } = useFacetAggregates();
  const { activeFilters, setCategory } = useFilters();

  // Extract current category filters
  const currentCategory = activeFilters.category;
  const activeFolder = currentCategory?.folders?.[0] ?? null;
  const activeTags = currentCategory?.tags ?? [];
  const activeStatus = currentCategory?.statuses?.[0] ?? null;

  /**
   * Handle folder selection.
   * Clicking the same folder toggles it off.
   */
  const handleFolderClick = useCallback(
    (folder: string) => {
      if (activeFolder === folder) {
        // Toggle off - remove folder filter
        setCategory(
          currentCategory
            ? {
                ...currentCategory,
                folders: undefined,
              }
            : null
        );
      } else {
        // Set folder filter
        setCategory({
          type: 'include',
          folders: [folder],
          tags: currentCategory?.tags,
          statuses: currentCategory?.statuses,
          nodeTypes: currentCategory?.nodeTypes,
        });
      }
    },
    [activeFolder, currentCategory, setCategory]
  );

  /**
   * Handle tag selection.
   * Tags are toggled on/off and can have multiple active.
   */
  const handleTagClick = useCallback(
    (tag: string) => {
      const currentTags = activeTags;
      const hasTag = currentTags.includes(tag);

      const newTags = hasTag
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];

      // If no tags left and no other filters, clear category
      if (
        newTags.length === 0 &&
        !currentCategory?.folders?.length &&
        !currentCategory?.statuses?.length
      ) {
        setCategory(null);
      } else {
        setCategory({
          type: 'include',
          folders: currentCategory?.folders,
          tags: newTags.length > 0 ? newTags : undefined,
          statuses: currentCategory?.statuses,
          nodeTypes: currentCategory?.nodeTypes,
        });
      }
    },
    [activeTags, currentCategory, setCategory]
  );

  /**
   * Handle status selection.
   * Only one status can be active at a time.
   * Passing null clears the status filter (shows all).
   */
  const handleStatusClick = useCallback(
    (status: string | null) => {
      if (status === null) {
        // Clear status filter
        if (!currentCategory?.folders?.length && !currentCategory?.tags?.length) {
          setCategory(null);
        } else {
          setCategory({
            ...currentCategory,
            type: 'include',
            statuses: undefined,
          });
        }
      } else {
        setCategory({
          type: 'include',
          folders: currentCategory?.folders,
          tags: currentCategory?.tags,
          statuses: [status],
          nodeTypes: currentCategory?.nodeTypes,
        });
      }
    },
    [currentCategory, setCategory]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading catalog...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>Error loading catalog: {error}</span>
      </div>
    );
  }

  // No data state
  if (!aggregates) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Status Section */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Status
        </h3>
        <StatusChips
          statuses={aggregates.statuses}
          activeStatus={activeStatus}
          onStatusClick={handleStatusClick}
        />
      </section>

      {/* Folders Section */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Folders
        </h3>
        <FolderTree
          folders={aggregates.folders}
          activeFolder={activeFolder}
          onFolderClick={handleFolderClick}
        />
      </section>

      {/* Tags Section */}
      <section>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Tags
        </h3>
        <TagCloud
          tags={aggregates.tags}
          activeTags={activeTags}
          onTagClick={handleTagClick}
        />
      </section>
    </div>
  );
}

export default CatalogBrowser;
