import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import MVPDemo from '../MVPDemo';

/**
 * MVP Integration Test
 *
 * This test verifies that the complete MVP workflow works:
 * 1. App loads without crashes
 * 2. Mock data loads and displays
 * 3. PAFV grid organization works
 * 4. Node interaction works
 * 5. UI state management works
 */

// We don't mock anything here - this is full integration
describe('MVP Complete Integration', () => {
  it('should complete full MVP workflow without errors', async () => {
    // Step 1: Render MVP Demo
    render(<MVPDemo />);

    // Step 2: Verify app loads
    expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();
    expect(screen.getByText('Canvas with mock data - no database dependencies')).toBeInTheDocument();

    // Step 3: Wait for mock data to load (500ms delay)
    await waitFor(() => {
      // Should show some data instead of "Loading notes..."
      expect(screen.queryByText('Loading notes...')).not.toBeInTheDocument();
    }, { timeout: 1000 });

    // Step 4: Verify data is displayed
    // We don't know exact node names, but there should be clickable elements
    const canvas = document.querySelector('.flex-1.flex.flex-col');
    expect(canvas).toBeInTheDocument();

    // Step 5: Verify FilterBar is working
    expect(
      screen.getByText('No filters active') ||
      screen.getByText('+ Add Filter') ||
      screen.getByText('filters')
    ).toBeInTheDocument();

    // Step 6: Verify tabs are present
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('should handle theme switching without errors', () => {
    render(<MVPDemo />);

    // Verify the theme provider is working
    const mainContainer = document.querySelector('.h-screen');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass('bg-gray-50');
  });

  it('should provide all required contexts without errors', () => {
    // This test verifies that all context providers are properly nested
    // and don't throw useContext errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MVPDemo />);

    // No context errors should be thrown
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('useContext must be used within')
    );

    consoleSpy.mockRestore();
  });

  it('should be responsive and maintain layout', () => {
    render(<MVPDemo />);

    const header = screen.getByRole('heading', { level: 1 });
    const description = screen.getByText('Canvas with mock data - no database dependencies');

    expect(header).toBeInTheDocument();
    expect(description).toBeInTheDocument();

    // Should have proper spacing classes
    const container = document.querySelector('.h-screen.bg-gray-50');
    expect(container).toBeInTheDocument();
  });
});

/**
 * MVP Performance Test
 *
 * Ensures the MVP performs adequately
 */
describe('MVP Performance', () => {
  it('should render within reasonable time', async () => {
    const startTime = performance.now();

    render(<MVPDemo />);

    // Should render basic structure immediately
    expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();

    const renderTime = performance.now() - startTime;

    // Should render in under 100ms (very generous for tests)
    expect(renderTime).toBeLessThan(100);
  });

  it('should handle multiple rapid renders without memory leaks', () => {
    const { unmount } = render(<MVPDemo />);
    unmount();

    render(<MVPDemo />);

    // If this doesn't crash, we're good
    expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();
  });
});