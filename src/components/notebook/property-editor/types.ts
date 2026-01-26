import type { PropertyDefinition } from '../../../types/notebook';

export interface PropertyFieldProps {
  definition: PropertyDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onRemove?: () => void;
  theme: 'NeXTSTEP' | 'Modern';
  error?: string;
  isCustom?: boolean;
}

export interface FieldInputProps {
  definition: PropertyDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  theme: 'NeXTSTEP' | 'Modern';
  error?: string;
  onFocus: () => void;
  onBlur: () => void;
}

export interface PropertyEditorProps {
  card: import('../../../types/notebook').NotebookCard;
  onUpdate: (properties: Record<string, unknown>) => void;
  theme: 'NeXTSTEP' | 'Modern';
}