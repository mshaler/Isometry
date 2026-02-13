import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CardDetailModal } from '../CardDetailModal';

// Mock card data matching IsometryKB schema
const mockCard = {
  id: 'test-card-1',
  name: 'Test Card Title',
  folder: 'work',
  status: 'active',
  priority: 3,
  importance: 4,
  summary: 'Test card summary for verification',
  created_at: '2026-01-15T10:00:00Z',
  modified_at: '2026-01-15T10:30:00Z',
  source: 'Test'
};

describe('CardDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card details when open', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    // Priority and importance are displayed as raw numbers (not x/5 format)
    expect(screen.getByText('3')).toBeInTheDocument(); // Priority
    expect(screen.getByText('4')).toBeInTheDocument(); // Importance
    expect(screen.getByText('Test card summary for verification')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByText('Card Details')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Close button is the X button (svg with path) next to Edit button
    // In view mode, click the "Close" button at the bottom
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('enters edit mode when Edit button is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    // Component keeps "Card Details" title in edit mode
    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Card Title')).toBeInTheDocument();
    // Button shows "Save" not "Save Changes"
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('allows editing form fields in edit mode', async () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));

    // Wait for edit mode to render
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Card Title')).toBeInTheDocument();
    });

    // Edit title field
    const titleInput = screen.getByDisplayValue('Test Card Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Card Title' } });

    // Edit folder dropdown - get all comboboxes (selects)
    const selects = screen.getAllByRole('combobox');
    const folderSelect = selects[0]; // First select is folder
    fireEvent.change(folderSelect, { target: { value: 'personal' } });

    // Edit status dropdown
    const statusSelect = selects[1]; // Second select is status
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    // Edit priority
    const priorityInput = screen.getByDisplayValue('3');
    fireEvent.change(priorityInput, { target: { value: '5' } });

    // Edit summary
    const summaryTextarea = screen.getByDisplayValue('Test card summary for verification');
    fireEvent.change(summaryTextarea, { target: { value: 'Updated summary text' } });

    // Verify changes are reflected in form
    expect(screen.getByDisplayValue('Updated Card Title')).toBeInTheDocument();
    expect((folderSelect as HTMLSelectElement).value).toBe('personal');
    expect((statusSelect as HTMLSelectElement).value).toBe('completed');
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Updated summary text')).toBeInTheDocument();
  });

  it('calls onSave with updated data when Save is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));

    // Make changes
    const titleInput = screen.getByDisplayValue('Test Card Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    // Save changes - button says "Save" not "Save Changes"
    fireEvent.click(screen.getByText('Save'));

    expect(mockOnSave).toHaveBeenCalledWith({
      id: 'test-card-1',
      name: 'Updated Title',
      folder: 'work',
      status: 'active',
      priority: 3,
      importance: 4,
      summary: 'Test card summary for verification'
    });
  });

  it('cancels changes when Cancel button is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));

    // Make changes
    const titleInput = screen.getByDisplayValue('Test Card Title');
    fireEvent.change(titleInput, { target: { value: 'Changed Title' } });

    // Cancel changes
    fireEvent.click(screen.getByText('Cancel'));

    // Should exit edit mode without calling onSave
    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();

    // If we re-enter edit mode, original values should be restored
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Test Card Title')).toBeInTheDocument();
  });

  it.skip('handles keyboard shortcuts', () => {
    // TODO: Keyboard shortcuts (Escape to close) not currently implemented
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Test Escape key to close
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows proper status colors for different statuses', () => {
    const cardWithBlockedStatus = { ...mockCard, status: 'blocked' };

    const { container } = render(
      <CardDetailModal
        card={cardWithBlockedStatus}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Status is displayed with a colored dot (inline style) and text
    expect(screen.getByText('blocked')).toBeInTheDocument();
    // Check the status indicator dot has red color for blocked status
    const statusDot = container.querySelector('[style*="background-color: rgb(239, 68, 68)"]');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows delete button when onDelete prop is provided (in edit mode)', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Delete button only shows in edit mode
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Delete Card')).toBeInTheDocument();
  });

  it('does not show delete button when onDelete prop is not provided', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows delete confirmation when delete button is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode first to access Delete button
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Delete Card'));

    // Confirmation shows "Delete Card?" with a question mark
    expect(screen.getByText('Delete Card?')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    // Confirm button says "Delete"
    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('calls onDelete when delete is confirmed', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode first
    fireEvent.click(screen.getByText('Edit'));
    // Click delete button
    fireEvent.click(screen.getByText('Delete Card'));

    // Confirm deletion - the confirm button in the modal says "Delete"
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    // Click the last Delete button (the confirmation one)
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(mockOnDelete).toHaveBeenCalledWith('test-card-1');
  });

  it('cancels delete confirmation when cancel is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode first
    fireEvent.click(screen.getByText('Edit'));
    // Click delete button
    fireEvent.click(screen.getByText('Delete Card'));

    // Cancel deletion - find the cancel button in the delete confirmation
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[cancelButtons.length - 1]); // Last cancel button

    // Should be back to edit mode (confirmation closed)
    expect(screen.queryByText('Delete Card?')).not.toBeInTheDocument();
    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });
});