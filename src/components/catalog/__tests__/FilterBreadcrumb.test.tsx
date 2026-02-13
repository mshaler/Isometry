/**
 * FilterBreadcrumb Component Tests
 *
 * Tests for the breadcrumb navigation showing active filter state.
 *
 * @see Phase 79-03: Catalog Browser - Breadcrumb Navigation
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBreadcrumb } from '../FilterBreadcrumb';
import { useFilters } from '../../../state/FilterContext';

// Mock the FilterContext hook
vi.mock('../../../state/FilterContext', () => ({
  useFilters: vi.fn()
}));

const mockUseFilters = useFilters as Mock;

describe('FilterBreadcrumb', () => {
  const mockSetCategory = vi.fn();
  const mockClearAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('shows "All Cards" when no filters are active', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: null,
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('All Cards')).toBeInTheDocument();
    });

    it('displays Home icon in empty state', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: null,
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      // Home icon should be present (via lucide-react)
      expect(screen.getByText('All Cards').previousElementSibling).toBeTruthy();
    });
  });

  describe('Folder filter', () => {
    it('renders folder path segments', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work/projects']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('projects')).toBeInTheDocument();
    });

    it('navigates to folder level when clicking folder segment', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work/projects/alpha']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      fireEvent.click(screen.getByText('work'));

      expect(mockSetCategory).toHaveBeenCalledWith({
        type: 'include',
        folders: ['work']
      });
    });
  });

  describe('Tag filter', () => {
    it('renders tag filters with # prefix', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            tags: ['urgent', 'review']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('#urgent')).toBeInTheDocument();
      expect(screen.getByText('#review')).toBeInTheDocument();
    });

    it('removes tag when clicking tag segment', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            tags: ['urgent', 'review']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      fireEvent.click(screen.getByText('#urgent'));

      expect(mockSetCategory).toHaveBeenCalledWith({
        type: 'include',
        tags: ['review']
      });
    });

    it('shows "+N more" when more than 3 tags active', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            tags: ['one', 'two', 'three', 'four', 'five']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('#one')).toBeInTheDocument();
      expect(screen.getByText('#two')).toBeInTheDocument();
      expect(screen.getByText('#three')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
      expect(screen.queryByText('#four')).not.toBeInTheDocument();
    });
  });

  describe('Status filter', () => {
    it('renders status filter with label', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            statuses: ['active']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('Status: active')).toBeInTheDocument();
    });

    it('removes status when clicking status segment', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            statuses: ['active', 'pending']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      fireEvent.click(screen.getByText('Status: active'));

      expect(mockSetCategory).toHaveBeenCalledWith({
        type: 'include',
        statuses: ['pending']
      });
    });
  });

  describe('Clear all', () => {
    it('shows clear all button when multiple filters active', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work'],
            tags: ['urgent']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('calls clearAll when clicking clear all button', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work'],
            tags: ['urgent']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      fireEvent.click(screen.getByText('Clear all'));

      expect(mockClearAll).toHaveBeenCalled();
    });

    it('calls clearAll when clicking Home button', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      const homeButton = screen.getByTitle('Clear all filters');
      fireEvent.click(homeButton);

      expect(mockClearAll).toHaveBeenCalled();
    });
  });

  describe('Search filter', () => {
    it('renders search filter with quotes', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: {
            type: 'search',
            value: 'project update'
          },
          time: null,
          category: null,
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('"project update"')).toBeInTheDocument();
    });
  });

  describe('Time filter', () => {
    it('renders time preset filter', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: {
            type: 'preset',
            preset: 'this-week',
            field: 'created'
          },
          category: null,
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('created: this-week')).toBeInTheDocument();
    });
  });

  describe('Hierarchy filter', () => {
    it('renders priority range filter', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: null,
          hierarchy: {
            type: 'priority',
            minPriority: 1,
            maxPriority: 3
          },
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('Priority: 1-3')).toBeInTheDocument();
    });

    it('renders top-n filter', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: null,
          hierarchy: {
            type: 'top-n',
            limit: 10
          },
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('Top 10')).toBeInTheDocument();
    });
  });

  describe('Location filter', () => {
    it('renders location filter type', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: {
            type: 'radius'
          },
          alphabet: null,
          time: null,
          category: null,
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      expect(screen.getByText('Location: radius')).toBeInTheDocument();
    });
  });

  describe('Color coding', () => {
    it('applies correct color classes to different filter types', () => {
      mockUseFilters.mockReturnValue({
        activeFilters: {
          location: null,
          alphabet: null,
          time: null,
          category: {
            type: 'include',
            folders: ['work'],
            tags: ['urgent'],
            statuses: ['active']
          },
          hierarchy: null,
          dsl: null
        },
        setCategory: mockSetCategory,
        clearAll: mockClearAll
      });

      render(<FilterBreadcrumb />);

      // Folder should have blue color class
      const folderButton = screen.getByText('work').closest('button');
      expect(folderButton?.className).toContain('text-blue-600');

      // Tag should have green color class
      const tagButton = screen.getByText('#urgent').closest('button');
      expect(tagButton?.className).toContain('text-green-600');

      // Status should have purple color class
      const statusButton = screen.getByText('Status: active').closest('button');
      expect(statusButton?.className).toContain('text-purple-600');
    });
  });
});
