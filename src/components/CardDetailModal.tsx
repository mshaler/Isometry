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
  isLoading?: boolean;
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
export function CardDetailModal({ card, isOpen, isLoading = false, onClose, onSave, onDelete }: CardDetailModalProps) {
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
      setEditMode(false);
    }
  }, [onSave, card, editedCard]);

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
  }, [card]);

  const handleDelete = React.useCallback(() => {
    if (onDelete && card) {
      onDelete(card.id);
      setShowDeleteConfirm(false);
    }
  }, [onDelete, card]);

  if (!isOpen || !card) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Card Details
            </h2>
            <div className="flex items-center space-x-2">
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-blue-700">Processing...</span>
              </div>
            </div>
          )}

          {/* Card Content */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={editedCard.name || ''}
                  onChange={(e) => setEditedCard(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Card name"
                  disabled={isLoading}
                />
              ) : (
                <div className="text-lg font-semibold text-gray-900">
                  {card.name}
                </div>
              )}
            </div>

            {/* Folder and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder
                </label>
                {editMode ? (
                  <select
                    value={editedCard.folder || ''}
                    onChange={(e) => setEditedCard(prev => ({ ...prev, folder: e.target.value || undefined }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">No folder</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="projects">Projects</option>
                    <option value="ideas">Ideas</option>
                    <option value="archive">Archive</option>
                  </select>
                ) : (
                  <div className="text-gray-900">
                    {card.folder || 'No folder'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                {editMode ? (
                  <select
                    value={editedCard.status || ''}
                    onChange={(e) => setEditedCard(prev => ({ ...prev, status: e.target.value || undefined }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">No status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          card.status === 'active' ? '#10b981' :
                          card.status === 'completed' ? '#6b7280' :
                          card.status === 'blocked' ? '#ef4444' :
                          card.status === 'in_progress' ? '#f59e0b' : '#9ca3af'
                      }}
                    ></div>
                    <span className="text-gray-900">
                      {card.status || 'No status'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Priority and Importance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority (1-5)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editedCard.priority || ''}
                    onChange={(e) => setEditedCard(prev => ({
                      ...prev,
                      priority: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                ) : (
                  <div className="text-gray-900">
                    {card.priority || 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importance (1-5)
                </label>
                {editMode ? (
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editedCard.importance || ''}
                    onChange={(e) => setEditedCard(prev => ({
                      ...prev,
                      importance: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                ) : (
                  <div className="text-gray-900">
                    {card.importance || 'Not set'}
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary
              </label>
              {editMode ? (
                <textarea
                  value={editedCard.summary || ''}
                  onChange={(e) => setEditedCard(prev => ({ ...prev, summary: e.target.value || undefined }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Card summary or description"
                  disabled={isLoading}
                />
              ) : (
                <div className="text-gray-900 whitespace-pre-wrap">
                  {card.summary || 'No summary'}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">ID:</span>
                  <span className="ml-2 font-mono text-gray-900">{card.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Source:</span>
                  <span className="ml-2 text-gray-900">{card.source || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 text-gray-900">
                    {card.created_at ? new Date(card.created_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Modified:</span>
                  <span className="ml-2 text-gray-900">
                    {card.modified_at ? new Date(card.modified_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            {/* Delete button */}
            <div>
              {editMode ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Card
                </button>
              ) : null}
            </div>

            {/* Save/Cancel buttons */}
            <div className="flex items-center space-x-3">
              {editMode ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Card?
            </h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. The card will be permanently deleted.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}