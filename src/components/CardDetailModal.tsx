import React from 'react';

interface CardData {
  id: string;
  name: string;
  folder?: string;
  status?: string;
  summary?: string;
  priority?: number;
  importance?: number;
  created_at?: string;
  modified_at?: string;
  source?: string;
}

interface CardDetailModalProps {
  card: CardData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedCard: Partial<CardData>) => void;
  onDelete?: (cardId: string) => void;
}

/**
 * Card Detail Modal - Shows rich card information and allows editing
 *
 * Demonstrates the bridge elimination architecture by showing how D3.js
 * click events can seamlessly trigger React UI updates with shared state
 */
export function CardDetailModal({ card, isOpen, onClose, onSave, onDelete }: CardDetailModalProps) {
  const [editMode, setEditMode] = React.useState(false);
  const [editedCard, setEditedCard] = React.useState<Partial<CardData>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  React.useEffect(() => {
    if (card) {
      setEditedCard({
        name: card.name,
        folder: card.folder,
        status: card.status,
        summary: card.summary,
        priority: card.priority,
        importance: card.importance
      });
    }
  }, [card]);

  const handleSave = React.useCallback(() => {
    if (onSave && card) {
      onSave({ ...editedCard, id: card.id });
    }
    setEditMode(false);
  }, [onSave, editedCard, card]);

  const handleCancel = React.useCallback(() => {
    if (card) {
      setEditedCard({
        name: card.name,
        folder: card.folder,
        status: card.status,
        summary: card.summary,
        priority: card.priority,
        importance: card.importance
      });
    }
    setEditMode(false);
    setShowDeleteConfirm(false);
  }, [card]);

  const handleDeleteClick = React.useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = React.useCallback(() => {
    if (onDelete && card) {
      onDelete(card.id);
      setShowDeleteConfirm(false);
    }
  }, [onDelete, card]);

  const handleDeleteCancel = React.useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        if (editMode) {
          handleCancel();
        } else {
          onClose();
        }
      } else if (event.key === 'Enter' && event.metaKey && editMode) {
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editMode, onClose, handleCancel, handleSave]);

  if (!isOpen || !card) return null;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'todo': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'archived': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority?: number) => {
    if (!priority) return 'bg-gray-100 text-gray-600';
    if (priority >= 5) return 'bg-red-100 text-red-800';
    if (priority >= 4) return 'bg-orange-100 text-orange-800';
    if (priority >= 3) return 'bg-yellow-100 text-yellow-800';
    if (priority >= 2) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {editMode ? 'Edit Card' : 'Card Details'}
          </h2>
          <div className="flex items-center space-x-2">
            {!editMode && (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Edit
                </button>
                {onDelete && (
                  <button
                    onClick={handleDeleteClick}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            {editMode ? (
              <input
                type="text"
                value={editedCard.name || ''}
                onChange={(e) => setEditedCard({ ...editedCard, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <h3 className="text-lg font-medium text-gray-900">{card.name}</h3>
            )}
          </div>

          {/* Status and Folder Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="folder-select" className="block text-sm font-medium text-gray-700 mb-2">Folder</label>
              {editMode ? (
                <select
                  id="folder-select"
                  value={editedCard.folder || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, folder: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="specs">Specs</option>
                  <option value="plans">Plans</option>
                  <option value="journal">Journal</option>
                  <option value="docs">Docs</option>
                  <option value="research">Research</option>
                  <option value="future">Future</option>
                </select>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  {card.folder || 'No folder'}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="status-select" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              {editMode ? (
                <select
                  id="status-select"
                  value={editedCard.status || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                  <option value="todo">Todo</option>
                  <option value="archived">Archived</option>
                </select>
              ) : (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(card.status)}`}>
                  {card.status || 'No status'}
                </span>
              )}
            </div>
          </div>

          {/* Priority and Importance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              {editMode ? (
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={editedCard.priority || 0}
                  onChange={(e) => setEditedCard({ ...editedCard, priority: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(card.priority)}`}>
                  {card.priority || 0}/5
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Importance</label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(card.importance)}`}>
                {card.importance || 0}/5
              </span>
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
            {editMode ? (
              <textarea
                rows={3}
                value={editedCard.summary || ''}
                onChange={(e) => setEditedCard({ ...editedCard, summary: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter a brief summary..."
              />
            ) : (
              <p className="text-gray-700 text-sm leading-relaxed">
                {card.summary || 'No summary available.'}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium">Created:</span>
              <br />
              {card.created_at ? new Date(card.created_at).toLocaleDateString() : 'Unknown'}
            </div>
            <div>
              <span className="font-medium">Modified:</span>
              <br />
              {card.modified_at ? new Date(card.modified_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <span className="font-medium">Source:</span> {card.source || 'Unknown'}
          </div>
        </div>

        {/* Footer */}
        {editMode && !showDeleteConfirm && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="p-6 border-t bg-red-50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 8.5c-.77.833-.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-900">Delete Card</h3>
                <p className="text-sm text-red-700 mt-1">
                  Are you sure you want to delete "<span className="font-medium">{card?.name}</span>"? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete Card
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}