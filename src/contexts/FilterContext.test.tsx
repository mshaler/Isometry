import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FilterProvider, useFilters } from './FilterContext';

// Test component to access context
function TestConsumer() {
  const { filters, addFilter, removeFilter, clearFilters, compiledQuery } = useFilters();
  return (
    <div>
      <span data-testid="filter-count">{filters.length}</span>
      <span data-testid="compiled-sql">{compiledQuery.sql}</span>
      <span data-testid="compiled-params">{JSON.stringify(compiledQuery.params)}</span>
      <button onClick={() => addFilter({ field: 'status', operator: '=', value: 'active' })}>
        Add Status Filter
      </button>
      <button onClick={() => addFilter({ field: 'priority', operator: '>', value: 3 })}>
        Add Priority Filter
      </button>
      <button onClick={() => removeFilter(0)}>Remove First</button>
      <button onClick={() => clearFilters()}>Clear All</button>
      <ul>
        {filters.map((f, i) => (
          <li key={i} data-testid={`filter-${i}`}>
            {f.field}:{f.operator}{f.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('FilterContext', () => {
  describe('Provider', () => {
    it('provides default empty filters', () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      expect(screen.getByTestId('filter-count').textContent).toBe('0');
      expect(screen.getByTestId('compiled-sql').textContent).toBe('1=1');
    });

    it('throws when useFilters is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useFilters must be used within a FilterProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('addFilter', () => {
    it('adds a filter to the list', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });

      expect(screen.getByTestId('filter-count').textContent).toBe('1');
      expect(screen.getByTestId('filter-0').textContent).toBe('status:=active');
    });

    it('adds multiple filters', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });
      await act(async () => {
        screen.getByText('Add Priority Filter').click();
      });

      expect(screen.getByTestId('filter-count').textContent).toBe('2');
    });
  });

  describe('removeFilter', () => {
    it('removes a filter by index', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });
      await act(async () => {
        screen.getByText('Add Priority Filter').click();
      });
      await act(async () => {
        screen.getByText('Remove First').click();
      });

      expect(screen.getByTestId('filter-count').textContent).toBe('1');
      expect(screen.getByTestId('filter-0').textContent).toBe('priority:>3');
    });
  });

  describe('clearFilters', () => {
    it('removes all filters', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });
      await act(async () => {
        screen.getByText('Add Priority Filter').click();
      });
      await act(async () => {
        screen.getByText('Clear All').click();
      });

      expect(screen.getByTestId('filter-count').textContent).toBe('0');
      expect(screen.getByTestId('compiled-sql').textContent).toBe('1=1');
    });
  });

  describe('compiledQuery', () => {
    it('compiles single filter to SQL', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });

      expect(screen.getByTestId('compiled-sql').textContent).toBe('status = ?');
      expect(screen.getByTestId('compiled-params').textContent).toBe('["active"]');
    });

    it('compiles multiple filters with AND', async () => {
      render(
        <FilterProvider>
          <TestConsumer />
        </FilterProvider>
      );

      await act(async () => {
        screen.getByText('Add Status Filter').click();
      });
      await act(async () => {
        screen.getByText('Add Priority Filter').click();
      });

      expect(screen.getByTestId('compiled-sql').textContent).toBe('(status = ? AND priority > ?)');
      expect(screen.getByTestId('compiled-params').textContent).toBe('["active",3]');
    });
  });
});
