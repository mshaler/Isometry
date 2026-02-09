/**
 * Grid Continuum Switcher Tests
 *
 * Tests the UI component that allows switching between the 5 Grid Continuum modes:
 * Gallery → List → Kanban → Grid → SuperGrid
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridContinuumSwitcher } from '../GridContinuumSwitcher';
import type { GridContinuumMode } from '@/types/view';

describe('GridContinuumSwitcher', () => {
  const mockOnModeChange = vi.fn();

  beforeEach(() => {
    mockOnModeChange.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders all 5 Grid Continuum modes', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
        />
      );

      // Check all 5 modes are present
      expect(screen.getByRole('button', { name: /^gallery/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^list/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^kanban/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /supergrid/i })).toBeInTheDocument();

      // Handle Grid vs SuperGrid naming conflict by checking button count
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('shows current mode as active', () => {
      render(
        <GridContinuumSwitcher
          currentMode="kanban"
          onModeChange={mockOnModeChange}
        />
      );

      const kanbanButton = screen.getByRole('button', { name: /kanban/i });
      expect(kanbanButton).toHaveClass('active');

      // Other buttons should not be active
      expect(screen.getByRole('button', { name: /gallery/i })).not.toHaveClass('active');
      expect(screen.getByRole('button', { name: /list/i })).not.toHaveClass('active');
    });
  });

  describe('Mode Switching', () => {
    it('calls onModeChange when different mode is clicked', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /list/i }));
      expect(mockOnModeChange).toHaveBeenCalledWith('list');
    });

    it('does not call onModeChange when current mode is clicked', () => {
      render(
        <GridContinuumSwitcher
          currentMode="supergrid"
          onModeChange={mockOnModeChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /supergrid/i }));
      expect(mockOnModeChange).not.toHaveBeenCalled();
    });

    it('switches between all 5 modes correctly', () => {
      render(
        <GridContinuumSwitcher
          currentMode="gallery"
          onModeChange={mockOnModeChange}
        />
      );

      // Test specific mode transitions
      fireEvent.click(screen.getByRole('button', { name: /^list/i }));
      expect(mockOnModeChange).toHaveBeenNthCalledWith(1, 'list');

      fireEvent.click(screen.getByRole('button', { name: /^kanban/i }));
      expect(mockOnModeChange).toHaveBeenNthCalledWith(2, 'kanban');

      fireEvent.click(screen.getByRole('button', { name: /supergrid/i }));
      expect(mockOnModeChange).toHaveBeenNthCalledWith(3, 'supergrid');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
        />
      );

      const switcher = screen.getByRole('group');
      expect(switcher).toHaveAttribute('aria-label', 'Grid Continuum Mode Switcher');

      // Each button should have aria-pressed - use getAllByRole to handle duplicates
      const buttons = screen.getAllByRole('button');
      const gridButton = buttons.find(btn => btn.textContent?.includes('Grid') && !btn.textContent?.includes('SuperGrid'));
      expect(gridButton).toHaveAttribute('aria-pressed', 'true');

      const listButton = screen.getByRole('button', { name: /^list$/i });
      expect(listButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('supports keyboard navigation', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
        />
      );

      const listButton = screen.getByRole('button', { name: /list/i });
      listButton.focus();
      fireEvent.keyDown(listButton, { key: 'Enter' });

      expect(mockOnModeChange).toHaveBeenCalledWith('list');
    });
  });

  describe('Visual Feedback', () => {
    it('shows mode transition feedback', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
          showTransitionFeedback={true}
        />
      );

      const switcher = screen.getByRole('group');
      expect(switcher).toHaveClass('grid-continuum-switcher--transitioning');
    });

    it('displays mode descriptions on hover', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={mockOnModeChange}
        />
      );

      const galleryButton = screen.getByRole('button', { name: /gallery/i });
      expect(galleryButton).toHaveAttribute('title', expect.stringContaining('position-only'));
    });
  });
});