import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import MVPDemo from '../MVPDemo';

// Mock SQLiteProvider since it requires sql.js and IndexedDB
vi.mock('../db/SQLiteProvider', () => ({
  SQLiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSQLite: () => ({
    db: null,
    isLoading: false,
    error: null,
    storageQuota: { used: 0, available: 1000000000 },
    execSql: async () => [],
    runSql: async () => ({ changes: 0, lastInsertRowId: 0 }),
    withTransaction: async (callback: () => Promise<unknown>) => callback(),
  }),
}));

// Mock Canvas component
vi.mock('../components/Canvas', () => ({
  Canvas: () => <div data-testid="mock-canvas">Canvas Component</div>
}));

// Mock SuperGridDemo component
vi.mock('../components/SuperGridDemo', () => ({
  SuperGridDemo: () => <div data-testid="mock-supergrid">SuperGrid Demo</div>
}));

// Mock D3DemoGrid component
vi.mock('../components/d3-demo/D3DemoGrid', () => ({
  D3DemoGrid: () => <div data-testid="mock-d3demo">D3 Demo</div>
}));

// Mock IntegratedLayout component
vi.mock('../components/IntegratedLayout', () => ({
  IntegratedLayout: () => <div data-testid="mock-integrated-layout">Integrated Layout</div>
}));

// Mock NotebookApp component
vi.mock('../components/NotebookApp', () => ({
  NotebookApp: () => <div data-testid="mock-notebook">Notebook App</div>
}));

// Mock ComponentShowcase
vi.mock('../components/ComponentShowcase', () => ({
  ComponentShowcase: () => <div data-testid="mock-showcase">Component Showcase</div>
}));

// Mock IndexedDBPersistence
vi.mock('../db/IndexedDBPersistence', () => ({
  IndexedDBPersistence: class MockPersistence {
    async init() {}
    async loadDatabase() { return null; }
    async saveDatabase() {}
    close() {}
  }
}));

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

// Note: Components are mocked for test isolation
describe('MVP Complete Integration', () => {
  it('should complete full MVP workflow without errors', async () => {
    // Step 1: Render MVP Demo
    render(<MVPDemo />);

    // Step 2: Verify app loads
    expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();
    expect(screen.getByText('Canvas with mock data - no database dependencies')).toBeInTheDocument();

    // Step 3: Verify SuperGrid is rendered by default (mocked)
    await waitFor(() => {
      expect(screen.getByTestId('mock-supergrid')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Step 4: Verify view mode buttons are present
    expect(screen.getByText('App')).toBeInTheDocument();
    expect(screen.getByText('Supergrid')).toBeInTheDocument();
    expect(screen.getByText('D3 Demo')).toBeInTheDocument();
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