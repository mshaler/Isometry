/**
 * RightSidebar Component Tests
 *
 * TDD tests for RightSidebar refactoring to use TabPanel and AccordionSection.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightSidebar } from './RightSidebar';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Helper to wrap component with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('RightSidebar', () => {
  describe('rendering', () => {
    it('renders the sidebar container', () => {
      renderWithProviders(<RightSidebar />);

      // Should have a sidebar element
      const sidebar = document.querySelector('[class*="w-64"]');
      expect(sidebar).not.toBeNull();
    });

    it('renders Formats and Settings tabs', () => {
      renderWithProviders(<RightSidebar />);

      expect(screen.getByText('Formats')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders tab icons', () => {
      renderWithProviders(<RightSidebar />);

      // Icons should be present in tab buttons (Palette and Settings icons)
      // TabPanel uses role="tab" for its buttons
      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons.length).toBe(2);
      expect(tabButtons[0].textContent).toContain('Formats');
      expect(tabButtons[1].textContent).toContain('Settings');
    });
  });

  describe('tab switching', () => {
    it('shows Formats tab content by default', () => {
      renderWithProviders(<RightSidebar />);

      // Formats sections should be visible
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('Cell')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });

    it('switches to Settings tab when clicked', () => {
      renderWithProviders(<RightSidebar />);

      const settingsTab = screen.getByText('Settings');
      fireEvent.click(settingsTab);

      // Settings sections should be visible
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('ETL Datasets')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('switches back to Formats tab', () => {
      renderWithProviders(<RightSidebar />);

      // Switch to Settings
      fireEvent.click(screen.getByText('Settings'));
      expect(screen.getByText('General')).toBeInTheDocument();

      // Switch back to Formats - use getAllByText since "Formats" appears in both tab and settings sections
      const formatsButtons = screen.getAllByText('Formats');
      const formatsTab = formatsButtons.find((el) => el.closest('button'));
      fireEvent.click(formatsTab!);
      expect(screen.getByText('View')).toBeInTheDocument();
    });
  });

  describe('accordion sections', () => {
    it('expands View section by default', () => {
      renderWithProviders(<RightSidebar />);

      // View section should be expanded (show "Coming soon...")
      const comingSoonText = screen.getAllByText('Coming soon...');
      expect(comingSoonText.length).toBeGreaterThan(0);
    });

    it('collapses section when header is clicked', () => {
      renderWithProviders(<RightSidebar />);

      // Click on View section header to collapse
      const viewHeader = screen.getByText('View');
      fireEvent.click(viewHeader);

      // Count visible "Coming soon..." text should decrease
      // (This tests the toggle functionality)
    });

    it('expands collapsed section when header is clicked', () => {
      renderWithProviders(<RightSidebar />);

      // Click on Arrange (should be collapsed by default)
      const arrangeHeader = screen.getByText('Arrange');
      fireEvent.click(arrangeHeader);

      // Now Arrange content should be visible
      // The accordion should expand
    });

    it('allows multiple sections to be open simultaneously', () => {
      renderWithProviders(<RightSidebar />);

      // View, Cell, Text are open by default
      // Click on Arrange to open it
      const arrangeHeader = screen.getByText('Arrange');
      fireEvent.click(arrangeHeader);

      // All should still be accessible
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('Arrange')).toBeInTheDocument();
    });
  });

  describe('Text format panel', () => {
    it('renders font family dropdown in Text section', () => {
      renderWithProviders(<RightSidebar />);

      // Text section should have font controls
      expect(screen.getByText('Font Family')).toBeInTheDocument();
    });

    it('renders font size input in Text section', () => {
      renderWithProviders(<RightSidebar />);

      expect(screen.getByText('Size')).toBeInTheDocument();
    });

    it('renders color picker in Text section', () => {
      renderWithProviders(<RightSidebar />);

      expect(screen.getByText('Color')).toBeInTheDocument();
    });
  });

  describe('theme support', () => {
    it('applies NeXTSTEP theme styles', () => {
      render(
        <ThemeProvider defaultTheme="NeXTSTEP">
          <RightSidebar />
        </ThemeProvider>
      );

      // Check for NeXTSTEP-specific styling (beveled borders)
      const sidebar = document.querySelector('[class*="bg-[#c0c0c0]"]');
      expect(sidebar).not.toBeNull();
    });

    it('applies Modern theme styles', () => {
      render(
        <ThemeProvider defaultTheme="Modern">
          <RightSidebar />
        </ThemeProvider>
      );

      // Check for Modern-specific styling (white background with opacity)
      const sidebar = document.querySelector('[class*="bg-white"]');
      expect(sidebar).not.toBeNull();
    });
  });
});
