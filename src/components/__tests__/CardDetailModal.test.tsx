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
      />
    );

    expect(screen.getByText('Card Details')).toBeInTheDocument();
    expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument(); // Priority
    expect(screen.getByText('4/5')).toBeInTheDocument(); // Importance
    expect(screen.getByText('Test card summary for verification')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
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
      />
    );

    const closeButton = screen.getByLabelText('Close modal');
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
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    expect(screen.getByText('Edit Card')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Card Title')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('allows editing form fields in edit mode', async () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
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

    // Edit folder dropdown (now should be a select element)
    const folderSelect = screen.getByRole('combobox', { name: /folder/i });
    fireEvent.change(folderSelect, { target: { value: 'personal' } });

    // Edit status dropdown
    const statusSelect = screen.getByRole('combobox', { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    // Edit priority
    const priorityInput = screen.getByDisplayValue('3');
    fireEvent.change(priorityInput, { target: { value: '5' } });

    // Edit summary
    const summaryTextarea = screen.getByDisplayValue('Test card summary for verification');
    fireEvent.change(summaryTextarea, { target: { value: 'Updated summary text' } });

    // Verify changes are reflected in form
    expect(screen.getByDisplayValue('Updated Card Title')).toBeInTheDocument();
    expect(folderSelect.value).toBe('personal');
    expect(statusSelect.value).toBe('completed');
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Updated summary text')).toBeInTheDocument();
  });

  it('calls onSave with updated data when Save Changes is clicked', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'));

    // Make changes
    const titleInput = screen.getByDisplayValue('Test Card Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    // Save changes
    fireEvent.click(screen.getByText('Save Changes'));

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

  it('handles keyboard shortcuts', () => {
    render(
      <CardDetailModal
        card={mockCard}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Test Escape key to close
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows proper status colors for different statuses', () => {
    const cardWithBlockedStatus = { ...mockCard, status: 'blocked' };

    render(
      <CardDetailModal
        card={cardWithBlockedStatus}
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const statusSpan = screen.getByText('blocked');
    expect(statusSpan).toHaveClass('bg-red-100', 'text-red-800', 'border-red-300');
  });
});