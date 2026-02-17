/**
 * PreviewSelectionSync.test.tsx
 * Tests proving SuperGrid clicks in PreviewComponent update SelectionContext.
 * Gap closure for 115-VERIFICATION.md Gap 1.
 *
 * Phase 115-03: Cross-Canvas Messaging
 *
 * Strategy: Mock SuperGrid to capture the onCellClick handler, then verify
 * calling it calls select() from SelectionContext with the correct node ID.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ─── Mock: ThemeContext ───────────────────────────────────────────────────────

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'modern' }),
}));

// ─── Mock: NotebookContext with test cards ────────────────────────────────────

const testCards = [
  { id: 'card-1', nodeId: 'node-1', markdownContent: '# Test Card 1', cardType: 'capture' },
  { id: 'card-2', nodeId: 'node-2', markdownContent: '# Test Card 2', cardType: 'capture' },
];

const mockSetActiveCard = vi.fn();

vi.mock('../../../contexts/NotebookContext', () => ({
  useNotebook: () => ({
    cards: testCards,
    activeCard: null,
    setActiveCard: mockSetActiveCard,
  }),
}));

// ─── Mock: SelectionContext ───────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockClear = vi.fn();

vi.mock('../../../state/SelectionContext', () => ({
  useSelection: () => ({
    selection: { lastSelectedId: null, selectedIds: new Set(), anchorId: null },
    select: mockSelect,
    deselect: vi.fn(),
    toggle: vi.fn(),
    selectRange: vi.fn(),
    selectMultiple: vi.fn(),
    clear: mockClear,
    isSelected: vi.fn().mockReturnValue(false),
    setCells: vi.fn(),
    scrollToNode: null,
    registerScrollToNode: vi.fn(),
    unregisterScrollToNode: vi.fn(),
  }),
}));

// ─── Mock: usePreviewSettings hook ───────────────────────────────────────────

vi.mock('@/hooks/ui', () => ({
  usePreviewSettings: () => ({
    activeTab: 'supergrid',
    setActiveTab: vi.fn(),
    getTabConfig: () => ({ zoomLevel: 100 }),
    setTabZoom: vi.fn(),
  }),
}));

// ─── Mock: useWebPreview hook ─────────────────────────────────────────────────

vi.mock('@/hooks', () => ({
  useWebPreview: () => ({
    content: '',
    contentType: 'text/html',
    isLoading: false,
    error: null,
    zoom: 100,
    loadUrl: vi.fn(),
    setZoom: vi.fn(),
    refresh: vi.fn(),
    canGoBack: false,
    canGoForward: false,
    goBack: vi.fn(),
    goForward: vi.fn(),
  }),
}));

// ─── Mock: PAFVContext (avoid throwing when absent) ───────────────────────────

vi.mock('../../../hooks/data/usePAFV', () => ({
  PAFVContext: React.createContext(null),
}));

// ─── Mock: SuperGrid — capture onCellClick for testing ───────────────────────

let capturedOnCellClick: ((node: { id: string }) => void) | null = null;

vi.mock('../../supergrid/SuperGrid', () => ({
  SuperGrid: ({ onCellClick }: { onCellClick?: (node: { id: string }) => void }) => {
    capturedOnCellClick = onCellClick || null;
    return <div data-testid="supergrid-mock">SuperGrid Mock</div>;
  },
}));

// ─── Mock: Preview tabs ───────────────────────────────────────────────────────

vi.mock('../preview-tabs', () => ({
  NetworkGraphTab: () => <div data-testid="network-tab" />,
  DataInspectorTab: () => <div data-testid="inspector-tab" />,
  TimelineTab: () => <div data-testid="timeline-tab" />,
}));

// ─── Mock: D3VisualizationRenderer ───────────────────────────────────────────

vi.mock('../D3VisualizationRenderer', () => ({
  D3VisualizationRenderer: () => <div data-testid="d3-renderer" />,
}));

// ─── Mock: MDEditor ──────────────────────────────────────────────────────────

vi.mock('@uiw/react-md-editor', () => ({
  default: {
    Markdown: () => <div data-testid="md-editor" />,
  },
}));

// ─── Mock: Export utilities ───────────────────────────────────────────────────

vi.mock('../../../utils/import-export/exportUtils', () => ({
  exportToPDF: vi.fn(),
  exportToHTML: vi.fn(),
  exportToJSON: vi.fn(),
}));

// ─── Import component under test ──────────────────────────────────────────────

import { PreviewComponent } from '../PreviewComponent';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PreviewComponent SuperGrid Selection Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnCellClick = null;
  });

  it('calls select() when SuperGrid cell is clicked with a matching card', () => {
    render(<PreviewComponent />);

    // Verify SuperGrid rendered and we captured the onCellClick handler
    expect(capturedOnCellClick).not.toBeNull();

    // Simulate SuperGrid cell click with a node that has a matching card
    capturedOnCellClick!({ id: 'node-1' });

    // Verify select() was called with the node ID
    expect(mockSelect).toHaveBeenCalledWith('node-1');
    // Verify setActiveCard was also called for cross-canvas sync
    expect(mockSetActiveCard).toHaveBeenCalledWith(testCards[0]);
  });

  it('does not call select() when node ID has no matching card', () => {
    render(<PreviewComponent />);

    // Verify we captured the handler
    expect(capturedOnCellClick).not.toBeNull();

    // Click with a node ID that has no matching card
    capturedOnCellClick!({ id: 'unknown-node-99' });

    // select() should not be called — no card found means no sync
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockSetActiveCard).not.toHaveBeenCalled();
  });
});
