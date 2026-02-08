import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFTS5Search } from '@/hooks/database/useFTS5Search';
import { Search, X, ChevronDown } from 'lucide-react';
import './SuperSearch.css';

export interface SuperSearchProps {
  onSearch: (query: string) => void;
  onHighlight: (cardIds: string[]) => void;
  initialQuery?: string;
  showFacets?: boolean;
  className?: string;
  placeholder?: string;
}

export type SearchScope = 'all' | 'category' | 'time' | 'hierarchy' | 'location' | 'alphabet';

const SEARCH_SCOPES: Record<SearchScope, string> = {
  all: 'All Content',
  category: 'Category',
  time: 'Time',
  hierarchy: 'Hierarchy',
  location: 'Location',
  alphabet: 'Alphabet'
};

/**
 * SuperSearch - FTS5-powered search with in-grid highlighting
 *
 * Features:
 * - Real-time FTS5 full-text search with debouncing
 * - Faceted search by LATCH axis
 * - In-grid result highlighting via onHighlight callback
 * - Performance target: < 100ms for searches across 10k cards
 * - Porter tokenizer with prefix matching support
 *
 * Part of the Super* feature family for SuperGrid.
 */
export const SuperSearch: React.FC<SuperSearchProps> = ({
  onSearch,
  onHighlight,
  initialQuery = '',
  showFacets = false,
  className = '',
  placeholder = 'Search across all cards...'
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);

  // Build faceted query for specific axis searching
  const facetedQuery = useMemo(() => {
    if (!query.trim() || searchScope === 'all') {
      return query;
    }

    // Simple faceted query - in practice this would integrate with LATCH filter compilation
    // For now, we'll pass the scope in the search terms for FTS5 to handle
    return `${query} scope:${searchScope}`;
  }, [query, searchScope]);

  // FTS5 search hook
  const { results, isSearching, error, hasQuery } = useFTS5Search(facetedQuery);

  // Notify parent component of search query changes
  useEffect(() => {
    onSearch(query);
  }, [query, onSearch]);

  // Notify parent component of highlighted cards
  useEffect(() => {
    const cardIds = results.map(result => result.id);
    onHighlight(cardIds);
  }, [results, onHighlight]);

  // Handle search input changes (debounced via useFTS5Search)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    onHighlight([]);
  }, [onHighlight]);

  // Handle search scope selection
  const handleScopeSelect = useCallback((scope: SearchScope) => {
    setSearchScope(scope);
    setShowScopeDropdown(false);
  }, []);

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) {
        handleClear();
      } else {
        setShowScopeDropdown(false);
      }
    }
  }, [query, handleClear]);

  return (
    <div className={`super-search ${className}`}>
      <div className="super-search__input-group">
        {/* Search icon */}
        <div className="super-search__icon">
          <Search size={16} aria-label="Search" title="Full-text search" />
        </div>

        {/* Main search input */}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="super-search__input"
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="super-search__clear"
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}

        {/* Faceted search scope selector */}
        {showFacets && (
          <div className="super-search__scope">
            <button
              onClick={() => setShowScopeDropdown(!showScopeDropdown)}
              className="super-search__scope-button"
              aria-label="Search scope"
              title="Select search scope"
            >
              <span>{SEARCH_SCOPES[searchScope]}</span>
              <ChevronDown size={14} />
            </button>

            {showScopeDropdown && (
              <div className="super-search__scope-dropdown">
                {Object.entries(SEARCH_SCOPES).map(([scope, label]) => (
                  <button
                    key={scope}
                    onClick={() => handleScopeSelect(scope as SearchScope)}
                    className={`super-search__scope-option ${searchScope === scope ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search status and results count */}
      {hasQuery && (
        <div className="super-search__status">
          {isSearching ? (
            <span className="super-search__status-text searching">
              Searching...
            </span>
          ) : error ? (
            <span className="super-search__status-text error">
              Search error: {error.message}
            </span>
          ) : (
            <span className="super-search__status-text results">
              {results.length} result{results.length !== 1 ? 's' : ''}
              {searchScope !== 'all' && ` in ${SEARCH_SCOPES[searchScope]}`}
            </span>
          )}
        </div>
      )}

      {/* Quick search hints (expandable help) */}
      {!hasQuery && (
        <div className="super-search__hints">
          <div className="super-search__hint">
            Try: "project status", "meeting notes", "urgent AND deadline"
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperSearch;