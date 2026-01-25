// Notebook Card types for notebook sidecar

export type NotebookCardType = 'capture' | 'shell' | 'preview' | 'meeting' | 'code' | 'project';

export type PropertyType = 'text' | 'date' | 'tag' | 'reference' | 'number' | 'boolean' | 'select';

export interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  required?: boolean;
  defaultValue?: unknown;
  options?: string[]; // For tag/select properties
  placeholder?: string;
  description?: string;
}

export interface PropertyValue {
  definitionId: string;
  value: unknown;
  type: PropertyType;
}

export interface PropertyField {
  id: string;
  name: string;
  value: unknown;
  type: PropertyType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

export interface LayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

export interface NotebookCardProperties {
  [key: string]: any; // Flexible JSON object for custom properties
}

export interface NotebookTemplate {
  id: string;
  name: string;
  description: string;
  defaultProperties: NotebookCardProperties;
  defaultMarkdown: string;
  cardType: NotebookCardType;
  created_at: string;
  modified_at: string;
}

export interface NotebookCard {
  id: string;
  nodeId: string;
  markdownContent: string | null;
  renderedContent: string | null;
  properties: NotebookCardProperties | null;
  templateId: string | null;
  cardType: NotebookCardType;
  layoutPosition: LayoutPosition | null;
  createdAt: string;
  modifiedAt: string;
}

// Database row converters
export function rowToNotebookCard(row: Record<string, unknown>): NotebookCard {
  return {
    id: row.id as string,
    nodeId: row.node_id as string,
    markdownContent: row.markdown_content as string | null,
    renderedContent: row.rendered_content as string | null,
    properties: row.properties ? JSON.parse(row.properties as string) : null,
    templateId: row.template_id as string | null,
    cardType: row.card_type as NotebookCardType,
    layoutPosition: row.layout_position ? JSON.parse(row.layout_position as string) : null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
  };
}

export function notebookCardToRow(card: Partial<NotebookCard>): Record<string, unknown> {
  return {
    id: card.id,
    node_id: card.nodeId,
    markdown_content: card.markdownContent,
    rendered_content: card.renderedContent,
    properties: card.properties ? JSON.stringify(card.properties) : null,
    template_id: card.templateId,
    card_type: card.cardType,
    layout_position: card.layoutPosition ? JSON.stringify(card.layoutPosition) : null,
    created_at: card.createdAt,
    modified_at: card.modifiedAt,
  };
}

// Validation helpers
export function isValidNotebookCardType(type: string): type is NotebookCardType {
  return ['capture', 'shell', 'preview'].includes(type);
}

export function validateNotebookCard(card: Partial<NotebookCard>): string[] {
  const errors: string[] = [];

  if (!card.id) {
    errors.push('ID is required');
  }

  if (!card.nodeId) {
    errors.push('Node ID is required');
  }

  if (!card.cardType) {
    errors.push('Card type is required');
  } else if (!isValidNotebookCardType(card.cardType)) {
    errors.push('Card type must be capture, shell, or preview');
  }

  if (!card.createdAt) {
    errors.push('Created at timestamp is required');
  }

  if (!card.modifiedAt) {
    errors.push('Modified at timestamp is required');
  }

  return errors;
}

// Template for creating new notebook cards
export function createNotebookCardTemplate(
  nodeId: string,
  cardType: NotebookCardType = 'capture'
): Partial<NotebookCard> {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    nodeId,
    cardType,
    markdownContent: '',
    renderedContent: null,
    properties: null,
    templateId: null,
    layoutPosition: null,
    createdAt: now,
    modifiedAt: now,
  };
}

// Built-in property definitions for common Isometry patterns
export const BUILT_IN_PROPERTY_DEFINITIONS: PropertyDefinition[] = [
  {
    id: 'tags',
    name: 'Tags',
    type: 'tag',
    placeholder: 'Add tags...',
    description: 'Categorization tags for this card'
  },
  {
    id: 'priority',
    name: 'Priority',
    type: 'select',
    defaultValue: 'medium',
    options: ['low', 'medium', 'high', 'urgent'],
    description: 'Task or content priority level'
  },
  {
    id: 'status',
    name: 'Status',
    type: 'select',
    defaultValue: 'draft',
    options: ['draft', 'in-progress', 'review', 'complete', 'archived'],
    description: 'Current status of the card'
  },
  {
    id: 'related-nodes',
    name: 'Related Nodes',
    type: 'reference',
    placeholder: 'Link to other nodes...',
    description: 'References to related Isometry nodes'
  },
  {
    id: 'due-date',
    name: 'Due Date',
    type: 'date',
    description: 'Target completion date'
  },
  {
    id: 'assignee',
    name: 'Assignee',
    type: 'text',
    placeholder: 'Who is responsible?',
    description: 'Person responsible for this task'
  },
  {
    id: 'effort',
    name: 'Effort (hours)',
    type: 'number',
    placeholder: '0',
    description: 'Estimated effort in hours'
  },
  {
    id: 'archived',
    name: 'Archived',
    type: 'boolean',
    defaultValue: false,
    description: 'Whether this card is archived'
  }
];

// Property validation and utility functions
export function validatePropertyValue(value: unknown, definition: PropertyDefinition): string[] {
  const errors: string[] = [];

  // Check required fields
  if (definition.required && (value === null || value === undefined || value === '')) {
    errors.push(`${definition.name} is required`);
    return errors; // Don't validate further if required field is empty
  }

  // Type-specific validation
  switch (definition.type) {
    case 'text':
      if (value !== null && value !== undefined && typeof value !== 'string') {
        errors.push(`${definition.name} must be text`);
      }
      break;

    case 'number':
      if (value !== null && value !== undefined) {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${definition.name} must be a valid number`);
        }
      }
      break;

    case 'boolean':
      if (value !== null && value !== undefined && typeof value !== 'boolean') {
        errors.push(`${definition.name} must be true or false`);
      }
      break;

    case 'date':
      if (value !== null && value !== undefined) {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          errors.push(`${definition.name} must be a valid date`);
        }
      }
      break;

    case 'select':
      if (value !== null && value !== undefined && definition.options) {
        if (!definition.options.includes(value as string)) {
          errors.push(`${definition.name} must be one of: ${definition.options.join(', ')}`);
        }
      }
      break;

    case 'tag':
      if (value !== null && value !== undefined) {
        if (!Array.isArray(value)) {
          errors.push(`${definition.name} must be an array of tags`);
        } else {
          const invalidTags = value.filter(tag => typeof tag !== 'string');
          if (invalidTags.length > 0) {
            errors.push(`${definition.name} must contain only text tags`);
          }
        }
      }
      break;

    case 'reference':
      if (value !== null && value !== undefined) {
        if (!Array.isArray(value)) {
          errors.push(`${definition.name} must be an array of references`);
        } else {
          const invalidRefs = value.filter(ref => typeof ref !== 'string' || !ref.trim());
          if (invalidRefs.length > 0) {
            errors.push(`${definition.name} must contain only valid node IDs`);
          }
        }
      }
      break;
  }

  return errors;
}

export function serializePropertyValue(value: unknown, type: PropertyType): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'text':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return new Date(value as string).toISOString();
    case 'tag':
    case 'reference':
      return Array.isArray(value) ? value : [value];
    case 'select':
      return String(value);
    default:
      return value;
  }
}

export function deserializePropertyValue(value: unknown, type: PropertyType): unknown {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'text':
    case 'select':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return value; // Keep as ISO string for input[type="date"]
    case 'tag':
    case 'reference':
      return Array.isArray(value) ? value : [];
    default:
      return value;
  }
}