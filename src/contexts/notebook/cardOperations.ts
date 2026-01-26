import type { NotebookCard, NotebookCardType, NotebookTemplate } from '../../types/notebook';
import { createNotebookCardTemplate, rowToNotebookCard, notebookCardToRow } from '../../types/notebook';
import { generateId } from '../../utils/id';
import type { ErrorReporting } from '../../services/ErrorReportingService';

export function createCardOperations(
  execute: (query: string, params?: unknown[]) => unknown[] | Promise<unknown[]>,
  errorReporting: ErrorReporting,
  performanceHook: { measureQuery: (operation: string, duration: number) => void }
) {

  const loadCards = async (): Promise<NotebookCard[]> => {
    const queryStart = performance.now();

    try {
      const rowsResult = execute<Record<string, unknown>>(
        `SELECT nc.*, n.name, n.node_type
         FROM notebook_cards nc
         JOIN nodes n ON nc.node_id = n.id
         WHERE n.deleted_at IS NULL
         ORDER BY nc.modified_at DESC`
      );

      // Handle both sync (sql.js) and async (native API) execute results
      const rows = Array.isArray(rowsResult) ? rowsResult : await rowsResult;

      const queryDuration = performance.now() - queryStart;
      performanceHook.measureQuery('loadCards', queryDuration);

      return rows.map(rowToNotebookCard);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load cards');
      throw error;
    }
  };

  const createCard = async (
    type: NotebookCardType,
    template: NotebookTemplate | undefined,
    saveCustomTemplates: (templates: NotebookTemplate[]) => void,
    templates: NotebookTemplate[]
  ): Promise<NotebookCard> => {
    const cardId = generateId();
    const nodeId = generateId();
    const now = new Date().toISOString();

    try {
      // Update template usage count
      if (template && template.category === 'custom') {
        template.usageCount = (template.usageCount || 0) + 1;
        const customTemplates = templates.filter(t => t.category === 'custom');
        saveCustomTemplates(customTemplates);
      }

      // Create node first
      const cardName = template ?
        template.markdownContent.split('\n')[0].replace(/^#\s*/, '') || `Untitled ${type} card` :
        `Untitled ${type} card`;

      execute(
        `INSERT INTO nodes (id, node_type, name, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [nodeId, 'notebook', cardName, now, now]
      );

      // Create notebook card with template content
      const cardTemplate = createNotebookCardTemplate(nodeId, template?.cardType || type);
      cardTemplate.id = cardId;
      cardTemplate.templateId = template?.id || null;

      // Apply template content and properties
      if (template) {
        cardTemplate.markdownContent = template.markdownContent;
        cardTemplate.properties = { ...template.properties };
      }

      const rowData = notebookCardToRow(cardTemplate);
      execute(
        `INSERT INTO notebook_cards
         (id, node_id, markdown_content, rendered_content, properties, template_id, card_type, layout_position, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowData.id,
          rowData.node_id,
          rowData.markdown_content,
          rowData.rendered_content,
          rowData.properties,
          rowData.template_id,
          rowData.card_type,
          rowData.layout_position,
          rowData.created_at,
          rowData.modified_at,
        ]
      );

      return cardTemplate as NotebookCard;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create card');
      throw error;
    }
  };

  const updateCard = async (id: string, updates: Partial<NotebookCard>): Promise<void> => {
    try {
      const updateFields: string[] = [];
      const params: unknown[] = [];

      if (updates.markdownContent !== undefined) {
        updateFields.push('markdown_content = ?');
        params.push(updates.markdownContent);
      }

      if (updates.properties !== undefined) {
        updateFields.push('properties = ?');
        params.push(JSON.stringify(updates.properties));
      }

      if (updates.layoutPosition !== undefined) {
        updateFields.push('layout_position = ?');
        params.push(JSON.stringify(updates.layoutPosition));
      }

      if (updateFields.length === 0) {
        return; // Nothing to update
      }

      updateFields.push('modified_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      execute(
        `UPDATE notebook_cards SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );

      // Update node name if markdown content changed
      if (updates.markdownContent !== undefined) {
        const newName = updates.markdownContent.split('\n')[0].replace(/^#\s*/, '') || 'Untitled card';
        execute(
          `UPDATE nodes SET name = ?, modified_at = ?
           WHERE id = (SELECT node_id FROM notebook_cards WHERE id = ?)`,
          [newName, new Date().toISOString(), id]
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update card');
      throw error;
    }
  };

  const deleteCard = async (id: string): Promise<void> => {
    try {
      const now = new Date().toISOString();

      // Soft delete the node (which cascades to notebook card via foreign key)
      execute(
        `UPDATE nodes SET deleted_at = ?
         WHERE id = (SELECT node_id FROM notebook_cards WHERE id = ?)`,
        [now, id]
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete card');
      throw error;
    }
  };

  return {
    loadCards,
    createCard,
    updateCard,
    deleteCard
  };
}