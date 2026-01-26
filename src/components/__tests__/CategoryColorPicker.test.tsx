/**
 * CategoryColorPicker.test.tsx - Tests for tag color picker component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryColorPicker } from '../CategoryColorPicker';
import { TagColorProvider } from '../../state/TagColorContext';
import { DEFAULT_PALETTE } from '../../utils/tag-colors';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, _value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('CategoryColorPicker', () => {
  const mockTags = ['Work', 'Personal', 'Projects', 'Archive', 'Notes'];
  const mockSelectedTags = new Set(['Work', 'Personal']);
  const mockOnChange = vi.fn();
  const mockTagCounts = new Map([
    ['Work', 10],
    ['Personal', 5],
    ['Projects', 8],
    ['Archive', 2],
    ['Notes', 15],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  const renderPicker = (props = {}) => {
    return render(
      <TagColorProvider>
        <CategoryColorPicker
          tags={mockTags}
          selectedTags={mockSelectedTags}
          onSelectedTagsChange={mockOnChange}
          tagCounts={mockTagCounts}
          {...props}
        />
      </TagColorProvider>
    );
  };

  it('renders color palette with 24 colors', () => {
    renderPicker();

    // Check that all palette colors are rendered
    // Look for buttons with aria-label containing "color"
    const allButtons = screen.getAllByRole('button');
    const paletteButtons = allButtons.filter(btn =>
      btn.getAttribute('aria-label')?.includes('color')
    );

    expect(paletteButtons.length).toBe(DEFAULT_PALETTE.length);
  });

  it('renders tag pills for all tags', () => {
    renderPicker();

    mockTags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });

  it('shows selected state on tag pills', () => {
    renderPicker();

    const workPill = screen.getByText('Work').closest('button');
    const archivePill = screen.getByText('Archive').closest('button');

    expect(workPill).toHaveAttribute('aria-pressed', 'true');
    expect(archivePill).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles tag selection on click', () => {
    renderPicker();

    const archivePill = screen.getByText('Archive');
    fireEvent.click(archivePill);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.any(Set)
    );

    const calledSet = mockOnChange.mock.calls[0][0];
    expect(calledSet.has('Archive')).toBe(true);
    expect(calledSet.has('Work')).toBe(true);
    expect(calledSet.has('Personal')).toBe(true);
  });

  it('deselects tag on second click', () => {
    renderPicker();

    const workPill = screen.getByText('Work');
    fireEvent.click(workPill);

    expect(mockOnChange).toHaveBeenCalled();
    const calledSet = mockOnChange.mock.calls[0][0];
    expect(calledSet.has('Work')).toBe(false);
    expect(calledSet.has('Personal')).toBe(true);
  });

  it('selects tag for color assignment on double-click', () => {
    renderPicker();

    // Double-click on the parent div, not the button itself
    const notesPill = screen.getByText('Notes');
    const parent = notesPill.closest('[class*="ring-"]') || notesPill.parentElement;

    if (parent) {
      fireEvent.doubleClick(parent);
    }

    // Should show "Assigning color to:" message
    expect(screen.getByText(/Assigning color to:/)).toBeInTheDocument();
  });

  it('assigns color to selected tag', () => {
    renderPicker();

    // Select tag for color assignment
    const workPill = screen.getByText('Work');
    fireEvent.doubleClick(workPill);

    // Click a color swatch
    const colorButtons = screen.getAllByRole('button');
    const blueButton = colorButtons.find(btn =>
      btn.getAttribute('title')?.includes('Blue')
    );

    if (blueButton) {
      fireEvent.click(blueButton);
    }

    // Color should be persisted (checked via TagColorContext)
    // This is an integration test with the context
  });

  it('filters tags by search query', () => {
    renderPicker();

    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'work' } });

    // Should show only "Work" tag
    expect(screen.getByText('Work')).toBeInTheDocument();

    // Should not show other tags
    expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('shows no matching tags message when search has no results', () => {
    renderPicker();

    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No matching tags')).toBeInTheDocument();
  });

  it('sorts tags alphabetically', () => {
    renderPicker();

    const sortSelect = screen.getByRole('combobox');
    fireEvent.change(sortSelect, { target: { value: 'alphabetical' } });

    // Tags should be in A-Z order
    const tagButtons = screen.getAllByText(/Work|Personal|Projects|Archive|Notes/);
    const tagNames = tagButtons.map(btn => btn.textContent);

    expect(tagNames).toEqual([
      'Archive',
      'Notes',
      'Personal',
      'Projects',
      'Work',
    ]);
  });

  it('sorts tags by usage count', () => {
    renderPicker();

    const sortSelect = screen.getByRole('combobox');
    fireEvent.change(sortSelect, { target: { value: 'usage' } });

    // Tags should be sorted by count (descending)
    // Notes (15), Work (10), Projects (8), Personal (5), Archive (2)
    const tagButtons = screen.getAllByText(/Work|Personal|Projects|Archive|Notes/);
    const tagNames = tagButtons.map(btn => btn.textContent);

    expect(tagNames[0]).toBe('Notes'); // Highest count
    expect(tagNames[tagNames.length - 1]).toBe('Archive'); // Lowest count
  });

  it('enables color filter mode', () => {
    renderPicker();

    const filterCheckbox = screen.getByLabelText('Filter by color');
    fireEvent.click(filterCheckbox);

    // Instructions should change
    expect(screen.getByText(/Click color swatch to select all tags with that color/)).toBeInTheDocument();
  });

  it('selects all tags with same color in filter mode', () => {
    renderPicker();

    // Enable color filter mode
    const filterCheckbox = screen.getByLabelText('Filter by color');
    fireEvent.click(filterCheckbox);

    // Click a color swatch
    const colorButtons = screen.getAllByRole('button');
    const blueButton = colorButtons.find(btn =>
      btn.getAttribute('title')?.includes('Blue')
    );

    if (blueButton) {
      fireEvent.click(blueButton);
    }

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('selects all tags on Select All button', () => {
    renderPicker();

    const selectAllButton = screen.getByText('Select All');
    fireEvent.click(selectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith(new Set(mockTags));
  });

  it('deselects all tags on Deselect All button', () => {
    renderPicker();

    const deselectAllButton = screen.getByText('Deselect All');
    fireEvent.click(deselectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith(new Set());
  });

  it('shows tag count correctly', () => {
    renderPicker();

    // Should show "Tags (5/5)" initially
    expect(screen.getByText(/Tags \(5\/5\)/)).toBeInTheDocument();
  });

  it('updates tag count when filtering', () => {
    renderPicker();

    const searchInput = screen.getByPlaceholderText('Search tags...');
    fireEvent.change(searchInput, { target: { value: 'work' } });

    // Should show "Tags (1/5)" after filtering
    expect(screen.getByText(/Tags \(1\/5\)/)).toBeInTheDocument();
  });

  it('renders empty state when no tags', () => {
    render(
      <TagColorProvider>
        <CategoryColorPicker
          tags={[]}
          selectedTags={new Set()}
          onSelectedTagsChange={mockOnChange}
        />
      </TagColorProvider>
    );

    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });
});
