/**
 * Rich Command Builder
 *
 * Visual interface for constructing complex Claude Code commands with:
 * - Template-based command construction
 * - Parameter helpers and validation
 * - Command preview and explanation
 * - Saved command templates
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Play,
  Save,
  Copy,
  FileText,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Star
} from 'lucide-react';

export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: CommandParameter[];
  category: 'development' | 'testing' | 'debugging' | 'deployment' | 'analysis' | 'custom';
  tags: string[];
  favorite: boolean;
  usage: number;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory' | 'choice' | 'text';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  choices?: string[];
  placeholder?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface BuiltCommand {
  command: string;
  parameters: Record<string, unknown>;
  finalCommand: string;
  description: string;
}

interface RichCommandBuilderProps {
  onCommandExecute: (command: BuiltCommand) => void;
  onSaveTemplate: (template: CommandTemplate) => void;
  savedTemplates: CommandTemplate[];
  className?: string;
}

const DEFAULT_TEMPLATES: CommandTemplate[] = [
  {
    id: 'implement-feature',
    name: 'Implement Feature',
    description: 'Implement a new feature with comprehensive testing and documentation',
    command: 'claude implement {feature} with {requirements}',
    parameters: [
      {
        name: 'feature',
        type: 'string',
        description: 'Name of the feature to implement',
        required: true,
        placeholder: 'e.g., user authentication, file upload, data visualization'
      },
      {
        name: 'requirements',
        type: 'text',
        description: 'Detailed requirements and acceptance criteria',
        required: true,
        placeholder: 'Describe what the feature should do, how it should work, and what the success criteria are'
      },
      {
        name: 'testing',
        type: 'choice',
        description: 'Testing approach',
        required: false,
        defaultValue: 'comprehensive',
        choices: ['none', 'basic', 'comprehensive', 'tdd']
      },
      {
        name: 'documentation',
        type: 'boolean',
        description: 'Include documentation',
        required: false,
        defaultValue: true
      }
    ],
    category: 'development',
    tags: ['feature', 'implementation', 'testing'],
    favorite: true,
    usage: 45
  },
  {
    id: 'fix-bug',
    name: 'Fix Bug',
    description: 'Investigate and fix a reported bug with proper testing',
    command: 'claude fix bug {description} in {component}',
    parameters: [
      {
        name: 'description',
        type: 'text',
        description: 'Description of the bug and steps to reproduce',
        required: true,
        placeholder: 'Describe what is broken, what should happen instead, and how to reproduce the issue'
      },
      {
        name: 'component',
        type: 'string',
        description: 'Component or area where the bug occurs',
        required: false,
        placeholder: 'e.g., login form, dashboard, API endpoint'
      },
      {
        name: 'priority',
        type: 'choice',
        description: 'Bug priority level',
        required: false,
        defaultValue: 'medium',
        choices: ['low', 'medium', 'high', 'critical']
      }
    ],
    category: 'debugging',
    tags: ['bug', 'fix', 'debugging'],
    favorite: true,
    usage: 32
  },
  {
    id: 'refactor-code',
    name: 'Refactor Code',
    description: 'Refactor existing code for better maintainability and performance',
    command: 'claude refactor {target} focusing on {goals}',
    parameters: [
      {
        name: 'target',
        type: 'file',
        description: 'File or component to refactor',
        required: true,
        placeholder: 'Select file or enter path'
      },
      {
        name: 'goals',
        type: 'text',
        description: 'Refactoring goals and objectives',
        required: true,
        placeholder: 'e.g., improve performance, reduce complexity, enhance readability, extract reusable components'
      },
      {
        name: 'preserveInterface',
        type: 'boolean',
        description: 'Preserve existing public interface',
        required: false,
        defaultValue: true
      }
    ],
    category: 'development',
    tags: ['refactor', 'cleanup', 'performance'],
    favorite: false,
    usage: 18
  },
  {
    id: 'write-tests',
    name: 'Write Tests',
    description: 'Create comprehensive tests for existing code',
    command: 'claude write tests for {target} covering {scenarios}',
    parameters: [
      {
        name: 'target',
        type: 'file',
        description: 'File or component to test',
        required: true,
        placeholder: 'Select file or enter path'
      },
      {
        name: 'scenarios',
        type: 'text',
        description: 'Test scenarios to cover',
        required: true,
        placeholder: 'e.g., happy path, error cases, edge cases, integration scenarios'
      },
      {
        name: 'testType',
        type: 'choice',
        description: 'Type of tests to write',
        required: false,
        defaultValue: 'unit',
        choices: ['unit', 'integration', 'e2e', 'all']
      },
      {
        name: 'coverage',
        type: 'number',
        description: 'Target test coverage percentage',
        required: false,
        defaultValue: 90,
        validation: { min: 0, max: 100 }
      }
    ],
    category: 'testing',
    tags: ['testing', 'quality', 'coverage'],
    favorite: false,
    usage: 24
  },
  {
    id: 'analyze-performance',
    name: 'Analyze Performance',
    description: 'Analyze and optimize application performance',
    command: 'claude analyze performance of {target} focusing on {metrics}',
    parameters: [
      {
        name: 'target',
        type: 'choice',
        description: 'Performance analysis target',
        required: true,
        choices: ['frontend', 'backend', 'database', 'api', 'full-stack']
      },
      {
        name: 'metrics',
        type: 'text',
        description: 'Specific metrics to analyze',
        required: true,
        placeholder: 'e.g., load time, memory usage, CPU utilization, database queries, bundle size'
      },
      {
        name: 'optimization',
        type: 'boolean',
        description: 'Include optimization recommendations',
        required: false,
        defaultValue: true
      }
    ],
    category: 'analysis',
    tags: ['performance', 'optimization', 'analysis'],
    favorite: false,
    usage: 12
  }
];

export function RichCommandBuilder({
  onCommandExecute,
  onSaveTemplate,
  savedTemplates,
  className
}: RichCommandBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({});
  const [isBuilding, setIsBuilding] = useState(false);
  const [builtCommand, setBuiltCommand] = useState<BuiltCommand | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['development']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Combine default and saved templates
  const allTemplates = [...DEFAULT_TEMPLATES, ...savedTemplates];

  // Filter and group templates
  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFavorites = !showFavoritesOnly || template.favorite;

    return matchesSearch && matchesFavorites;
  });

  const groupedTemplates = filteredTemplates.reduce((groups, template) => {
    if (!groups[template.category]) {
      groups[template.category] = [];
    }
    groups[template.category].push(template);
    return groups;
  }, {} as Record<string, CommandTemplate[]>);

  // Sort templates by usage within each category
  Object.keys(groupedTemplates).forEach(category => {
    groupedTemplates[category].sort((a, b) => b.usage - a.usage);
  });

  // Reset parameter values when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const initialValues = selectedTemplate.parameters.reduce((values, param) => {
        values[param.name] = param.defaultValue ?? '';
        return values;
      }, {} as Record<string, unknown>);
      setParameterValues(initialValues);
    } else {
      setParameterValues({});
    }
  }, [selectedTemplate]);

  // Build command when parameters change
  useEffect(() => {
    if (selectedTemplate) {
      const built = buildCommand(selectedTemplate, parameterValues);
      setBuiltCommand(built);
    } else {
      setBuiltCommand(null);
    }
  }, [selectedTemplate, parameterValues]);

  const buildCommand = useCallback((template: CommandTemplate, values: Record<string, unknown>): BuiltCommand => {
    let finalCommand = template.command;

    // Replace parameter placeholders
    template.parameters.forEach(param => {
      const value = values[param.name];
      if (value !== undefined && value !== '') {
        const placeholder = `{${param.name}}`;
        finalCommand = finalCommand.replace(placeholder, String(value));
      }
    });

    return {
      command: template.command,
      parameters: values,
      finalCommand,
      description: template.description
    };
  }, []);

  const handleParameterChange = useCallback((paramName: string, value: unknown) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  }, []);

  const handleExecuteCommand = useCallback(() => {
    if (builtCommand && selectedTemplate) {
      setIsBuilding(true);
      onCommandExecute(builtCommand);

      // Update usage count
      selectedTemplate.usage += 1;

      setTimeout(() => {
        setIsBuilding(false);
      }, 1000);
    }
  }, [builtCommand, selectedTemplate, onCommandExecute]);

  const handleSaveAsTemplate = useCallback(() => {
    if (builtCommand) {
      const newTemplate: CommandTemplate = {
        id: `custom-${Date.now()}`,
        name: 'Custom Command',
        description: builtCommand.description || 'Custom command template',
        command: builtCommand.finalCommand,
        parameters: [], // Would need UI to define parameters
        category: 'custom',
        tags: ['custom'],
        favorite: false,
        usage: 0
      };
      onSaveTemplate(newTemplate);
    }
  }, [builtCommand, onSaveTemplate]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const validateParameters = useCallback((template: CommandTemplate, values: Record<string, unknown>): string[] => {
    const errors: string[] = [];

    template.parameters.forEach(param => {
      const value = values[param.name];

      // Required field validation
      if (param.required && (value === undefined || value === '' || value === null)) {
        errors.push(`${param.name} is required`);
        return;
      }

      // Skip validation for empty non-required fields
      if (!param.required && (value === undefined || value === '' || value === null)) {
        return;
      }

      // Type-specific validation
      if (param.validation) {
        const { pattern, minLength, maxLength, min, max } = param.validation;

        if (pattern && typeof value === 'string' && !new RegExp(pattern).test(value)) {
          errors.push(`${param.name} format is invalid`);
        }

        if (minLength && typeof value === 'string' && value.length < minLength) {
          errors.push(`${param.name} must be at least ${minLength} characters`);
        }

        if (maxLength && typeof value === 'string' && value.length > maxLength) {
          errors.push(`${param.name} must be no more than ${maxLength} characters`);
        }

        if (min !== undefined && typeof value === 'number' && value < min) {
          errors.push(`${param.name} must be at least ${min}`);
        }

        if (max !== undefined && typeof value === 'number' && value > max) {
          errors.push(`${param.name} must be no more than ${max}`);
        }
      }
    });

    return errors;
  }, []);

  const isValid = selectedTemplate ? validateParameters(selectedTemplate, parameterValues).length === 0 : false;

  const renderParameterInput = useCallback((param: CommandParameter) => {
    const value = parameterValues[param.name];

    switch (param.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleParameterChange(param.name, e.target.checked)}
            className="rounded border-gray-600 bg-gray-700"
          />
        );

      case 'choice':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select...</option>
            {param.choices?.map(choice => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        );

      case 'text':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, parseFloat(e.target.value))}
            placeholder={param.placeholder}
            min={param.validation?.min}
            max={param.validation?.max}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  }, [parameterValues, handleParameterChange]);

  return (
    <div className={`${className} bg-gray-800 border border-gray-700 rounded-lg overflow-hidden`}>
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-200 flex items-center gap-2">
            <Settings size={20} className="text-blue-400" />
            Rich Command Builder
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-2 py-1 text-xs rounded ${
                showFavoritesOnly ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              <Star size={12} />
            </button>
          </div>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex">
        {/* Template Selection */}
        <div className="w-1/3 border-r border-gray-700 max-h-96 overflow-y-auto">
          {Object.entries(groupedTemplates).map(([category, templates]) => (
            <div key={category} className="border-b border-gray-700">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center justify-between"
              >
                <span className="font-medium text-gray-200 capitalize">
                  {category} ({templates.length})
                </span>
                {expandedCategories.has(category) ?
                  <ChevronDown size={16} /> :
                  <ChevronRight size={16} />
                }
              </button>

              {expandedCategories.has(category) && (
                <div className="pb-2">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full px-6 py-2 text-left text-sm hover:bg-gray-700 ${
                        selectedTemplate?.id === template.id ? 'bg-blue-900 border-l-2 border-blue-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-200 flex items-center gap-1">
                            {template.favorite && <Star size={12} className="text-yellow-400" />}
                            {template.name}
                          </div>
                          <div className="text-gray-400 text-xs truncate">
                            {template.description}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {template.usage}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Parameter Configuration */}
        <div className="w-2/3 p-4">
          {selectedTemplate ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-200 mb-2">
                  {selectedTemplate.name}
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  {selectedTemplate.description}
                </p>
              </div>

              {/* Parameters */}
              {selectedTemplate.parameters.length > 0 && (
                <div className="space-y-4">
                  <h5 className="font-medium text-gray-300">Parameters</h5>
                  {selectedTemplate.parameters.map(param => (
                    <div key={param.name} className="space-y-2">
                      <label className="block">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-300">
                            {param.name}
                            {param.required && <span className="text-red-400">*</span>}
                          </span>
                          <div title={param.description}>
                            <HelpCircle
                              size={12}
                              className="text-gray-500"
                            />
                          </div>
                        </div>
                        {renderParameterInput(param)}
                        {param.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {param.description}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Command Preview */}
              {builtCommand && (
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-300">Command Preview</h5>
                  <div className="bg-gray-900 border border-gray-600 rounded p-3">
                    <code className="text-green-400 text-sm">
                      {builtCommand.finalCommand}
                    </code>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {selectedTemplate && (
                (() => {
                  const errors = validateParameters(selectedTemplate, parameterValues);
                  if (errors.length > 0) {
                    return (
                      <div className="bg-red-900/30 border border-red-700 rounded p-3">
                        <h6 className="text-red-400 font-medium mb-1">Validation Errors:</h6>
                        <ul className="text-red-300 text-sm">
                          {errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={handleExecuteCommand}
                  disabled={!isValid || isBuilding}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={16} />
                  {isBuilding ? 'Executing...' : 'Execute'}
                </button>

                <button
                  onClick={() => builtCommand && navigator.clipboard.writeText(builtCommand.finalCommand)}
                  disabled={!builtCommand}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-gray-200 rounded-md hover:bg-gray-500 disabled:opacity-50"
                >
                  <Copy size={16} />
                  Copy
                </button>

                <button
                  onClick={handleSaveAsTemplate}
                  disabled={!builtCommand}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-gray-200 rounded-md hover:bg-gray-500 disabled:opacity-50"
                >
                  <Save size={16} />
                  Save Template
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a command template to get started</p>
              <p className="text-sm mt-2">
                Choose from pre-built templates or create your own custom commands
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}