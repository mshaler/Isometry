import { useState, useCallback, useMemo, useEffect } from 'react';
import { Plus, X, Check, AlertCircle, Calendar, Hash, Tag, Link2, Type, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNotebook } from '../../contexts/NotebookContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  type NotebookCard,
  type PropertyDefinition,
  type PropertyType,
  BUILT_IN_PROPERTY_DEFINITIONS,
  validatePropertyValue,
  serializePropertyValue,
  deserializePropertyValue
} from '../../types/notebook';
import { debounce } from '../../utils/debounce';

interface PropertyEditorProps {
  card: NotebookCard;
  onUpdate: (properties: Record<string, unknown>) => void;
  theme: 'NeXTSTEP' | 'Modern';
}

interface PropertyFieldProps {
  definition: PropertyDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onRemove?: () => void;
  theme: 'NeXTSTEP' | 'Modern';
  error?: string;
  isCustom?: boolean;
}

function PropertyField({
  definition,
  value,
  onChange,
  onRemove,
  theme,
  error,
  isCustom = false
}: PropertyFieldProps) {
  const [localValue, setLocalValue] = useState(deserializePropertyValue(value, definition.type));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value when prop value changes
  useEffect(() => {
    setLocalValue(deserializePropertyValue(value, definition.type));
  }, [value, definition.type]);

  const handleChange = useCallback((newValue: unknown) => {
    setLocalValue(newValue);
    onChange(serializePropertyValue(newValue, definition.type));
  }, [onChange, definition.type]);

  const getFieldIcon = () => {
    switch (definition.type) {
      case 'text':
        return <Type size={14} className="text-gray-500" />;
      case 'number':
        return <Hash size={14} className="text-blue-500" />;
      case 'boolean':
        return localValue ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} className="text-gray-400" />;
      case 'date':
        return <Calendar size={14} className="text-purple-500" />;
      case 'tag':
        return <Tag size={14} className="text-orange-500" />;
      case 'reference':
        return <Link2 size={14} className="text-indigo-500" />;
      case 'select':
        return <Type size={14} className="text-green-500" />;
      default:
        return null;
    }
  };

  const renderInput = () => {
    const baseInputClasses = `w-full text-sm p-2 border rounded transition-colors ${
      theme === 'NeXTSTEP'
        ? `border-[#707070] bg-white focus:border-[#0066cc] ${error ? 'border-red-500' : ''}`
        : `border-gray-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 ${error ? 'border-red-500 focus:border-red-500' : ''}`
    }`;

    switch (definition.type) {
      case 'text':
        return (
          <input
            type="text"
            value={(localValue as string) || ''}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={definition.placeholder}
            className={baseInputClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={(localValue as number) || ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={definition.placeholder}
            className={baseInputClasses}
          />
        );

      case 'boolean':
        return (
          <button
            onClick={() => handleChange(!localValue)}
            className={`flex items-center gap-2 w-full p-2 border rounded text-sm transition-colors ${
              theme === 'NeXTSTEP'
                ? `border-[#707070] hover:bg-[#f0f0f0] ${localValue ? 'bg-[#e6f3ff] border-[#0066cc]' : 'bg-white'}`
                : `border-gray-300 hover:bg-gray-50 ${localValue ? 'bg-blue-50 border-blue-300' : 'bg-white'}`
            }`}
          >
            {getFieldIcon()}
            <span className={localValue ? 'text-green-700' : 'text-gray-500'}>
              {localValue ? 'True' : 'False'}
            </span>
          </button>
        );

      case 'date':
        return (
          <input
            type="date"
            value={localValue ? (localValue as string).split('T')[0] : ''}
            onChange={(e) => handleChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={baseInputClasses}
          />
        );

      case 'select':
        return (
          <select
            value={(localValue as string) || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={baseInputClasses}
          >
            <option value="">Select...</option>
            {definition.options?.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        );

      case 'tag':
        const tags = (localValue as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] text-black'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {tag}
                  <button
                    onClick={() => handleChange(tags.filter((_, i) => i !== index))}
                    className="hover:text-red-600"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder={definition.placeholder}
              className={baseInputClasses}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  const newTag = e.currentTarget.value.trim();
                  if (!tags.includes(newTag)) {
                    handleChange([...tags, newTag]);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        );

      case 'reference':
        const refs = (localValue as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              {refs.map((ref, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#f0f0f0] border-[#707070]'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Link2 size={12} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1">{ref}</span>
                  <button
                    onClick={() => handleChange(refs.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder={definition.placeholder}
              className={baseInputClasses}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  const newRef = e.currentTarget.value.trim();
                  if (!refs.includes(newRef)) {
                    handleChange([...refs, newRef]);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={String(localValue || '')}
            onChange={(e) => handleChange(e.target.value)}
            className={baseInputClasses}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getFieldIcon()}
          <label className="text-sm font-medium flex items-center gap-1">
            {definition.name}
            {definition.required && <span className="text-red-500">*</span>}
          </label>
        </div>
        {isCustom && onRemove && (
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
            title="Remove field"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {renderInput()}

      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {definition.description && !isFocused && (
        <p className="text-xs text-gray-500">{definition.description}</p>
      )}
    </div>
  );
}

export function PropertyEditor({ card, onUpdate, theme }: PropertyEditorProps) {
  const { updateCard } = useNotebook();
  const [properties, setProperties] = useState<Record<string, unknown>>(card.properties || {});
  const [customDefinitions, setCustomDefinitions] = useState<PropertyDefinition[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<PropertyType>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Combine built-in and custom property definitions
  const allDefinitions = useMemo(() => {
    return [...BUILT_IN_PROPERTY_DEFINITIONS, ...customDefinitions];
  }, [customDefinitions]);

  // Debounced save function
  const debouncedSave = useMemo(
    () => debounce(async (props: Record<string, unknown>) => {
      setIsSaving(true);
      try {
        await updateCard(card.id, { properties: props });
        onUpdate(props);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (error) {
        console.error('Failed to save properties:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    [updateCard, card.id, onUpdate]
  );

  // Validate all properties
  const validateProperties = useCallback(() => {
    const newErrors: Record<string, string> = {};

    allDefinitions.forEach(def => {
      const value = properties[def.id];
      const fieldErrors = validatePropertyValue(value, def);
      if (fieldErrors.length > 0) {
        newErrors[def.id] = fieldErrors[0];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [properties, allDefinitions]);

  // Handle property value changes
  const handlePropertyChange = useCallback((definitionId: string, value: unknown) => {
    const newProperties = { ...properties, [definitionId]: value };
    setProperties(newProperties);
    debouncedSave(newProperties);
  }, [properties, debouncedSave]);

  // Add custom property field
  const addCustomField = useCallback(() => {
    if (!newFieldName.trim()) return;

    const newDefinition: PropertyDefinition = {
      id: `custom-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      required: false,
    };

    setCustomDefinitions(prev => [...prev, newDefinition]);
    setNewFieldName('');
    setNewFieldType('text');
    setIsAddingCustom(false);
  }, [newFieldName, newFieldType]);

  // Remove custom property field
  const removeCustomField = useCallback((definitionId: string) => {
    setCustomDefinitions(prev => prev.filter(def => def.id !== definitionId));
    const newProperties = { ...properties };
    delete newProperties[definitionId];
    setProperties(newProperties);
    debouncedSave(newProperties);
  }, [properties, debouncedSave]);

  // Validate on property changes
  useEffect(() => {
    validateProperties();
  }, [validateProperties]);

  // Count populated properties
  const propertyCount = useMemo(() => {
    return Object.values(properties).filter(value =>
      value !== null && value !== undefined && value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    ).length;
  }, [properties]);

  return (
    <div className="space-y-4">
      {/* Property Fields */}
      <div className="space-y-3">
        {allDefinitions.map(definition => {
          const isCustom = customDefinitions.some(def => def.id === definition.id);
          const hasValue = properties[definition.id] !== undefined &&
            properties[definition.id] !== null &&
            properties[definition.id] !== '';

          // Show built-in fields if they have values or are commonly used
          const shouldShow = isCustom || hasValue || [
            'tags', 'priority', 'status', 'due-date'
          ].includes(definition.id);

          if (!shouldShow) return null;

          return (
            <PropertyField
              key={definition.id}
              definition={definition}
              value={properties[definition.id]}
              onChange={(value) => handlePropertyChange(definition.id, value)}
              onRemove={isCustom ? () => removeCustomField(definition.id) : undefined}
              theme={theme}
              error={errors[definition.id]}
              isCustom={isCustom}
            />
          );
        })}
      </div>

      {/* Add Custom Property */}
      <div className={`border-t pt-3 ${
        theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-200'
      }`}>
        {isAddingCustom ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="Property name..."
                className={`flex-1 text-sm p-2 border rounded ${
                  theme === 'NeXTSTEP'
                    ? 'border-[#707070] bg-white'
                    : 'border-gray-300 bg-white'
                }`}
                autoFocus
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as PropertyType)}
                className={`text-sm p-2 border rounded ${
                  theme === 'NeXTSTEP'
                    ? 'border-[#707070] bg-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="select">Select</option>
                <option value="tag">Tags</option>
                <option value="reference">Reference</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addCustomField}
                disabled={!newFieldName.trim()}
                className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#0066cc] text-white hover:bg-[#0052a3] disabled:bg-[#cccccc] disabled:text-[#666666]'
                    : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500'
                }`}
              >
                <Check size={12} />
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingCustom(false);
                  setNewFieldName('');
                  setNewFieldType('text');
                }}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#f0f0f0] text-black hover:bg-[#e0e0e0]'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCustom(true)}
            className={`flex items-center gap-2 w-full p-2 text-sm rounded border-2 border-dashed transition-colors ${
              theme === 'NeXTSTEP'
                ? 'border-[#999999] text-[#666666] hover:border-[#0066cc] hover:text-[#0066cc]'
                : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            <Plus size={14} />
            <span>Add custom property</span>
          </button>
        )}
      </div>

      {/* Status Footer */}
      <div className={`flex items-center justify-between text-xs pt-2 border-t ${
        theme === 'NeXTSTEP' ? 'border-[#707070] text-[#666666]' : 'border-gray-200 text-gray-500'
      }`}>
        <span>{propertyCount} properties set</span>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-green-600">
              <Check size={12} />
              Saved
            </span>
          )}
          {Object.keys(errors).length > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle size={12} />
              {Object.keys(errors).length} errors
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyEditor;