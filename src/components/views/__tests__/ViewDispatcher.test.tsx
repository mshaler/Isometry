/**
 * ViewDispatcher Unit Tests
 *
 * Tests for view routing based on GridContinuumMode.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewDispatcher } from '../ViewDispatcher';

// Mock the view components to avoid complex dependencies
vi.mock('../GalleryView', () => ({
  GalleryView: () => <div data-testid="gallery-view">GalleryView</div>,
}));

vi.mock('../ListView', () => ({
  ListView: () => <div data-testid="list-view">ListView</div>,
}));

vi.mock('../KanbanView', () => ({
  KanbanView: () => <div data-testid="kanban-view">KanbanView</div>,
}));

// cn utility mock
vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

describe('ViewDispatcher', () => {
  describe('routing by activeView', () => {
    it('renders GalleryView for gallery mode', () => {
      render(<ViewDispatcher activeView="gallery" />);
      expect(screen.getByTestId('gallery-view')).toBeInTheDocument();
    });

    it('renders ListView for list mode', () => {
      render(<ViewDispatcher activeView="list" />);
      expect(screen.getByTestId('list-view')).toBeInTheDocument();
    });

    it('renders KanbanView for kanban mode', () => {
      render(<ViewDispatcher activeView="kanban" />);
      expect(screen.getByTestId('kanban-view')).toBeInTheDocument();
    });

    it('renders placeholder for grid mode', () => {
      render(<ViewDispatcher activeView="grid" />);
      expect(screen.getByText('Grid View')).toBeInTheDocument();
      expect(screen.getByText(/2D row x column matrix/)).toBeInTheDocument();
    });

    it('renders placeholder for supergrid mode', () => {
      render(<ViewDispatcher activeView="supergrid" />);
      expect(screen.getByText('SuperGrid View')).toBeInTheDocument();
      expect(screen.getByText(/n-dimensional nested headers/)).toBeInTheDocument();
    });

    it('renders GalleryView as default fallback for unknown mode', () => {
      // @ts-expect-error Testing invalid mode fallback
      render(<ViewDispatcher activeView="invalid-mode" />);
      expect(screen.getByTestId('gallery-view')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies className to grid placeholder', () => {
      const { container } = render(
        <ViewDispatcher activeView="grid" className="custom-class" />
      );
      const placeholder = container.querySelector('.custom-class');
      expect(placeholder).toBeInTheDocument();
    });

    it('applies className to supergrid placeholder', () => {
      const { container } = render(
        <ViewDispatcher activeView="supergrid" className="custom-class" />
      );
      const placeholder = container.querySelector('.custom-class');
      expect(placeholder).toBeInTheDocument();
    });
  });
});
