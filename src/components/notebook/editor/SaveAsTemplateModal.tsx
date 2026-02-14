import { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useSQLite } from '@/db/SQLiteProvider';
import { createTemplate } from '@/utils/editor/templates';

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onSuccess?: () => void;
}

export function SaveAsTemplateModal({
  isOpen,
  onClose,
  content,
  onSuccess
}: SaveAsTemplateModalProps) {
  const { theme } = useTheme();
  const { db } = useSQLite();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSaving(false);
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setCategory('custom');
      setError(null);
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!content.trim()) {
      setError('Cannot save empty content as template');
      return;
    }

    if (!db) {
      setError('Database not available');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const templateId = createTemplate(db, {
        name: name.trim(),
        description: description.trim() || null,
        category,
        content,
        variables: [],
      });

      if (templateId) {
        onSuccess?.();
        onClose();
      } else {
        setError('Failed to save template');
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [name, description, category, content, db, onClose, onSuccess]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [onClose, handleSave]);

  if (!isOpen) return null;

  const bgClass = theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-white';
  const borderClass = theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300';
  const headerBgClass = theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100';
  const hoverClass = theme === 'NeXTSTEP' ? 'hover:bg-[#b0b0b0]' : 'hover:bg-gray-200';
  const inputClass = theme === 'NeXTSTEP'
    ? 'bg-white border-2 border-t-[#707070] border-l-[#707070] border-b-[#e8e8e8] border-r-[#e8e8e8] px-3 py-2'
    : 'bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

  const categories = [
    { value: 'custom', label: 'Custom' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'project', label: 'Project' },
    { value: 'daily', label: 'Daily' },
    { value: 'note', label: 'Note' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`${bgClass} ${borderClass} border rounded-lg shadow-xl w-[500px] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${headerBgClass} px-4 py-3 rounded-t-lg border-b ${borderClass} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <h2 className="text-lg font-medium">Save as Template</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded ${hoverClass}`}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Template"
              className={`w-full text-sm ${inputClass}`}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
              className={`w-full text-sm resize-none ${inputClass}`}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={`w-full text-sm ${inputClass}`}
              disabled={saving}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Content Preview
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-[150px] overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono text-gray-600">
                {content.length > 500 ? content.slice(0, 500) + '...' : content}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {content.length} characters
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t ${borderClass} flex justify-end gap-2`}>
          <button
            onClick={onClose}
            disabled={saving}
            className={`px-4 py-2 text-sm rounded ${
              theme === 'NeXTSTEP'
                ? 'bg-[#e0e0e0] hover:bg-[#d0d0d0] border border-[#707070]'
                : 'bg-gray-200 hover:bg-gray-300'
            } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={`px-4 py-2 text-sm rounded text-white disabled:opacity-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#0066cc] hover:bg-[#0055aa]'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
