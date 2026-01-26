import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import {
  // type NotebookCard,
  type PropertyDefinition,
  // type PropertyType,
  BUILT_IN_PROPERTY_DEFINITIONS,
  validatePropertyValue
} from '../../types/notebook';
import { debounce } from '../../utils/debounce';
import { PropertyField, CustomFieldAdder, StatusFooter } from './property-editor';
import type { PropertyEditorProps } from './property-editor';

// Type definitions for global error reporting
interface ErrorReportingAction {
  label: string;
  action: () => void | Promise<void>;
}

interface GlobalErrorReporting {
  reportUserError: (title: string, message: string, actions?: ErrorReportingAction[]) => void;
  reportUserInfo: (title: string, message: string) => void;
  reportUserWarning: (title: string, message: string) => void;
}

declare global {
  interface Window {
    errorReporting?: GlobalErrorReporting;
  }
}

export function PropertyEditor({ card, onUpdate, theme }: PropertyEditorProps) {
  const { updateCard } = useNotebook();
  const [properties, setProperties] = useState<Record<string, unknown>>(card.properties || {});
  const [customDefinitions, setCustomDefinitions] = useState<PropertyDefinition[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

        // Report error to global error service
        if (typeof window !== 'undefined' && window.errorReporting) {
          window.errorReporting.reportUserError(
            'Property Save Failed',
            'Your property changes could not be saved. Please try again.',
            [
              {
                label: 'Retry',
                action: async () => {
                  try {
                    await updateCard(card.id, { properties: props });
                    window.errorReporting?.reportUserInfo('Properties Saved', 'Your property changes have been saved.');
                  } catch {
                    window.errorReporting?.reportUserError('Save Still Failed', 'Unable to save properties. Please refresh and try again.');
                  }
                }
              },
              {
                label: 'Continue',
                action: () => {
                  window.errorReporting?.reportUserWarning('Changes Not Saved', 'Your property changes are not saved and may be lost.');
                }
              }
            ]
          );
        }
      } finally {
        setIsSaving(false);
      }
    }, 500),
    [updateCard, card.id, onUpdate]
  );

  // Validate and update properties
  const updateProperty = useCallback((key: string, value: unknown) => {
    const definition = allDefinitions.find(def => def.name === key);
    if (definition) {
      const validation = validatePropertyValue(value, definition);
      setErrors(prev => ({
        ...prev,
        [key]: validation.isValid ? '' : validation.error
      }));
    }

    const newProperties = { ...properties, [key]: value };
    setProperties(newProperties);
    debouncedSave(newProperties);
  }, [properties, allDefinitions, debouncedSave]);

  // Add custom field
  const addCustomField = useCallback((definition: PropertyDefinition) => {
    // Check if field name already exists
    const exists = allDefinitions.some(def => def.name === definition.name);
    if (exists) {
      return;
    }

    setCustomDefinitions(prev => [...prev, definition]);

    // Initialize with default value
    let defaultValue: unknown = null;
    if (definition.type === 'boolean') defaultValue = false;
    if (definition.type === 'tag' || definition.type === 'reference') defaultValue = [];

    updateProperty(definition.name, defaultValue);
  }, [allDefinitions, updateProperty]);

  // Remove custom field
  const removeCustomField = useCallback((fieldName: string) => {
    setCustomDefinitions(prev => prev.filter(def => def.name !== fieldName));

    const newProperties = { ...properties };
    delete newProperties[fieldName];
    setProperties(newProperties);
    debouncedSave(newProperties);

    // Remove any errors for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, [properties, debouncedSave]);

  // Sync properties when card changes
  useEffect(() => {
    setProperties(card.properties || {});
  }, [card.properties]);

  // Property count for status
  const propertyCount = Object.keys(properties).filter(key => {
    const value = properties[key];
    return value !== null && value !== undefined && value !== '' &&
           (!Array.isArray(value) || value.length > 0);
  }).length;

  return (
    <div className="space-y-4">
      {/* Property Fields */}
      <div className="space-y-3">
        {allDefinitions.map((definition) => {
          const isCustom = !BUILT_IN_PROPERTY_DEFINITIONS.includes(definition);
          const value = properties[definition.name];
          const error = errors[definition.name];

          // Only show fields that have values or are required
          if (!definition.required && (value === null || value === undefined || value === '')) {
            return null;
          }

          return (
            <PropertyField
              key={definition.name}
              definition={definition}
              value={value}
              onChange={(newValue) => updateProperty(definition.name, newValue)}
              onRemove={isCustom ? () => removeCustomField(definition.name) : undefined}
              theme={theme}
              error={error}
              isCustom={isCustom}
            />
          );
        })}
      </div>

      {/* Add Custom Field */}
      <div>
        <CustomFieldAdder onAdd={addCustomField} theme={theme} />
      </div>

      {/* Status Footer */}
      <StatusFooter
        propertyCount={propertyCount}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        errorCount={Object.keys(errors).filter(key => errors[key]).length}
        theme={theme}
      />
    </div>
  );
}

export default PropertyEditor;