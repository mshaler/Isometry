import React, { useState, useCallback, useMemo } from 'react';
import type { SelectedFile, FieldMapping } from './ImportWizard';

interface FieldMapperProps {
  file: SelectedFile | null;
  files: SelectedFile[];
  onNext: (mappings: FieldMapping) => void;
  fieldMappings: FieldMapping;
}

interface DetectedField {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  source: string; // filename where found
  frequency: number; // how many files have this field
  examples: string[]; // sample values
}

interface LatchCategory {
  id: keyof FieldMapping;
  name: string;
  description: string;
  color: string;
  properties: string[];
}

const LATCH_CATEGORIES: LatchCategory[] = [
  {
    id: 'location',
    name: 'Location',
    description: 'Geographic or spatial information',
    color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    properties: ['location', 'place', 'geo', 'coordinates', 'address', 'region', 'country', 'city'],
  },
  {
    id: 'alphabet',
    name: 'Alphabet',
    description: 'Names, titles, and identifiers',
    color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    properties: ['title', 'name', 'label', 'slug', 'id', 'identifier', 'key', 'alias'],
  },
  {
    id: 'time',
    name: 'Time',
    description: 'Temporal information and dates',
    color: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    properties: ['date', 'created', 'updated', 'modified', 'time', 'published', 'timestamp', 'year'],
  },
  {
    id: 'category',
    name: 'Category',
    description: 'Classifications and groupings',
    color: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
    properties: ['category', 'categories', 'tag', 'tags', 'type', 'kind', 'status', 'priority'],
  },
  {
    id: 'hierarchy',
    name: 'Hierarchy',
    description: 'Relationships and structure',
    color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    properties: ['parent', 'children', 'level', 'depth', 'index', 'order', 'weight', 'rank'],
  },
];

export const FieldMapper: React.FC<FieldMapperProps> = ({
  file,
  files,
  onNext,
  fieldMappings,
}) => {
  const [mappings, setMappings] = useState<FieldMapping>(fieldMappings || {});
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({});

  // Analyze all files to detect common fields
  const detectedFields = useMemo(() => {
    const fieldMap = new Map<string, DetectedField>();

    files.forEach(f => {
      const frontmatter = extractFrontmatter(f.content);
      if (frontmatter) {
        Object.entries(frontmatter).forEach(([key, value]) => {
          const existing = fieldMap.get(key);
          const valueStr = String(value);

          if (existing) {
            existing.frequency += 1;
            if (!existing.examples.includes(valueStr) && existing.examples.length < 3) {
              existing.examples.push(valueStr);
            }
          } else {
            fieldMap.set(key, {
              name: key,
              value,
              type: detectFieldType(value),
              source: f.name,
              frequency: 1,
              examples: [valueStr],
            });
          }
        });
      }
    });

    return Array.from(fieldMap.values()).sort((a, b) => b.frequency - a.frequency);
  }, [files]);

  // Auto-suggest LATCH mappings based on field names
  const suggestedMappings = useMemo(() => {
    const suggestions: FieldMapping = {};

    detectedFields.forEach(field => {
      const fieldNameLower = field.name.toLowerCase();

      // Find best matching LATCH category
      for (const category of LATCH_CATEGORIES) {
        const match = category.properties.find(prop =>
          fieldNameLower.includes(prop) ||
          prop.includes(fieldNameLower)
        );

        if (match) {
          if (!suggestions[field.name]) {
            suggestions[field.name] = {
              targetProperty: category.id,
            };
          }
          break;
        }
      }

      // If no LATCH match, suggest custom property
      if (!suggestions[field.name]) {
        suggestions[field.name] = {
          targetProperty: 'custom',
          customProperty: field.name,
        };
      }
    });

    return suggestions;
  }, [detectedFields]);

  const handleMappingChange = useCallback((fieldName: string, targetProperty: string, customProperty?: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldName]: {
        targetProperty,
        customProperty,
      },
    }));

    if (customProperty) {
      setCustomProperties(prev => ({
        ...prev,
        [fieldName]: customProperty,
      }));
    }
  }, []);

  const handleApplySuggestions = useCallback(() => {
    setMappings(suggestedMappings);

    // Extract custom properties from suggestions
    const customs: Record<string, string> = {};
    Object.entries(suggestedMappings).forEach(([fieldName, mapping]) => {
      if (mapping.customProperty) {
        customs[fieldName] = mapping.customProperty;
      }
    });
    setCustomProperties(customs);
  }, [suggestedMappings]);

  const handleClearMappings = useCallback(() => {
    setMappings({});
    setCustomProperties({});
  }, []);

  const handleNext = useCallback(() => {
    const finalMappings = { ...mappings };

    // Add custom properties to mappings
    Object.entries(customProperties).forEach(([fieldName, customProp]) => {
      if (finalMappings[fieldName]?.targetProperty === 'custom') {
        finalMappings[fieldName].customProperty = customProp;
      }
    });

    onNext(finalMappings);
  }, [mappings, customProperties, onNext]);

  const renderFieldItem = (field: DetectedField) => {
    const mapping = mappings[field.name];
    const isCustom = mapping?.targetProperty === 'custom';

    return (
      <div key={field.name} className="field-item border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="field-header flex items-start justify-between mb-3">
          <div className="field-info flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {field.name}
            </h4>
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>Type: {field.type}</span>
              <span>In {field.frequency}/{files.length} files</span>
            </div>
            <div className="field-examples mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Examples: {field.examples.slice(0, 3).join(', ')}
                {field.examples.length > 3 && '...'}
              </span>
            </div>
          </div>
        </div>

        <div className="field-mapping">
          <div className="mapping-selector flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Map to:
            </label>
            <select
              value={mapping?.targetProperty || ''}
              onChange={(e) => handleMappingChange(field.name, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select mapping...</option>
              {LATCH_CATEGORIES.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name} - {category.description}
                </option>
              ))}
              <option value="custom">Custom Property</option>
              <option value="ignore">Ignore Field</option>
            </select>
          </div>

          {/* Custom Property Input */}
          {isCustom && (
            <div className="custom-property mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Property Name:
              </label>
              <input
                type="text"
                value={customProperties[field.name] || field.name}
                onChange={(e) => setCustomProperties(prev => ({
                  ...prev,
                  [field.name]: e.target.value,
                }))}
                placeholder="Enter custom property name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* LATCH Category Info */}
          {mapping?.targetProperty && mapping.targetProperty !== 'custom' && mapping.targetProperty !== 'ignore' && (
            <div className="latch-info mt-3">
              {(() => {
                const category = LATCH_CATEGORIES.find(c => c.id === mapping.targetProperty);
                if (!category) return null;

                return (
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${category.color}`}>
                    <span className="font-medium">{category.name}</span>
                    <span className="ml-2">{category.description}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="field-mapper">
      {/* Header */}
      <div className="mapper-header mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Map Fields to LATCH Properties
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Configure how frontmatter fields should be mapped to Isometry's LATCH categorization system.
        </p>
      </div>

      {/* Stats */}
      <div className="mapping-stats mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {detectedFields.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Unique Fields Detected
          </div>
        </div>
        <div className="stat-card bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Object.keys(mappings).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Fields Mapped
          </div>
        </div>
        <div className="stat-card bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {files.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Files to Process
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mapper-actions mb-6 flex flex-wrap gap-3">
        <button
          onClick={handleApplySuggestions}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Apply Suggestions
        </button>
        <button
          onClick={handleClearMappings}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* LATCH Categories Reference */}
      <div className="latch-reference mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          LATCH Categories Reference
        </h4>
        <div className="categories-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {LATCH_CATEGORIES.map(category => (
            <div key={category.id} className={`category-card p-3 rounded-lg ${category.color}`}>
              <div className="font-semibold text-sm">{category.name}</div>
              <div className="text-xs mt-1 opacity-90">{category.description}</div>
              <div className="text-xs mt-2 opacity-75">
                Common fields: {category.properties.slice(0, 3).join(', ')}
                {category.properties.length > 3 && '...'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fields List */}
      {detectedFields.length > 0 ? (
        <div className="fields-list space-y-4 mb-8">
          <h4 className="font-medium text-gray-900 dark:text-white">
            Detected Fields ({detectedFields.length})
          </h4>
          {detectedFields.map(renderFieldItem)}
        </div>
      ) : (
        <div className="no-fields text-center py-8 mb-8">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            No Fields Detected
          </h4>
          <p className="text-gray-500 dark:text-gray-400">
            No frontmatter fields were found in the selected markdown files.
          </p>
        </div>
      )}

      {/* Mapping Summary */}
      {Object.keys(mappings).length > 0 && (
        <div className="mapping-summary mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Mapping Summary
          </h4>
          <div className="summary-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {LATCH_CATEGORIES.map(category => {
              const categoryMappings = Object.entries(mappings).filter(
                ([_, mapping]) => mapping.targetProperty === category.id
              );

              return (
                <div key={category.id} className="category-summary">
                  <div className={`p-2 rounded text-sm ${category.color}`}>
                    <div className="font-semibold">{category.name}</div>
                    <div className="text-xs mt-1">
                      {categoryMappings.length} field{categoryMappings.length === 1 ? '' : 's'}
                    </div>
                    {categoryMappings.length > 0 && (
                      <div className="text-xs mt-1 opacity-75">
                        {categoryMappings.map(([fieldName]) => fieldName).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom and Ignored Fields */}
          <div className="custom-fields mt-4 flex flex-wrap gap-4">
            {Object.entries(mappings).filter(([_, mapping]) => mapping.targetProperty === 'custom').length > 0 && (
              <div className="custom-summary">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Properties:</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.entries(mappings)
                    .filter(([_, mapping]) => mapping.targetProperty === 'custom')
                    .map(([fieldName]) => customProperties[fieldName] || fieldName)
                    .join(', ')
                  }
                </div>
              </div>
            )}

            {Object.entries(mappings).filter(([_, mapping]) => mapping.targetProperty === 'ignore').length > 0 && (
              <div className="ignored-summary">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Ignored Fields:</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.entries(mappings)
                    .filter(([_, mapping]) => mapping.targetProperty === 'ignore')
                    .map(([fieldName]) => fieldName)
                    .join(', ')
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Button */}
      <div className="next-action text-center">
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Start Import
        </button>
      </div>
    </div>
  );
};

// Helper Functions

function extractFrontmatter(content: string): Record<string, any> | null {
  const lines = content.split('\n');

  // Check for YAML frontmatter
  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex > 0) {
      const yamlContent = lines.slice(1, endIndex).join('\n');
      return parseYamlSafe(yamlContent);
    }
  }

  // Check for TOML frontmatter
  if (lines[0] === '+++') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '+++');
    if (endIndex > 0) {
      const tomlContent = lines.slice(1, endIndex).join('\n');
      return parseTomlSafe(tomlContent);
    }
  }

  // Check for JSON frontmatter
  if (lines[0] === '{') {
    let braceCount = 0;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount === 0 && i > 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex > 0) {
      const jsonContent = lines.slice(0, endIndex + 1).join('\n');
      return parseJsonSafe(jsonContent);
    }
  }

  return null;
}

function parseYamlSafe(yamlContent: string): Record<string, any> {
  try {
    const result: Record<string, any> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value = trimmed.substring(colonIndex + 1).trim();

          // Handle arrays (simplified)
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            // Basic type conversion
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (/^\d+$/.test(value)) value = parseInt(value);
            else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
            else value = value.replace(/^["']|["']$/g, '');
          }

          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

function parseTomlSafe(tomlContent: string): Record<string, any> {
  try {
    const result: Record<string, any> = {};
    const lines = tomlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          let value = trimmed.substring(equalIndex + 1).trim();

          // Handle arrays (simplified)
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            // Basic type conversion
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (/^\d+$/.test(value)) value = parseInt(value);
            else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
            else value = value.replace(/^["']|["']$/g, '');
          }

          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

function parseJsonSafe(jsonContent: string): Record<string, any> {
  try {
    return JSON.parse(jsonContent);
  } catch {
    return {};
  }
}

function detectFieldType(value: any): 'string' | 'number' | 'boolean' | 'date' | 'array' {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';

  const stringValue = String(value);

  // Check for date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
  ];

  if (datePatterns.some(pattern => pattern.test(stringValue))) {
    return 'date';
  }

  return 'string';
}