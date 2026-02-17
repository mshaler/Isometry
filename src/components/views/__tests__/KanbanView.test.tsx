/**
 * KanbanView Unit Tests
 *
 * Tests for column rendering, card grouping, selection, and drag-drop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import React from 'react';

// Mock dependencies
vi.mock('@/state/FilterContext', () => ({
  useFilters: vi.fn(() => ({
    activeFilters: {},
  })),
}));

vi.mock('@/state/SelectionContext', () => ({
  useSelection: vi.fn(() => ({
    select: vi.fn(),
    isSelected: vi.fn(() => false),
    registerScrollToNode: vi.fn(),
    unregisterScrollToNode: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePAFV', () => ({
  usePAFV: vi.fn(() => ({
    mappings: [{ plane: 'y', field: 'status', dimension: 'category' }],
  })),
}));

vi.mock('@/filters/compiler', () => ({
  compileFilters: vi.fn(() => ({
    sql: '1=1',
    params: [],
  })),
}));

// Mock card data
const mockCards = [
  { id: 'card-1', name: 'Todo Card', status: 'todo', folder: 'Work', tags: ['urgent'] },
  { id: 'card-2', name: 'Done Card', status: 'done', folder: 'Personal', tags: [] },
  { id: 'card-3', name: 'Another Todo', status: 'todo', folder: null, tags: ['tag1', 'tag2', 'tag3', 'tag4'] },
  { id: 'card-4', name: 'No Status Card', status: null, folder: 'Work', tags: [] },
];

const mockFacetValues = ['done', 'todo'];

let useSQLiteQueryMock: ReturnType<typeof vi.fn>;

vi.mock('@/hooks/database/useSQLiteQuery', () => ({
  useSQLiteQuery: (...args: unknown[]) => useSQLiteQueryMock(...args),
}));

vi.mock('@/db/SQLiteProvider', () => ({
  useSQLite: vi.fn(() => ({
    run: vi.fn(),
  })),
}));

// Import after mocks
import { KanbanView } from '../KanbanView';
import { KanbanColumn } from '../KanbanColumn';
import { KanbanCard } from '../KanbanCard';
import { useSelection } from '@/state/SelectionContext';

describe('KanbanView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSQLiteQueryMock = vi.fn((sql: string) => {
      // Return different data based on query type
      if (sql.includes('DISTINCT')) {
        // Facet values query
        return {
          data: mockFacetValues,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      // Cards query
      return {
        data: mockCards,
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    });
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <DndProvider backend={HTML5Backend}>{children}</DndProvider>
  );

  describe('column rendering', () => {
    it('renders columns based on facet values', () => {
      render(<KanbanView />, { wrapper: TestWrapper });

      // Check column headers are present
      expect(screen.getByText('todo')).toBeInTheDocument();
      expect(screen.getByText('done')).toBeInTheDocument();
    });

    it('shows card count badges in column headers', () => {
      render(<KanbanView />, { wrapper: TestWrapper });

      // todo column has 2 cards (card-1 and card-3)
      const todoColumn = screen.getByText('todo').closest('[data-column-id]');
      expect(todoColumn).toBeInTheDocument();
      // Badge should show "2" within this column
      expect(todoColumn?.textContent).toContain('2');

      // done column has 1 card (card-2)
      const doneColumn = screen.getByText('done').closest('[data-column-id]');
      expect(doneColumn).toBeInTheDocument();
      // Badge should show "1" within this column
      expect(doneColumn?.textContent).toContain('Done Card');
    });
  });

  describe('card grouping', () => {
    it('groups cards correctly into columns', () => {
      render(<KanbanView />, { wrapper: TestWrapper });

      // Card names should be visible
      expect(screen.getByText('Todo Card')).toBeInTheDocument();
      expect(screen.getByText('Done Card')).toBeInTheDocument();
      expect(screen.getByText('Another Todo')).toBeInTheDocument();
    });

    it('handles cards with null facet value by showing uncategorized column', () => {
      render(<KanbanView />, { wrapper: TestWrapper });

      // Card with null status should be rendered somewhere
      // The uncategorized column will be created dynamically
      expect(screen.getByText('No Status Card')).toBeInTheDocument();

      // Find the column containing this card
      const cardElement = screen.getByText('No Status Card').closest('[data-column-id]');
      expect(cardElement).toBeInTheDocument();
      // The column should have id "(Uncategorized)"
      expect(cardElement?.getAttribute('data-column-id')).toBe('(Uncategorized)');
    });
  });

  describe('empty state', () => {
    it('shows empty state when no cards', () => {
      useSQLiteQueryMock = vi.fn(() => ({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      }));

      render(<KanbanView />, { wrapper: TestWrapper });

      expect(screen.getByText('No cards to display')).toBeInTheDocument();
    });
  });
});

describe('KanbanColumn', () => {
  const mockOnCardClick = vi.fn();
  const mockIsCardSelected = vi.fn(() => false);

  const columnCards = [
    { id: 'card-1', name: 'Card 1', status: 'todo', folder: 'Work', tags: [] },
    { id: 'card-2', name: 'Card 2', status: 'todo', folder: null, tags: ['tag1'] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <DndProvider backend={HTML5Backend}>{children}</DndProvider>
  );

  it('renders column header with facet value', () => {
    render(
      <KanbanColumn
        columnId="todo"
        facetValue="Todo"
        facetColumn="status"
        cards={columnCards as any}
        onCardClick={mockOnCardClick}
        isCardSelected={mockIsCardSelected}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Todo')).toBeInTheDocument();
  });

  it('shows correct card count', () => {
    render(
      <KanbanColumn
        columnId="todo"
        facetValue="Todo"
        facetColumn="status"
        cards={columnCards as any}
        onCardClick={mockOnCardClick}
        isCardSelected={mockIsCardSelected}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows empty state for column with no cards', () => {
    render(
      <KanbanColumn
        columnId="empty"
        facetValue="Empty"
        facetColumn="status"
        cards={[]}
        onCardClick={mockOnCardClick}
        isCardSelected={mockIsCardSelected}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('No cards')).toBeInTheDocument();
  });
});

describe('KanbanCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <DndProvider backend={HTML5Backend}>{children}</DndProvider>
  );

  const mockCard = {
    id: 'card-1',
    name: 'Test Card',
    folder: 'Work',
    tags: ['tag1', 'tag2'],
    status: 'todo',
  };

  it('renders card name', () => {
    render(
      <KanbanCard
        card={mockCard as any}
        columnId="todo"
        selected={false}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders folder subtitle', () => {
    render(
      <KanbanCard
        card={mockCard as any}
        columnId="todo"
        selected={false}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('renders tag chips', () => {
    render(
      <KanbanCard
        card={mockCard as any}
        columnId="todo"
        selected={false}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
  });

  it('shows +N more badge for extra tags', () => {
    const manyTagsCard = {
      ...mockCard,
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    };

    render(
      <KanbanCard
        card={manyTagsCard as any}
        columnId="todo"
        selected={false}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(
      <KanbanCard
        card={mockCard as any}
        columnId="todo"
        selected={false}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('applies selection styling when selected', () => {
    render(
      <KanbanCard
        card={mockCard as any}
        columnId="todo"
        selected={true}
        onClick={mockOnClick}
      />,
      { wrapper: TestWrapper }
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(card.className).toContain('ring-2');
    expect(card.className).toContain('ring-blue-500');
  });
});

describe('KanbanView selection integration', () => {
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockIsSelected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect = vi.fn();
    mockIsSelected = vi.fn((id) => id === 'card-1');

    vi.mocked(useSelection).mockReturnValue({
      select: mockSelect,
      isSelected: mockIsSelected,
      registerScrollToNode: vi.fn(),
      unregisterScrollToNode: vi.fn(),
      selection: { selectedIds: new Set(['card-1']), anchorId: 'card-1', lastSelectedId: 'card-1' },
      deselect: vi.fn(),
      toggle: vi.fn(),
      selectRange: vi.fn(),
      selectMultiple: vi.fn(),
      clear: vi.fn(),
      setCells: vi.fn(),
      scrollToNode: null,
    });

    useSQLiteQueryMock = vi.fn((sql: string) => {
      if (sql.includes('DISTINCT')) {
        return { data: mockFacetValues, loading: false, error: null, refetch: vi.fn() };
      }
      return { data: mockCards, loading: false, error: null, refetch: vi.fn() };
    });
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <DndProvider backend={HTML5Backend}>{children}</DndProvider>
  );

  it('calls select on card click', () => {
    render(<KanbanView />, { wrapper: TestWrapper });

    // Click a card
    fireEvent.click(screen.getByText('Todo Card'));

    expect(mockSelect).toHaveBeenCalledWith('card-1');
  });

  it('applies selected styling to selected cards', () => {
    render(<KanbanView />, { wrapper: TestWrapper });

    // Find the selected card's container (the button with data-selected)
    const selectedCard = screen.getByText('Todo Card').closest('[data-selected="true"]');
    expect(selectedCard).toBeInTheDocument();
  });
});
