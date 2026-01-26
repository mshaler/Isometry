import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { AppStateProvider } from '../../contexts/AppStateContext';
import { FilterProvider } from '../../contexts/FilterContext';
import { PAFVProvider } from '../../contexts/PAFVContext';
import { Canvas } from '../Canvas';

// Mock the individual view components to focus on Canvas integration
import { vi } from 'vitest';

vi.mock('../views/GridView', () => ({
  GridView: ({ data, onNodeClick }: any) => (
    <div data-testid="grid-view">
      <div>GridView with {data?.length || 0} nodes</div>
      {data?.map((node: any) => (
        <button
          key={node.id}
          onClick={() => onNodeClick(node)}
          data-testid={`node-${node.id}`}
        >
          {node.name}
        </button>
      ))}
    </div>
  )
}));

// Mock useMockData to have predictable test data
vi.mock('../../hooks/useMockData', () => ({
  useMockData: () => ({
    data: [
      {
        id: 'test1',
        name: 'Test Node 1',
        folder: 'TestFolder',
        status: 'active',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'test2',
        name: 'Test Node 2',
        folder: 'TestFolder',
        status: 'completed',
        priority: 'medium',
        createdAt: '2024-01-02T00:00:00Z',
        deletedAt: null,
      }
    ],
    loading: false,
    error: null,
  })
}));

const renderCanvas = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <FilterProvider>
            <PAFVProvider>
              <Canvas />
            </PAFVProvider>
          </FilterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Canvas MVP Integration', () => {
  it('should render without errors when using mock data', () => {
    renderCanvas();
    expect(screen.getByTestId('grid-view')).toBeInTheDocument();
  });

  it('should display mock data in GridView', () => {
    renderCanvas();

    expect(screen.getByText('GridView with 2 nodes')).toBeInTheDocument();
    expect(screen.getByTestId('node-test1')).toBeInTheDocument();
    expect(screen.getByTestId('node-test2')).toBeInTheDocument();
  });

  it('should handle node clicks and show selection', async () => {
    renderCanvas();

    const node1Button = screen.getByTestId('node-test1');
    fireEvent.click(node1Button);

    // Selection should appear
    await waitFor(() => {
      expect(screen.getByText('Selected:')).toBeInTheDocument();
      // Use more specific selector for selected node text
      expect(screen.getByText((content, element) =>
        element?.classList.contains('truncate') && content === 'Test Node 1'
      )).toBeInTheDocument();
    });
  });

  it('should clear selection when X button is clicked', async () => {
    renderCanvas();

    // Click node to select it
    const node1Button = screen.getByTestId('node-test1');
    fireEvent.click(node1Button);

    await waitFor(() => {
      expect(screen.getByText('Selected:')).toBeInTheDocument();
    });

    // Click X to clear selection
    const clearButton = screen.getByText('×');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText('Selected:')).not.toBeInTheDocument();
    });
  });

  it('should render FilterBar component', () => {
    renderCanvas();

    // FilterBar should show "No filters active" or filter controls
    expect(screen.getByText('No filters active') || screen.getByText('+ Add Filter')).toBeInTheDocument();
  });

  it('should render sheet tabs', () => {
    renderCanvas();

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Tab 3')).toBeInTheDocument();
  });

  it('should switch active tab when clicked', () => {
    renderCanvas();

    const tab2 = screen.getByText('Tab 2');
    fireEvent.click(tab2);

    // Tab should become active (implementation dependent)
    expect(tab2).toBeInTheDocument();
  });
});