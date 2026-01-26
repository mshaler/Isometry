import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import {
  serializePropertyValue,
  deserializePropertyValue
} from '../../../types/notebook';
import { getFieldIcon } from './fieldIcons';
import {
  TextInput,
  NumberInput,
  BooleanInput,
  DateInput,
  SelectInput,
  TagInput,
  ReferenceInput,
  DefaultInput
} from './FieldInputs';
import type { PropertyFieldProps, FieldInputProps } from './types';

export function PropertyField({
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

  const renderInput = () => {
    const inputProps: FieldInputProps = {
      definition,
      value: localValue,
      onChange: handleChange,
      theme,
      error,
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false)
    };

    switch (definition.type) {
      case 'text':
        return <TextInput {...inputProps} />;
      case 'number':
        return <NumberInput {...inputProps} />;
      case 'boolean':
        return <BooleanInput {...inputProps} />;
      case 'date':
        return <DateInput {...inputProps} />;
      case 'select':
        return <SelectInput {...inputProps} />;
      case 'tag':
        return <TagInput {...inputProps} />;
      case 'reference':
        return <ReferenceInput {...inputProps} />;
      default:
        return <DefaultInput {...inputProps} />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getFieldIcon(definition.type, localValue)}
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