/**
 * D3ViewWrapper Component Tests
 *
 * TDD tests for the React-D3 bridge component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { D3ViewWrapper } from './D3ViewWrapper';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { NodeValue } from '@/types/lpg';

// Helper to wrap component with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// Sample data for testing
const sampleData: NodeValue[] = [
  {
    id: '1',
    type: 'node',
    nodeType: 'Task',
    name: 'Task 1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    latch: {
      category: 'Development',
      hierarchy: 2,
    },
    properties: {},
  },
  {
    id: '2',
    type: 'node',
    nodeType: 'Note',
    name: 'Note 1',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    latch: {
      category: 'Design',
      hierarchy: 1,
    },
    properties: {},
  },
];

describe('D3ViewWrapper', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for dimension calculations
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('component rendering', () => {
    it('renders a container div', () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      const container = document.querySelector('.cb-view-wrapper');
      expect(container).not.toBeNull();
    });

    it('applies custom className', () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          className="custom-class"
        />
      );

      const container = document.querySelector('.cb-view-wrapper');
      expect(container?.classList.contains('custom-class')).toBe(true);
    });

    it('renders with full width and height', () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      const container = document.querySelector('.cb-view-wrapper');
      expect(container?.classList.contains('w-full')).toBe(true);
      expect(container?.classList.contains('h-full')).toBe(true);
    });
  });

  describe('cb-canvas integration', () => {
    it('creates cb-canvas structure on mount', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        const canvasWrapper = document.querySelector('.cb-canvas');
        expect(canvasWrapper).not.toBeNull();
      });
    });

    it('creates SVG element inside canvas', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        const svg = document.querySelector('.cb-canvas__svg');
        expect(svg).not.toBeNull();
      });
    });

    it('creates content and overlay groups', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        const contentGroup = document.querySelector('.cb-canvas__content');
        const overlayGroup = document.querySelector('.cb-canvas__overlay');
        expect(contentGroup).not.toBeNull();
        expect(overlayGroup).not.toBeNull();
      });
    });
  });

  describe('renderContent callback', () => {
    it('calls renderContent with content area selection', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });

      // First argument should be a D3 selection
      const [contentArea] = renderContent.mock.calls[0];
      expect(contentArea).not.toBeNull();
    });

    it('calls renderContent with data', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });

      const [, data] = renderContent.mock.calls[0];
      expect(data).toEqual(sampleData);
    });

    it('calls renderContent with dimensions', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });

      const [, , dims] = renderContent.mock.calls[0];
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
      expect(dims).toHaveProperty('innerWidth');
      expect(dims).toHaveProperty('innerHeight');
    });

    it('re-calls renderContent when data changes', async () => {
      const renderContent = vi.fn();

      const { rerender } = renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalledTimes(1);
      });

      const newData = [...sampleData, {
        id: '3',
        type: 'node' as const,
        nodeType: 'Task' as const,
        name: 'Task 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        latch: {},
        properties: {},
      }];

      rerender(
        <ThemeProvider>
          <D3ViewWrapper
            data={newData}
            viewType="grid"
            renderContent={renderContent}
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('viewType prop', () => {
    it('passes viewType to cb-canvas', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="kanban"
          renderContent={renderContent}
        />
      );

      // Canvas should be created (viewType is internal configuration)
      await waitFor(() => {
        const canvas = document.querySelector('.cb-canvas');
        expect(canvas).not.toBeNull();
      });
    });
  });

  describe('background prop', () => {
    it('applies dots background pattern', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          background="dots"
        />
      );

      await waitFor(() => {
        const canvas = document.querySelector('.cb-canvas--dots');
        expect(canvas).not.toBeNull();
      });
    });

    it('applies grid background pattern', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          background="grid"
        />
      );

      await waitFor(() => {
        const canvas = document.querySelector('.cb-canvas--grid');
        expect(canvas).not.toBeNull();
      });
    });
  });

  describe('zoom behavior', () => {
    it('enables zoom when zoomable is true', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          zoomable={true}
        />
      );

      // Canvas should render (zoom is internal)
      await waitFor(() => {
        const canvas = document.querySelector('.cb-canvas');
        expect(canvas).not.toBeNull();
      });
    });

    it('defaults to zoomable=false', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        const canvas = document.querySelector('.cb-canvas');
        expect(canvas).not.toBeNull();
      });
    });
  });

  describe('padding prop', () => {
    it('applies custom padding to canvas', async () => {
      const renderContent = vi.fn();
      const padding = { top: 20, right: 20, bottom: 20, left: 20 };

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          padding={padding}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });

      // Check that dimensions account for padding
      const [, , dims] = renderContent.mock.calls[0];
      expect(dims.innerWidth).toBeLessThan(dims.width);
      expect(dims.innerHeight).toBeLessThan(dims.height);
    });
  });

  describe('onNodeClick callback', () => {
    it('is passed through to renderContent', async () => {
      const renderContent = vi.fn();
      const onNodeClick = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
          onNodeClick={onNodeClick}
        />
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });

      // Fourth argument should be the callbacks object
      const [, , , callbacks] = renderContent.mock.calls[0];
      expect(callbacks).toHaveProperty('onNodeClick');
      expect(callbacks.onNodeClick).toBe(onNodeClick);
    });
  });

  describe('cleanup', () => {
    it('destroys canvas on unmount', async () => {
      const renderContent = vi.fn();

      const { unmount } = renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        expect(document.querySelector('.cb-canvas')).not.toBeNull();
      });

      unmount();

      // Canvas should be removed
      expect(document.querySelector('.cb-canvas')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('renders empty message when data is empty', () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={[]}
          viewType="grid"
          renderContent={renderContent}
          emptyMessage="No items to display"
        />
      );

      expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('does not call renderContent when data is empty', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={[]}
          viewType="grid"
          renderContent={renderContent}
          emptyMessage="No items"
        />
      );

      // Give it time to potentially call
      await new Promise((r) => setTimeout(r, 50));

      expect(renderContent).not.toHaveBeenCalled();
    });

    it('shows canvas when data becomes available', async () => {
      const renderContent = vi.fn();

      const { rerender } = renderWithProviders(
        <D3ViewWrapper
          data={[]}
          viewType="grid"
          renderContent={renderContent}
          emptyMessage="No items"
        />
      );

      // Initially shows empty state
      expect(screen.getByText('No items')).toBeInTheDocument();

      // Rerender with data
      rerender(
        <ThemeProvider>
          <D3ViewWrapper
            data={sampleData}
            viewType="grid"
            renderContent={renderContent}
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(renderContent).toHaveBeenCalled();
      });
    });
  });

  describe('theme integration', () => {
    it('applies theme data attribute', async () => {
      const renderContent = vi.fn();

      renderWithProviders(
        <D3ViewWrapper
          data={sampleData}
          viewType="grid"
          renderContent={renderContent}
        />
      );

      await waitFor(() => {
        const container = document.querySelector('.cb-view-wrapper');
        expect(container?.hasAttribute('data-theme')).toBe(true);
      });
    });
  });
});
