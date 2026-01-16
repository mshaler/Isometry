/**
 * Navigator Component Tests
 *
 * TDD tests for Navigator refactoring to use Dropdown component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navigator } from './Navigator';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppStateProvider } from '@/contexts/AppStateContext';

// Helper to wrap component with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <AppStateProvider>{ui}</AppStateProvider>
    </ThemeProvider>
  );
}

describe('Navigator', () => {
  describe('rendering', () => {
    it('renders the navigator container', () => {
      renderWithProviders(<Navigator />);

      // Navigator should render
      const container = document.querySelector('[class*="h-12"]');
      expect(container).not.toBeNull();
    });

    it('renders Apps dropdown with label', () => {
      renderWithProviders(<Navigator />);

      expect(screen.getByText('Apps:')).toBeInTheDocument();
    });

    it('renders Views dropdown with label', () => {
      renderWithProviders(<Navigator />);

      expect(screen.getByText('Views:')).toBeInTheDocument();
    });

    it('renders Datasets dropdown with label', () => {
      renderWithProviders(<Navigator />);

      expect(screen.getByText('Datasets:')).toBeInTheDocument();
    });

    it('renders expand/collapse toggle button', () => {
      renderWithProviders(<Navigator />);

      // The toggle button should be present
      const toggleButton = document.querySelector('[class*="w-7"][class*="h-7"]');
      expect(toggleButton).not.toBeNull();
    });
  });

  describe('dropdown behavior', () => {
    it('shows Apps options when Apps dropdown is clicked', () => {
      renderWithProviders(<Navigator />);

      // Click on the Apps dropdown (shows 'Demo' by default)
      const appsButton = screen.getByRole('button', { name: /Demo/i });
      fireEvent.click(appsButton);

      // Should show app options
      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('shows Views options when Views dropdown is clicked', () => {
      renderWithProviders(<Navigator />);

      // Click on the Views dropdown (shows 'Grid' by default)
      const viewsButton = screen.getByRole('button', { name: /Grid/i });
      fireEvent.click(viewsButton);

      // Should show view options
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Kanban')).toBeInTheDocument();
    });

    it('shows Datasets options when Datasets dropdown is clicked', () => {
      renderWithProviders(<Navigator />);

      // Click on the Datasets dropdown (shows 'Notes' by default)
      const datasetsButton = screen.getByRole('button', { name: /Notes/i });
      fireEvent.click(datasetsButton);

      // Should show dataset options
      expect(screen.getByText('ETL')).toBeInTheDocument();
      expect(screen.getByText('Catalog')).toBeInTheDocument();
    });

    it('selects a new app when option is clicked', () => {
      renderWithProviders(<Navigator />);

      // Click on the Apps dropdown
      const appsButton = screen.getByRole('button', { name: /Demo/i });
      fireEvent.click(appsButton);

      // Click on 'Inbox' option
      const inboxOption = screen.getByRole('button', { name: /^Inbox$/ });
      fireEvent.click(inboxOption);

      // The dropdown should now show 'Inbox'
      expect(screen.getByRole('button', { name: /Inbox/i })).toBeInTheDocument();
    });

    it('selects a new view when option is clicked', () => {
      renderWithProviders(<Navigator />);

      // Click on the Views dropdown
      const viewsButton = screen.getByRole('button', { name: /Grid/i });
      fireEvent.click(viewsButton);

      // Click on 'Kanban' option
      const kanbanOption = screen.getByRole('button', { name: /^Kanban$/ });
      fireEvent.click(kanbanOption);

      // The dropdown should now show 'Kanban'
      expect(screen.getByRole('button', { name: /Kanban/i })).toBeInTheDocument();
    });
  });

  describe('expand/collapse behavior', () => {
    it('shows PAFVNavigator when expanded (default)', () => {
      renderWithProviders(<Navigator />);

      // PAFVNavigator should be visible by default
      // It renders content with "x Rows", "y Columns", "z Layers" labels
      expect(screen.getByText('x Rows')).toBeInTheDocument();
    });

    it('hides PAFVNavigator when collapsed', () => {
      renderWithProviders(<Navigator />);

      // Click the toggle button to collapse
      const toggleButton = document.querySelector('[class*="w-7"][class*="h-7"]') as HTMLElement;
      fireEvent.click(toggleButton);

      // PAFVNavigator content should be hidden
      expect(screen.queryByText('x Rows')).not.toBeInTheDocument();
    });

    it('shows PAFVNavigator again when re-expanded', () => {
      renderWithProviders(<Navigator />);

      const toggleButton = document.querySelector('[class*="w-7"][class*="h-7"]') as HTMLElement;

      // Collapse
      fireEvent.click(toggleButton);
      expect(screen.queryByText('x Rows')).not.toBeInTheDocument();

      // Re-expand
      fireEvent.click(toggleButton);
      expect(screen.getByText('x Rows')).toBeInTheDocument();
    });
  });

  describe('theme support', () => {
    it('applies NeXTSTEP theme styles', () => {
      render(
        <ThemeProvider defaultTheme="NeXTSTEP">
          <AppStateProvider>
            <Navigator />
          </AppStateProvider>
        </ThemeProvider>
      );

      // NeXTSTEP uses specific bg color
      const container = document.querySelector('[class*="bg-[#b8b8b8]"]');
      expect(container).not.toBeNull();
    });

    it('applies Modern theme styles', () => {
      render(
        <ThemeProvider defaultTheme="Modern">
          <AppStateProvider>
            <Navigator />
          </AppStateProvider>
        </ThemeProvider>
      );

      // Modern theme uses backdrop-blur
      const container = document.querySelector('[class*="backdrop-blur"]');
      expect(container).not.toBeNull();
    });
  });
});
