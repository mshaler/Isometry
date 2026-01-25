import { useState, useCallback, useMemo } from 'react';
import {
  X, Search, Plus, Copy, Edit3, Trash2, Bookmark, BookOpen, Code2,
  Calendar, Lightbulb, Filter, Star, Clock, Users
} from 'lucide-react';
import { useNotebook } from '../../contexts/NotebookContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { NotebookCard, NotebookTemplate, NotebookCardType } from '../../types/notebook';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFromTemplate: (templateId: string) => void;
  currentCard?: NotebookCard | null;
}

interface TemplateCardProps {
  template: NotebookTemplate;
  onUse: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate: () => void;
  theme: 'NeXTSTEP' | 'Modern';
}

function TemplateCard({ template, onUse, onEdit, onDelete, onDuplicate, theme }: TemplateCardProps) {
  const getCardTypeIcon = (cardType: NotebookCardType) => {
    switch (cardType) {
      case 'meeting': return <Users size={16} className="text-blue-500" />;
      case 'code': return <Code2 size={16} className="text-green-500" />;
      case 'project': return <Calendar size={16} className="text-purple-500" />;
      case 'capture': return <BookOpen size={16} className="text-orange-500" />;
      case 'shell': return <Bookmark size={16} className="text-indigo-500" />;
      case 'preview': return <Lightbulb size={16} className="text-yellow-500" />;
      default: return <BookOpen size={16} className="text-gray-500" />;
    }
  };

  const getCategoryBadge = (category: 'built-in' | 'custom') => {
    if (category === 'built-in') {
      return (
        <span className={`px-2 py-1 text-xs rounded-full ${
          theme === 'NeXTSTEP'
            ? 'bg-[#0066cc] text-white'
            : 'bg-blue-100 text-blue-700'
        }`}>
          Built-in
        </span>
      );
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] text-black'
          : 'bg-gray-100 text-gray-700'
      }`}>
        Custom
      </span>
    );
  };

  return (
    <div className={`p-4 rounded-lg border transition-colors hover:shadow-md ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-[#707070] hover:border-[#0066cc]'
        : 'bg-white border-gray-200 hover:border-blue-300'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {getCardTypeIcon(template.cardType)}
          <h3 className="font-medium text-sm truncate">{template.name}</h3>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {getCategoryBadge(template.category)}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{template.description}</p>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className={`px-2 py-0.5 text-xs rounded ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#f0f0f0] text-gray-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{template.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Usage stats */}
      {template.usageCount !== undefined && template.usageCount > 0 && (
        <div className="flex items-center gap-1 mb-3 text-xs text-gray-500">
          <Clock size={12} />
          <span>Used {template.usageCount} times</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <button
          onClick={onUse}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
            theme === 'NeXTSTEP'
              ? 'bg-[#0066cc] text-white hover:bg-[#0052a3]'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          <Plus size={12} />
          Use
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className={`p-1 rounded transition-colors ${
              theme === 'NeXTSTEP'
                ? 'hover:bg-[#f0f0f0]'
                : 'hover:bg-gray-100'
            }`}
            title="Duplicate"
          >
            <Copy size={14} className="text-gray-500" />
          </button>

          {template.category === 'custom' && onEdit && (
            <button
              onClick={onEdit}
              className={`p-1 rounded transition-colors ${
                theme === 'NeXTSTEP'
                  ? 'hover:bg-[#f0f0f0]'
                  : 'hover:bg-gray-100'
              }`}
              title="Edit"
            >
              <Edit3 size={14} className="text-gray-500" />
            </button>
          )}

          {template.category === 'custom' && onDelete && (
            <button
              onClick={onDelete}
              className={`p-1 rounded transition-colors ${
                theme === 'NeXTSTEP'
                  ? 'hover:bg-red-100'
                  : 'hover:bg-red-50'
              }`}
              title="Delete"
            >
              <Trash2 size={14} className="text-red-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TemplateManager({ isOpen, onClose, onCreateFromTemplate, currentCard }: TemplateManagerProps) {
  const { theme } = useTheme();
  const { templates, createTemplate, deleteTemplate, duplicateTemplate } = useNotebook();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'built-in' | 'custom'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isCreatingFromCard, setIsCreatingFromCard] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(t =>
        selectedTags.every(tag => t.tags.includes(tag))
      );
    }

    return filtered;
  }, [templates, searchQuery, selectedCategory, selectedTags]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [templates]);

  // Handle template usage
  const handleUseTemplate = useCallback((templateId: string) => {
    onCreateFromTemplate(templateId);
    onClose();
  }, [onCreateFromTemplate, onClose]);

  // Handle template duplication
  const handleDuplicateTemplate = useCallback(async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newName = `${template.name} (Copy)`;
    try {
      await duplicateTemplate(templateId, newName);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      // TODO: Show error notification
    }
  }, [templates, duplicateTemplate]);

  // Handle template deletion
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
    } catch (error) {
      console.error('Failed to delete template:', error);
      // TODO: Show error notification
    }
  }, [deleteTemplate]);

  // Handle creating template from current card
  const handleCreateFromCard = useCallback(async () => {
    if (!currentCard || !newTemplateName.trim()) return;

    try {
      await createTemplate(newTemplateName, newTemplateDescription, currentCard);
      setIsCreatingFromCard(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
    } catch (error) {
      console.error('Failed to create template:', error);
      // TODO: Show error notification
    }
  }, [currentCard, newTemplateName, newTemplateDescription, createTemplate]);

  // Toggle tag filter
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`w-full max-w-6xl max-h-[80vh] m-4 rounded-lg ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-white'
      } shadow-xl flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200'
        }`}>
          <h2 className="text-lg font-semibold">Template Gallery</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              theme === 'NeXTSTEP'
                ? 'hover:bg-[#b0b0b0]'
                : 'hover:bg-gray-100'
            }`}
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Search and Create */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg ${
                  theme === 'NeXTSTEP'
                    ? 'border-[#707070] bg-white'
                    : 'border-gray-300 bg-white'
                }`}
              />
            </div>

            {currentCard && !isCreatingFromCard && (
              <button
                onClick={() => setIsCreatingFromCard(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#0066cc] text-white hover:bg-[#0052a3]'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <Bookmark size={16} />
                Save as Template
              </button>
            )}
          </div>

          {/* Create from card form */}
          {isCreatingFromCard && (
            <div className={`p-4 rounded-lg border ${
              theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'
            }`}>
              <h3 className="font-medium mb-3">Create Template from Current Card</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Template name..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'
                  }`}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description..."
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateFromCard}
                    disabled={!newTemplateName.trim()}
                    className={`px-4 py-2 rounded transition-colors ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#0066cc] text-white hover:bg-[#0052a3] disabled:bg-[#cccccc]'
                        : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300'
                    }`}
                  >
                    Create Template
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingFromCard(false);
                      setNewTemplateName('');
                      setNewTemplateDescription('');
                    }}
                    className={`px-4 py-2 rounded transition-colors ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#f0f0f0] hover:bg-[#e0e0e0]'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedCategory === 'all'
                    ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                    : theme === 'NeXTSTEP' ? 'bg-[#f0f0f0] hover:bg-[#e0e0e0]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                All ({templates.length})
              </button>
              <button
                onClick={() => setSelectedCategory('built-in')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedCategory === 'built-in'
                    ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                    : theme === 'NeXTSTEP' ? 'bg-[#f0f0f0] hover:bg-[#e0e0e0]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Built-in ({templates.filter(t => t.category === 'built-in').length})
              </button>
              <button
                onClick={() => setSelectedCategory('custom')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedCategory === 'custom'
                    ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                    : theme === 'NeXTSTEP' ? 'bg-[#f0f0f0] hover:bg-[#e0e0e0]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Custom ({templates.filter(t => t.category === 'custom').length})
              </button>
            </div>

            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-gray-500" />
                {allTags.slice(0, 8).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedTags.includes(tag)
                        ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                        : theme === 'NeXTSTEP' ? 'bg-[#f0f0f0] hover:bg-[#e0e0e0]' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => handleUseTemplate(template.id)}
                  onDuplicate={() => handleDuplicateTemplate(template.id)}
                  onDelete={template.category === 'custom' ? () => handleDeleteTemplate(template.id) : undefined}
                  theme={theme}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="font-medium mb-2">No templates found</h3>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t text-sm text-gray-500 ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex justify-between items-center">
            <span>
              Showing {filteredTemplates.length} of {templates.length} templates
            </span>
            <span className="flex items-center gap-4 text-xs">
              <span>⏎ Use template</span>
              <span>⌘+D Duplicate</span>
              <span>⎋ Close</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateManager;