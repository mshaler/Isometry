// Notebook Card types for notebook sidecar

export type NotebookCardType = 'capture' | 'shell' | 'preview';

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