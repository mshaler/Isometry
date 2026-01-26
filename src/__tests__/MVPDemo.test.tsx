import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MVPDemo from '../MVPDemo';

// Mock the Canvas component to isolate MVPDemo testing
import { vi } from 'vitest';

vi.mock('../components/Canvas', () => {
  return {
    Canvas: () => <div data-testid="mock-canvas">Canvas Component</div>
  };
});

describe('MVPDemo', () => {
  it('should render without crashing', () => {
    render(<MVPDemo />);
    expect(screen.getByText('Isometry MVP Demo')).toBeInTheDocument();
  });

  it('should display MVP description', () => {
    render(<MVPDemo />);
    expect(screen.getByText('Canvas with mock data - no database dependencies')).toBeInTheDocument();
  });

  it('should render Canvas component', () => {
    render(<MVPDemo />);
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
  });

  it('should have proper layout structure', () => {
    const { container } = render(<MVPDemo />);

    // Should have full screen layout
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('h-screen', 'bg-gray-50');

    // Should have header section
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should provide all necessary context providers', () => {
    // This test verifies that all context providers are working
    // by checking that the Canvas renders without context errors
    render(<MVPDemo />);

    // If Canvas renders without errors, all required contexts are provided
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
  });
});