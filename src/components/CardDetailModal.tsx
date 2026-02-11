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

interface CardFormFieldProps {
  label: string;
  editMode: boolean;
  isLoading: boolean;
  editValue: string | number;
  displayValue: string;
  onEdit: (value: string) => void;
  type?: 'text' | 'textarea' | 'number';
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  displayClassName?: string;
}

interface CardFormSelectProps {
  label: string;
  editMode: boolean;
  isLoading: boolean;
  editValue: string;
  displayValue: string;
  onEdit: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

interface CardStatusFieldProps {
  label: string;
  editMode: boolean;
  isLoading: boolean;
  editValue: string;
  displayValue: string;
  onEdit: (value: string) => void;
}

interface CardMetadataProps {
  card: CardData;
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
            <CardFormField
              label="Name"
              editMode={editMode}
              isLoading={isLoading}
              editValue={editedCard.name || ''}
              displayValue={card.name}
              onEdit={(value: string) => setEditedCard(prev => ({ ...prev, name: value }))}
              type="text"
              placeholder="Card name"
              displayClassName="text-lg font-semibold text-gray-900"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardFormSelect
                label="Folder"
                editMode={editMode}
                isLoading={isLoading}
                editValue={editedCard.folder || ''}
                displayValue={card.folder || 'No folder'}
                onEdit={(value: string) => setEditedCard(prev => ({ ...prev, folder: value || undefined }))}
                options={[
                  { value: '', label: 'No folder' },
                  { value: 'work', label: 'Work' },
                  { value: 'personal', label: 'Personal' },
                  { value: 'projects', label: 'Projects' },
                  { value: 'ideas', label: 'Ideas' },
                  { value: 'archive', label: 'Archive' }
                ]}
              />

              <CardStatusField
                label="Status"
                editMode={editMode}
                isLoading={isLoading}
                editValue={editedCard.status || ''}
                displayValue={card.status || ''}
                onEdit={(value: string) => setEditedCard(prev => ({ ...prev, status: value || undefined }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardFormField
                label="Priority (1-5)"
                editMode={editMode}
                isLoading={isLoading}
                editValue={editedCard.priority ?? ''}
                displayValue={card.priority != null ? String(card.priority) : 'Not set'}
                onEdit={(value: string) => setEditedCard(prev => ({
                  ...prev,
                  priority: value ? parseInt(value) : undefined
                }))}
                type="number"
                min={1}
                max={5}
              />

              <CardFormField
                label="Importance (1-5)"
                editMode={editMode}
                isLoading={isLoading}
                editValue={editedCard.importance ?? ''}
                displayValue={card.importance != null ? String(card.importance) : 'Not set'}
                onEdit={(value: string) => setEditedCard(prev => ({
                  ...prev,
                  importance: value ? parseInt(value) : undefined
                }))}
                type="number"
                min={1}
                max={5}
              />
            </div>

            <CardFormField
              label="Summary"
              editMode={editMode}
              isLoading={isLoading}
              editValue={editedCard.summary || ''}
              displayValue={card.summary || 'No summary'}
              onEdit={(value: string) => setEditedCard(prev => ({ ...prev, summary: value || undefined }))}
              type="textarea"
              placeholder="Card summary or description"
              rows={4}
              displayClassName="text-gray-900 whitespace-pre-wrap"
            />

            <CardMetadata card={card} />
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

function CardFormField({
  label,
  editMode,
  isLoading,
  editValue,
  displayValue,
  onEdit,
  type = 'text',
  placeholder,
  rows,
  min,
  max,
  displayClassName = 'text-gray-900'
}: CardFormFieldProps) {
  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {editMode ? (
        type === 'textarea' ? (
          <textarea
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
            rows={rows}
            className={inputClass}
            placeholder={placeholder}
            disabled={isLoading}
          />
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
            className={inputClass}
            placeholder={placeholder}
            disabled={isLoading}
            min={min}
            max={max}
          />
        )
      ) : (
        <div className={displayClassName}>
          {displayValue}
        </div>
      )}
    </div>
  );
}

function CardFormSelect({
  label,
  editMode,
  isLoading,
  editValue,
  displayValue,
  onEdit,
  options
}: CardFormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {editMode ? (
        <select
          value={editValue}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          {options.map((option: { value: string; label: string }) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-gray-900">
          {displayValue}
        </div>
      )}
    </div>
  );
}

function CardStatusField({
  editMode,
  isLoading,
  editValue,
  displayValue,
  onEdit
}: CardStatusFieldProps) {
  const statusOptions = [
    { value: '', label: 'No status' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'in_progress', label: 'In Progress' }
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'blocked': return '#ef4444';
      case 'in_progress': return '#f59e0b';
      default: return '#9ca3af';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Status
      </label>
      {editMode ? (
        <select
          value={editValue}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          {statusOptions.map((option: { value: string; label: string }) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getStatusColor(displayValue) }}
          />
          <span className="text-gray-900">
            {displayValue || 'No status'}
          </span>
        </div>
      )}
    </div>
  );
}

function CardMetadata({ card }: CardMetadataProps) {
  return (
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
  );
}