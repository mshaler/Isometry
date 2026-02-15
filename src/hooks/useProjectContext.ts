import { useMemo, useCallback } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { useSQLiteQuery } from './database/useSQLiteQuery';
import type { CardContext, ProjectContext } from '@/services/claude-ai';
import { devLogger } from '@/utils/logging';

interface UseProjectContextOptions {
  activeNodeId?: string;
}

/**
 * Hook to gather current Isometry project context for Claude AI
 */
export function useProjectContext(options: UseProjectContextOptions = {}) {
  const { filters } = useFilters();

  // Query active card if ID provided
  // Use empty query that returns nothing when no activeNodeId
  const cardQuery = options.activeNodeId
    ? `SELECT id, name, folder, tags, node_type FROM nodes WHERE id = ?`
    : `SELECT id, name, folder, tags, node_type FROM nodes WHERE 1=0`;
  const cardParams = options.activeNodeId ? [options.activeNodeId] : [];

  const { data: activeCardData } = useSQLiteQuery<{
    id: string;
    name: string;
    folder: string;
    tags: string;
    node_type: string;
  }>(cardQuery, cardParams);

  // Query notebook content if available
  const notebookQuery = options.activeNodeId
    ? `SELECT markdown_content FROM notebook_cards WHERE node_id = ?`
    : `SELECT markdown_content FROM notebook_cards WHERE 1=0`;
  const notebookParams = options.activeNodeId ? [options.activeNodeId] : [];

  const { data: notebookData } = useSQLiteQuery<{
    markdown_content: string;
  }>(notebookQuery, notebookParams);

  // Build card context from query results
  const activeCard = useMemo((): CardContext | undefined => {
    if (!activeCardData || activeCardData.length === 0) return undefined;

    const card = activeCardData[0];
    const content = notebookData?.[0]?.markdown_content;

    let parsedTags: string[] = [];
    if (card.tags) {
      try {
        parsedTags = JSON.parse(card.tags);
      } catch {
        // tags might be a simple string, not JSON
        parsedTags = card.tags ? [card.tags] : [];
      }
    }

    return {
      id: card.id,
      name: card.name,
      folder: card.folder,
      tags: parsedTags,
      nodeType: card.node_type,
      content
    };
  }, [activeCardData, notebookData]);

  // Convert filter array to simple record
  const filterRecord = useMemo((): Record<string, string[]> => {
    const result: Record<string, string[]> = {};

    for (const filter of filters) {
      const fieldName = filter.field;
      const valueStr = String(filter.value);

      if (!result[fieldName]) {
        result[fieldName] = [];
      }
      result[fieldName].push(valueStr);
    }

    return result;
  }, [filters]);

  // Build complete project context
  const projectContext = useMemo((): ProjectContext => {
    return {
      activeCard,
      filters: Object.keys(filterRecord).length > 0 ? filterRecord : undefined,
      currentView: 'supergrid' // TODO: Get from view context when available
    };
  }, [activeCard, filterRecord]);

  // Memoized getter for context
  const getContext = useCallback(() => {
    devLogger.debug('Getting project context', {
      component: 'useProjectContext',
      hasActiveCard: !!activeCard,
      filterCount: Object.keys(filterRecord).length
    });
    return projectContext;
  }, [projectContext, activeCard, filterRecord]);

  return {
    projectContext,
    activeCard,
    filters: filterRecord,
    getContext
  };
}
