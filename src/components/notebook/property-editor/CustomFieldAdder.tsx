import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import type { PropertyType, PropertyDefinition } from '../../../types/notebook';

interface CustomFieldAdderProps {
  onAdd: (definition: PropertyDefinition) => void;
  theme: 'NeXTSTEP' | 'Modern';
}

export function CustomFieldAdder({ onAdd, theme }: CustomFieldAdderProps) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<PropertyType>('text');

  const handleAdd = () => {
    if (newFieldName.trim()) {
      const definition: PropertyDefinition = {
        id: crypto.randomUUID(),
        name: newFieldName.trim(),
        type: newFieldType,
        required: false,
        description: `Custom ${newFieldType} property`
      };

      onAdd(definition);
      setIsAddingCustom(false);
      setNewFieldName('');
      setNewFieldType('text');
    }
  };

  const handleCancel = () => {
    setIsAddingCustom(false);
    setNewFieldName('');
    setNewFieldType('text');
  };

  if (isAddingCustom) {
    return (
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') handleCancel();
            }}
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
            onClick={handleAdd}
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
            onClick={handleCancel}
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
    );
  }

  return (
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
  );
}