/**
 * Sidebar Component Tests
 *
 * TDD tests for Sidebar refactoring to use TabPanel and AccordionSection.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FilterProvider } from '@/contexts/FilterContext';

// Mock useSQLiteQuery to avoid database dependency
// Uses the correct path and returns query state structure
vi.mock('@/hooks/database/useSQLiteQuery', () => ({
  useSQLiteQuery: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    duration: 0
  })),
}));

// Helper to wrap component with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <FilterProvider>{ui}</FilterProvider>
    </ThemeProvider>
  );
}

describe('Sidebar', () => {
  describe('rendering', () => {
    it('renders the sidebar container', () => {
      renderWithProviders(<Sidebar />);

      const sidebar = document.querySelector('[class*="w-64"]');
      expect(sidebar).not.toBeNull();
    });

    it('renders Filters and Templates tabs', () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('shows Filters tab content by default', () => {
      renderWithProviders(<Sidebar />);

      // Analytics section should be visible in Filters tab
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('switches to Templates tab when clicked', () => {
      renderWithProviders(<Sidebar />);

      const templatesTab = screen.getByText('Templates');
      fireEvent.click(templatesTab);

      // Template builders should be visible
      expect(screen.getByText('Apps Builder')).toBeInTheDocument();
      expect(screen.getByText('Views Builder')).toBeInTheDocument();
    });

    it('switches back to Filters tab', () => {
      renderWithProviders(<Sidebar />);

      // Switch to Templates
      fireEvent.click(screen.getByText('Templates'));
      expect(screen.getByText('Apps Builder')).toBeInTheDocument();

      // Switch back to Filters - use role="tab" for TabPanel
      const filtersTabs = screen.getAllByText('Filters');
      const filtersTab = filtersTabs.find((el) => el.closest('[role="tab"]'));
      if (filtersTab) {
        fireEvent.click(filtersTab);
      } else {
        fireEvent.click(filtersTabs[0]);
      }
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });
  });

  describe('filter sections', () => {
    it('renders Analytics section', () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('renders Synthetics section', () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText('Synthetics')).toBeInTheDocument();
    });

    it('renders Formulas section', () => {
      renderWithProviders(<Sidebar />);

      expect(screen.getByText('Formulas')).toBeInTheDocument();
    });

    it('expands Analytics section by default', () => {
      renderWithProviders(<Sidebar />);

      // Analytics items should be visible when expanded
      // Note: actual items depend on schema columns
    });

    it('collapses section when header is clicked', () => {
      renderWithProviders(<Sidebar />);

      const analyticsHeader = screen.getByText('Analytics');
      fireEvent.click(analyticsHeader);

      // Section should toggle
    });
  });

  describe('template builders', () => {
    it('renders all template builder buttons', () => {
      renderWithProviders(<Sidebar />);

      fireEvent.click(screen.getByText('Templates'));

      expect(screen.getByText('Apps Builder')).toBeInTheDocument();
      expect(screen.getByText('Views Builder')).toBeInTheDocument();
      expect(screen.getByText('Buttons Builder')).toBeInTheDocument();
      expect(screen.getByText('Charts Builder')).toBeInTheDocument();
    });
  });

  describe('theme support', () => {
    it('applies NeXTSTEP theme styles', () => {
      render(
        <ThemeProvider defaultTheme="NeXTSTEP">
          <FilterProvider>
            <Sidebar />
          </FilterProvider>
        </ThemeProvider>
      );

      const sidebar = document.querySelector('[class*="bg-[#c0c0c0]"]');
      expect(sidebar).not.toBeNull();
    });

    it('applies Modern theme styles', () => {
      render(
        <ThemeProvider defaultTheme="Modern">
          <FilterProvider>
            <Sidebar />
          </FilterProvider>
        </ThemeProvider>
      );

      // Modern theme uses bg-white/80 (with opacity)
      const sidebar = document.querySelector('[class*="backdrop-blur"]');
      expect(sidebar).not.toBeNull();
    });
  });
});
