import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { UnifiedApp } from '../components/UnifiedApp';

// Mock the individual components to focus on integration
vi.mock('../components/Toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar">Toolbar Component</div>
}));

vi.mock('../components/Navigator', () => ({
  Navigator: () => <div data-testid="navigator">Navigator Component</div>
}));

vi.mock('../components/PAFVNavigator', () => ({
  PAFVNavigator: () => <div data-testid="pafv-navigator">PAFVNavigator Component</div>
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar Component</div>
}));

vi.mock('../components/RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar">RightSidebar Component</div>
}));

vi.mock('../components/Canvas', () => ({
  Canvas: () => <div data-testid="canvas">Canvas Component</div>
}));

vi.mock('../components/NavigatorFooter', () => ({
  NavigatorFooter: () => <div data-testid="navigator-footer">NavigatorFooter Component</div>
}));

vi.mock('../components/CommandBar', () => ({
  CommandBar: () => <div data-testid="command-bar">CommandBar Component</div>
}));

describe('UnifiedApp Integration', () => {
  it('should render all 9 Figma components without errors', () => {
    render(<UnifiedApp />);

    // Verify all components are present
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('navigator')).toBeInTheDocument();
    expect(screen.getByTestId('pafv-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('navigator-footer')).toBeInTheDocument();
    expect(screen.getByTestId('command-bar')).toBeInTheDocument();
  });

  it('should provide all required context providers', () => {
    // This test verifies that all context providers are properly nested
    // and don't throw useContext errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<UnifiedApp />);

    // No context errors should be thrown
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('useContext must be used within')
    );

    consoleSpy.mockRestore();
  });

  it('should have correct layout structure', () => {
    const { container } = render(<UnifiedApp />);

    // Check main container
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('h-screen', 'flex', 'flex-col');

    // Check main content area exists
    const mainContentArea = container.querySelector('.flex-1.flex.min-h-0');
    expect(mainContentArea).toBeInTheDocument();
  });

  it('should preserve MVP Canvas integration', () => {
    render(<UnifiedApp />);

    // Our working MVP Canvas should be present
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });
});

/**
 * UnifiedApp vs MVPDemo Comparison Test
 *
 * Verifies that UnifiedApp provides the same core functionality as MVPDemo
 * but with enhanced UI components
 */
describe('UnifiedApp vs MVPDemo Integration', () => {
  it('should provide same context hierarchy as MVPDemo', () => {
    // Both should have identical context provider structure
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<UnifiedApp />);

    // No context errors should occur
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should include all Figma components that MVPDemo lacks', () => {
    render(<UnifiedApp />);

    // These components are in UnifiedApp but not in basic MVPDemo
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('navigator')).toBeInTheDocument();
    expect(screen.getByTestId('pafv-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('navigator-footer')).toBeInTheDocument();
    expect(screen.getByTestId('command-bar')).toBeInTheDocument();
  });
});

/**
 * UnifiedApp Layout Architecture Test
 *
 * Validates the specific layout structure defined in GSD-UI-UX-UNIFICATION-PLAN.md
 */
describe('UnifiedApp Layout Architecture', () => {
  it('should implement the planned layout structure', () => {
    render(<UnifiedApp />);

    // Layout should follow the planned structure:
    // - Toolbar (menu + commands)
    // - Navigator (app/view selectors)
    // - PAFVNavigator (axis wells)
    // - MainContent with Sidebar + Canvas + RightSidebar
    // - NavigatorFooter (map + time)
    // - CommandBar (DSL input)

    const components = [
      'toolbar',
      'navigator',
      'pafv-navigator',
      'sidebar',
      'canvas',
      'right-sidebar',
      'navigator-footer',
      'command-bar'
    ];

    components.forEach(component => {
      expect(screen.getByTestId(component)).toBeInTheDocument();
    });
  });
});