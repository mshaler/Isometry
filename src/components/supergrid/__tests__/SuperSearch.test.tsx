import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuperSearch } from '../SuperSearch';
import { useFTS5Search } from '@/hooks/database/useFTS5Search';
import { vi } from 'vitest';

// Mock the FTS5 search hook
vi.mock('@/hooks/database/useFTS5Search');

const mockUseFTS5Search = vi.mocked(useFTS5Search);

describe('SuperSearch', () => {
  const mockOnSearch = vi.fn();
  const mockOnHighlight = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFTS5Search.mockReturnValue({
      results: [],
      isSearching: false,
      error: null,
      hasQuery: false,
    });
  });

  describe('Basic Rendering', () => {
    it('should render search input with placeholder', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
        />
      );

      expect(screen.getByPlaceholderText(/search across all cards/i)).toBeInTheDocument();
      expect(screen.getByTitle(/full-text search/i)).toBeInTheDocument();
    });

    it('should show search icon and clear button when appropriate', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test query"
        />
      );

      expect(screen.getByTitle(/full-text search/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/clear search/i)).toBeInTheDocument();
    });
  });

  describe('Search Interaction', () => {
    it('should call onSearch when typing with debounce', async () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
        />
      );

      const input = screen.getByPlaceholderText(/search across all cards/i);
      fireEvent.change(input, { target: { value: 'test search' } });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test search');
      }, { timeout: 400 });
    });

    it('should clear search when clear button is clicked', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test query"
        />
      );

      const clearButton = screen.getByLabelText(/clear search/i);
      fireEvent.click(clearButton);

      expect(mockOnSearch).toHaveBeenCalledWith('');
    });
  });

  describe('Search Results', () => {
    it('should display search results count', () => {
      mockUseFTS5Search.mockReturnValue({
        results: [
          { id: '1', name: 'Test Card 1', rank: -1.5 } as any,
          { id: '2', name: 'Test Card 2', rank: -1.2 } as any,
        ],
        isSearching: false,
        error: null,
        hasQuery: true,
      });

      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test"
        />
      );

      expect(screen.getByText(/2 results/i)).toBeInTheDocument();
    });

    it('should show loading state during search', () => {
      mockUseFTS5Search.mockReturnValue({
        results: [],
        isSearching: true,
        error: null,
        hasQuery: true,
      });

      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test"
        />
      );

      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('should display error message when search fails', () => {
      mockUseFTS5Search.mockReturnValue({
        results: [],
        isSearching: false,
        error: new Error('FTS5 syntax error'),
        hasQuery: true,
      });

      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="invalid:query"
        />
      );

      expect(screen.getByText(/search error/i)).toBeInTheDocument();
    });
  });

  describe('Faceted Search', () => {
    it('should show axis filter options', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          showFacets={true}
        />
      );

      expect(screen.getByText(/all content/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search scope/i })).toBeInTheDocument();
    });

    it('should allow filtering by specific axis', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          showFacets={true}
        />
      );

      const scopeButton = screen.getByRole('button', { name: /search scope/i });
      fireEvent.click(scopeButton);

      expect(screen.getByText(/category/i)).toBeInTheDocument();
      expect(screen.getByText(/time/i)).toBeInTheDocument();
      expect(screen.getByText(/hierarchy/i)).toBeInTheDocument();
    });
  });

  describe('Highlight Integration', () => {
    it('should call onHighlight when results change', () => {
      mockUseFTS5Search.mockReturnValue({
        results: [
          { id: '1', name: 'Test Card', rank: -1.5 } as any,
        ],
        isSearching: false,
        error: null,
        hasQuery: true,
      });

      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test"
        />
      );

      expect(mockOnHighlight).toHaveBeenCalledWith(['1']);
    });

    it('should clear highlights when search is cleared', () => {
      render(
        <SuperSearch
          onSearch={mockOnSearch}
          onHighlight={mockOnHighlight}
          initialQuery="test"
        />
      );

      const clearButton = screen.getByLabelText(/clear search/i);
      fireEvent.click(clearButton);

      expect(mockOnHighlight).toHaveBeenCalledWith([]);
    });
  });
});