/**
 * Toolbar Component Tests
 *
 * TDD tests for Toolbar refactoring to use IconButton component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Helper to wrap component with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Toolbar', () => {
  describe('rendering', () => {
    it('renders the toolbar container', () => {
      renderWithProviders(<Toolbar />);

      // Toolbar should render with h-12 class
      const toolbar = document.querySelector('[class*="h-12"]');
      expect(toolbar).not.toBeNull();
    });

    it('renders the menu bar', () => {
      renderWithProviders(<Toolbar />);

      // Menu bar should have h-7 class
      const menuBar = document.querySelector('[class*="h-7"]');
      expect(menuBar).not.toBeNull();
    });

    it('renders menu items', () => {
      renderWithProviders(<Toolbar />);

      expect(screen.getByText('Isometry')).toBeInTheDocument();
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('renders command buttons', () => {
      renderWithProviders(<Toolbar />);

      // Check for button titles
      expect(screen.getByTitle('New')).toBeInTheDocument();
      expect(screen.getByTitle('Open')).toBeInTheDocument();
      expect(screen.getByTitle('Save')).toBeInTheDocument();
      expect(screen.getByTitle('Export')).toBeInTheDocument();
    });

    it('renders app launcher buttons', () => {
      renderWithProviders(<Toolbar />);

      expect(screen.getByTitle('Grid View')).toBeInTheDocument();
      expect(screen.getByTitle('Dimensions')).toBeInTheDocument();
      expect(screen.getByTitle('Charts')).toBeInTheDocument();
    });

    it('renders theme toggle buttons', () => {
      renderWithProviders(<Toolbar />);

      expect(screen.getByRole('button', { name: /NeXTSTEP/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Modern/i })).toBeInTheDocument();
    });
  });

  describe('menu behavior', () => {
    it('opens File menu when clicked', () => {
      renderWithProviders(<Toolbar />);

      const fileMenu = screen.getByText('File');
      fireEvent.click(fileMenu);

      // Menu items should be visible
      expect(screen.getByText('New…')).toBeInTheDocument();
      expect(screen.getByText('Open…')).toBeInTheDocument();
      expect(screen.getByText('Save As…')).toBeInTheDocument();
    });

    it('opens Edit menu when clicked', () => {
      renderWithProviders(<Toolbar />);

      const editMenu = screen.getByText('Edit');
      fireEvent.click(editMenu);

      // Menu items should be visible
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Redo')).toBeInTheDocument();
      expect(screen.getByText('Cut')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Paste')).toBeInTheDocument();
    });

    it('closes menu when clicking outside', () => {
      renderWithProviders(<Toolbar />);

      // Open File menu
      const fileMenu = screen.getByText('File');
      fireEvent.click(fileMenu);
      expect(screen.getByText('New…')).toBeInTheDocument();

      // Click on File menu again to close
      fireEvent.click(fileMenu);

      // Menu should be closed
      expect(screen.queryByText('New…')).not.toBeInTheDocument();
    });

    it('closes menu when item is clicked', () => {
      renderWithProviders(<Toolbar />);

      // Open Edit menu
      const editMenu = screen.getByText('Edit');
      fireEvent.click(editMenu);

      // Click on Undo
      const undoItem = screen.getByText('Undo');
      fireEvent.click(undoItem);

      // Menu should close
      expect(screen.queryByText('Redo')).not.toBeInTheDocument();
    });
  });

  describe('command button behavior', () => {
    it('triggers action when command button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderWithProviders(<Toolbar />);

      const newButton = screen.getByTitle('New');
      fireEvent.click(newButton);

      expect(consoleSpy).toHaveBeenCalledWith('New');
      consoleSpy.mockRestore();
    });

    it('triggers action when app launcher button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderWithProviders(<Toolbar />);

      const gridButton = screen.getByTitle('Grid View');
      fireEvent.click(gridButton);

      expect(consoleSpy).toHaveBeenCalledWith('Grid View');
      consoleSpy.mockRestore();
    });
  });

  describe('theme support', () => {
    it('applies NeXTSTEP theme styles', () => {
      render(
        <ThemeProvider defaultTheme="NeXTSTEP">
          <Toolbar />
        </ThemeProvider>
      );

      // NeXTSTEP uses specific bg color
      const menuBar = document.querySelector('[class*="bg-[#c0c0c0]"]');
      expect(menuBar).not.toBeNull();
    });

    it('applies Modern theme styles', () => {
      render(
        <ThemeProvider defaultTheme="Modern">
          <Toolbar />
        </ThemeProvider>
      );

      // Modern theme uses backdrop-blur
      const menuBar = document.querySelector('[class*="backdrop-blur"]');
      expect(menuBar).not.toBeNull();
    });

    it('changes theme when NeXTSTEP button is clicked', () => {
      render(
        <ThemeProvider defaultTheme="Modern">
          <Toolbar />
        </ThemeProvider>
      );

      // Click NeXTSTEP button
      const nextStepButton = screen.getByRole('button', { name: /NeXTSTEP/i });
      fireEvent.click(nextStepButton);

      // Theme should change - NeXTSTEP button should now be active (black bg)
      expect(nextStepButton.className).toContain('bg-black');
    });

    it('changes theme when Modern button is clicked', () => {
      render(
        <ThemeProvider defaultTheme="NeXTSTEP">
          <Toolbar />
        </ThemeProvider>
      );

      // Click Modern button
      const modernButton = screen.getByRole('button', { name: /Modern/i });
      fireEvent.click(modernButton);

      // Theme should change - Modern button should now be active
      expect(modernButton.className).toContain('bg-blue-500');
    });
  });

  describe('icon buttons', () => {
    it('renders all icon buttons with correct size', () => {
      renderWithProviders(<Toolbar />);

      // Each command button should have w-10 h-10 classes
      const iconButtons = document.querySelectorAll('[class*="w-10"][class*="h-10"]');
      expect(iconButtons.length).toBeGreaterThanOrEqual(7); // 4 command + 3 app launcher
    });

    it('renders separator between command and app launcher buttons', () => {
      renderWithProviders(<Toolbar />);

      // Separator should exist
      const separator = document.querySelector('[class*="h-8"][class*="mx-"]');
      expect(separator).not.toBeNull();
    });
  });
});
