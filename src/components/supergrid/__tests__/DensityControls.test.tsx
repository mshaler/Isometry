/**
 * DensityControls Tests - Janus density model UI controls
 *
 * TDD: These tests define the expected behavior for the DensityControls component.
 * - Value Density slider: 0 to maxValueLevel
 * - Extent Density toggle: dense | sparse | ultra-sparse
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DensityControls } from '../DensityControls';
import type { ExtentMode } from '@/d3/SuperGridEngine/DataManager';

describe('DensityControls', () => {
  const mockOnValueDensityChange = vi.fn();
  const mockOnExtentDensityChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render value density slider and extent toggle', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      // Should show value density slider
      expect(screen.getByRole('slider')).toBeInTheDocument();

      // Should show extent density buttons (use exact match to avoid overlap)
      expect(screen.getByRole('button', { name: /^dense$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sparse$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^ultra-sparse$/i })).toBeInTheDocument();
    });

    it('should display current value density level', () => {
      render(
        <DensityControls
          valueDensity={2}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      // Slider should reflect current value
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('2');
    });

    it('should highlight active extent density mode', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="sparse"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      // Use exact text match to avoid matching "Ultra-Sparse"
      const sparseButton = screen.getByRole('button', { name: /^sparse$/i });
      expect(sparseButton).toHaveAttribute('data-active', 'true');

      const denseButton = screen.getByRole('button', { name: /^dense$/i });
      expect(denseButton).toHaveAttribute('data-active', 'false');
    });
  });

  describe('Value Density Slider Interaction', () => {
    it('should call onValueDensityChange when slider moves', async () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '2' } });

      await waitFor(() => {
        expect(mockOnValueDensityChange).toHaveBeenCalledWith(2);
      });
    });

    it('should not exceed maxValueLevel', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('max', '3');
    });

    it('should have min value of 0', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '0');
    });
  });

  describe('Extent Density Toggle Interaction', () => {
    it('should call onExtentDensityChange when dense button clicked', async () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="sparse"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const denseButton = screen.getByRole('button', { name: /dense/i });
      fireEvent.click(denseButton);

      await waitFor(() => {
        expect(mockOnExtentDensityChange).toHaveBeenCalledWith('dense');
      });
    });

    it('should call onExtentDensityChange when sparse button clicked', async () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      // Use exact text match to avoid matching "Ultra-Sparse"
      const sparseButton = screen.getByRole('button', { name: /^sparse$/i });
      fireEvent.click(sparseButton);

      await waitFor(() => {
        expect(mockOnExtentDensityChange).toHaveBeenCalledWith('sparse');
      });
    });

    it('should call onExtentDensityChange when ultra-sparse button clicked', async () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const ultraSparseButton = screen.getByRole('button', { name: /ultra-sparse/i });
      fireEvent.click(ultraSparseButton);

      await waitFor(() => {
        expect(mockOnExtentDensityChange).toHaveBeenCalledWith('ultra-sparse');
      });
    });
  });

  describe('Label Display', () => {
    it('should show "Value Density" label for slider', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      expect(screen.getByText(/value density/i)).toBeInTheDocument();
    });

    it('should show "Extent Density" label for toggle', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      expect(screen.getByText(/extent density/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible slider with aria-label', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-label');
    });

    it('should have role="group" for extent toggle buttons', () => {
      render(
        <DensityControls
          valueDensity={0}
          maxValueLevel={3}
          extentDensity="dense"
          onValueDensityChange={mockOnValueDensityChange}
          onExtentDensityChange={mockOnExtentDensityChange}
        />
      );

      const toggleGroup = screen.getByRole('group');
      expect(toggleGroup).toBeInTheDocument();
    });
  });
});
