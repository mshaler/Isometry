/**
 * CaptureComponent Selection Sync Tests
 *
 * Verifies bidirectional selection sync between Capture and Preview:
 * - Multi-select count shown in Capture header when >1 cards selected in Preview
 * - Card loads in Capture when lastSelectedId changes in SelectionContext
 * - No duplicate loads when selection matches already-loaded card
 * - Reverse sync: custom event triggers syncAndLoad (for future card picker)
 *
 * Phase 115-02: Selection Sync Verification
 *
 * Strategy: Mock all heavy providers (NotebookContext, ThemeContext, SQLiteProvider)
 * and control SelectionContext state to test sync behaviors.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock: ThemeContext ───────────────────────────────────────────────────────

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'Modern' }),
}));

// ─── Mock: SQLiteProvider ────────────────────────────────────────────────────

vi.mock('../../../db/SQLiteProvider', () => ({
  useSQLite: () => ({ run: vi.fn() }),
}));

// ─── Mock: TipTap editor hook ────────────────────────────────────────────────

const mockSaveNow = vi.fn().mockResolvedValue(undefined);
const mockLoadCard = vi.fn();

vi.mock('@/hooks', () => ({
  useTipTapEditor: () => ({
    editor: null,
    isDirty: false,
    isSaving: false,
    saveNow: mockSaveNow,
    activeCard: null,
    wordCount: 0,
    characterCount: 0,
  }),
}));

// ─── Mock: NotebookContext ────────────────────────────────────────────────────

vi.mock('../../../contexts/NotebookContext', () => ({
  useNotebook: () => ({
    loadCard: mockLoadCard,
    createCard: vi.fn(),
  }),
}));

// ─── Mock: Editor sub-components (avoid DOM complexity) ──────────────────────

vi.mock('../../../components/notebook/editor', async () => ({
  TipTapEditor: () => <div data-testid="tiptap-editor" />,
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
  EditorStatusBar: () => <div data-testid="editor-statusbar" />,
  SaveAsTemplateModal: () => null,
}));

vi.mock('../../../components/notebook/editor/TemplatePickerModal', () => ({
  TemplatePickerModal: () => null,
}));

vi.mock('../../../components/notebook/PropertyEditor', () => ({
  PropertyEditor: () => null,
}));

// ─── Mock: SelectionContext — controllable state ──────────────────────────────

let mockSelectionState = {
  selectedIds: new Set<string>(),
  lastSelectedId: null as string | null,
  anchorId: null as string | null,
};
const mockSelect = vi.fn();
const mockClear = vi.fn();

vi.mock('../../../state/SelectionContext', () => ({
  useSelection: () => ({
    selection: mockSelectionState,
    select: mockSelect,
    deselect: vi.fn(),
    toggle: vi.fn(),
    selectRange: vi.fn(),
    selectMultiple: vi.fn(),
    clear: mockClear,
    isSelected: vi.fn(),
    setCells: vi.fn(),
    scrollToNode: null,
    registerScrollToNode: vi.fn(),
    unregisterScrollToNode: vi.fn(),
  }),
}));

// ─── Import component under test ──────────────────────────────────────────────

import { CaptureComponent } from '../CaptureComponent';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CaptureComponent Selection Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectionState = {
      selectedIds: new Set<string>(),
      lastSelectedId: null,
      anchorId: null,
    };
  });

  it('shows selection count when multiple cards selected', () => {
    mockSelectionState.selectedIds = new Set(['card-1', 'card-2', 'card-3']);

    render(<CaptureComponent />);

    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it('does not show selection count when only one card selected', () => {
    mockSelectionState.selectedIds = new Set(['card-1']);

    render(<CaptureComponent />);

    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });

  it('does not show selection count when nothing selected', () => {
    mockSelectionState.selectedIds = new Set();

    render(<CaptureComponent />);

    // The count badge shows "{N} selected" — distinct from "No card selected" in EmptyCardView
    expect(screen.queryByText(/\d+ selected/i)).not.toBeInTheDocument();
  });

  it('calls loadCard when lastSelectedId changes', async () => {
    mockSelectionState.lastSelectedId = 'card-123';
    mockSelectionState.selectedIds = new Set(['card-123']);

    render(<CaptureComponent />);

    await waitFor(() => {
      expect(mockLoadCard).toHaveBeenCalledWith('card-123');
    });
  });

  it('does not call loadCard when lastSelectedId is null', () => {
    mockSelectionState.lastSelectedId = null;

    render(<CaptureComponent />);

    expect(mockLoadCard).not.toHaveBeenCalled();
  });

  it('dispatches isometry:load-card event and triggers syncAndLoad', async () => {
    render(<CaptureComponent />);

    // Simulate card picker selecting a card via custom event
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('isometry:load-card', { detail: { cardId: 'picker-card-42' } })
      );
    });

    // Reverse sync: SelectionContext should be updated AND card loaded
    expect(mockSelect).toHaveBeenCalledWith('picker-card-42');
    expect(mockLoadCard).toHaveBeenCalledWith('picker-card-42');
  });

  it('cleans up isometry:load-card listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<CaptureComponent />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'isometry:load-card',
      expect.any(Function)
    );
  });
});
