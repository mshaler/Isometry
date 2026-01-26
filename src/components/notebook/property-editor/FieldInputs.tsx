import { X, Link2 } from 'lucide-react';
import { getFieldIcon } from './fieldIcons';
import type { FieldInputProps } from './types';

export function getBaseInputClasses(theme: 'NeXTSTEP' | 'Modern', error?: string): string {
  return `w-full text-sm p-2 border rounded transition-colors ${
    theme === 'NeXTSTEP'
      ? `border-[#707070] bg-white focus:border-[#0066cc] ${error ? 'border-red-500' : ''}`
      : `border-gray-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 ${error ? 'border-red-500 focus:border-red-500' : ''}`
  }`;
}

export function TextInput({ definition, value, onChange, theme, error, onFocus, onBlur }: FieldInputProps) {
  return (
    <input
      type="text"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={definition.placeholder}
      className={getBaseInputClasses(theme, error)}
    />
  );
}

export function NumberInput({ definition, value, onChange, theme, error, onFocus, onBlur }: FieldInputProps) {
  return (
    <input
      type="number"
      value={(value as number) || ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={definition.placeholder}
      className={getBaseInputClasses(theme, error)}
    />
  );
}

export function BooleanInput({ value, onChange, theme }: FieldInputProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 w-full p-2 border rounded text-sm transition-colors ${
        theme === 'NeXTSTEP'
          ? `border-[#707070] hover:bg-[#f0f0f0] ${value ? 'bg-[#e6f3ff] border-[#0066cc]' : 'bg-white'}`
          : `border-gray-300 hover:bg-gray-50 ${value ? 'bg-blue-50 border-blue-300' : 'bg-white'}`
      }`}
    >
      {getFieldIcon('boolean', value)}
      <span className={value ? 'text-green-700' : 'text-gray-500'}>
        {value ? 'True' : 'False'}
      </span>
    </button>
  );
}

export function DateInput({ value, onChange, theme, error, onFocus, onBlur }: FieldInputProps) {
  return (
    <input
      type="date"
      value={value ? (value as string).split('T')[0] : ''}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={getBaseInputClasses(theme, error)}
    />
  );
}

export function SelectInput({ definition, value, onChange, theme, error, onFocus, onBlur }: FieldInputProps) {
  return (
    <select
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value || null)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={getBaseInputClasses(theme, error)}
    >
      <option value="">Select...</option>
      {definition.options?.map((option) => (
        <option key={option} value={option}>
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </option>
      ))}
    </select>
  );
}

export function TagInput({ definition, value, onChange, theme, error }: FieldInputProps) {
  const tags = (value as string[]) || [];
  const baseInputClasses = getBaseInputClasses(theme, error);

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
              onClick={() => onChange(tags.filter((_, i) => i !== index))}
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
              onChange([...tags, newTag]);
            }
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}

export function ReferenceInput({ definition, value, onChange, theme, error }: FieldInputProps) {
  const refs = (value as string[]) || [];
  const baseInputClasses = getBaseInputClasses(theme, error);

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
              onClick={() => onChange(refs.filter((_, i) => i !== index))}
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
              onChange([...refs, newRef]);
            }
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}

export function DefaultInput({ value, onChange, theme, error }: FieldInputProps) {
  return (
    <input
      type="text"
      value={String(value || '')}
      onChange={(e) => onChange(e.target.value)}
      className={getBaseInputClasses(theme, error)}
    />
  );
}