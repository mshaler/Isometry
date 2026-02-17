import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotebookLayout } from './NotebookLayout';

// Mock react-resizable-panels (v3 API: Group/Panel/Separator)
vi.mock('react-resizable-panels', () => ({
  Group: ({ children, className, onLayoutChanged, defaultLayout, ...props }: {
    children: React.ReactNode;
    className?: string;
    onLayoutChanged?: (layout: Record<string, number>) => void;
    defaultLayout?: Record<string, number>;
    [key: string]: unknown;
  }) => (
    <div data-testid="panel-group" className={className} {...props}>
      {children}
    </div>
  ),
  Panel: ({ children, id, panelRef, defaultSize, minSize, collapsible, ...props }: {
    children: React.ReactNode;
    id?: string;
    panelRef?: React.Ref<unknown>;
    defaultSize?: number;
    minSize?: number;
    collapsible?: boolean;
    [key: string]: unknown;
  }) => (
    <div data-testid="panel" data-panel-id={id} {...props}>
      {children}
    </div>
  ),
  Separator: ({ onDoubleClick, className, ...props }: {
    onDoubleClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <div
      data-testid="panel-resize-handle"
      className={className}
      onDoubleClick={onDoubleClick}
      {...props}
    />
  ),
}));

// Mock heavy child components to isolate layout behavior
vi.mock('./CaptureComponent', () => ({
  CaptureComponent: ({ className }: { className?: string }) => (
    <div data-testid="capture-component" className={className}>Capture</div>
  ),
}));

vi.mock('./ShellComponent', () => ({
  ShellComponent: ({ className }: { className?: string }) => (
    <div data-testid="shell-component" className={className}>Shell</div>
  ),
}));

vi.mock('./PreviewComponent', () => ({
  PreviewComponent: ({ className }: { className?: string }) => (
    <div data-testid="preview-component" className={className}>Preview</div>
  ),
}));

// Mock TerminalContext to avoid dependencies
vi.mock('../../context/TerminalContext', () => ({
  TerminalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock FocusContext to avoid dependencies
vi.mock('../../context/FocusContext', () => ({
  FocusProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFocusContext: () => ({ focusComponent: vi.fn() }),
  useFocusableComponent: () => ({ current: null }),
}));

// Mock ErrorBoundary to pass-through
vi.mock('../ui/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => mockStorage[k] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { mockStorage[k] = String(v); });
  // Force desktop size for panel tests
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NotebookLayout', () => {
  it('renders three panels on desktop', () => {
    render(<NotebookLayout />);
    expect(screen.getAllByTestId('panel')).toHaveLength(3);
  });

  it('renders two resize handles on desktop', () => {
    render(<NotebookLayout />);
    expect(screen.getAllByTestId('panel-resize-handle')).toHaveLength(2);
  });

  it('renders Capture, Shell, and Preview components', () => {
    render(<NotebookLayout />);
    expect(screen.getByTestId('capture-component')).toBeDefined();
    expect(screen.getByTestId('shell-component')).toBeDefined();
    expect(screen.getByTestId('preview-component')).toBeDefined();
  });

  it('renders a PanelGroup container on desktop', () => {
    render(<NotebookLayout />);
    expect(screen.getByTestId('panel-group')).toBeDefined();
  });

  it('reads panel layout from localStorage on mount', () => {
    const storedLayout = JSON.stringify({ capture: 40, shell: 30, preview: 30 });
    mockStorage['notebook-panels'] = storedLayout;
    render(<NotebookLayout />);
    expect(Storage.prototype.getItem).toHaveBeenCalledWith('notebook-panels');
  });

  it('handles corrupted localStorage gracefully', () => {
    mockStorage['notebook-panels'] = 'not-valid-json{{{';
    expect(() => render(<NotebookLayout />)).not.toThrow();
    expect(screen.getAllByTestId('panel')).toHaveLength(3);
  });

  it('double-click on resize handle does not throw', () => {
    render(<NotebookLayout />);
    const handles = screen.getAllByTestId('panel-resize-handle');
    expect(() => fireEvent.dblClick(handles[0])).not.toThrow();
  });

  it('panels have correct IDs for identification', () => {
    render(<NotebookLayout />);
    const panels = screen.getAllByTestId('panel');
    const ids = panels.map(p => p.getAttribute('data-panel-id'));
    expect(ids).toContain('capture');
    expect(ids).toContain('shell');
    expect(ids).toContain('preview');
  });
});
