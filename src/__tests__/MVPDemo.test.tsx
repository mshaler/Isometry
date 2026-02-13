import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeAll } from 'vitest';
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

describe('MVPDemo', () => {
  it('should render without crashing', async () => {
    render(<MVPDemo />);
    await waitFor(() => {
      expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();
    });
  });

  it('should display MVP description', async () => {
    render(<MVPDemo />);
    await waitFor(() => {
      expect(screen.getByText('Canvas with mock data - no database dependencies')).toBeInTheDocument();
    });
  });

  it('should render SuperGrid by default', async () => {
    render(<MVPDemo />);
    await waitFor(() => {
      // Default mode is 'supergrid'
      expect(screen.getByTestId('mock-supergrid')).toBeInTheDocument();
    });
  });

  it('should have proper layout structure', async () => {
    const { container } = render(<MVPDemo />);

    await waitFor(() => {
      // Should have full screen layout
      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass('h-screen', 'bg-gray-50');

      // Should have header section
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('should render view mode buttons', async () => {
    render(<MVPDemo />);
    await waitFor(() => {
      expect(screen.getByText('App')).toBeInTheDocument();
      expect(screen.getByText('D3 Demo')).toBeInTheDocument();
      expect(screen.getByText('Supergrid')).toBeInTheDocument();
      expect(screen.getByText('Components')).toBeInTheDocument();
      expect(screen.getByText('Notebook')).toBeInTheDocument();
    });
  });

  it('should switch to App view when App button is clicked', async () => {
    render(<MVPDemo />);

    await waitFor(() => {
      expect(screen.getByText('App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('App'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    });
  });
});
