import { useCallback } from 'react';
import { useNotebook } from '../contexts/NotebookContext';
import { useDatabase } from '../db/DatabaseContext';

export interface ProjectContext {
  activeCard: {
    title: string;
    content: string;
    type: string;
    createdAt: string;
    modifiedAt: string;
  } | null;
  project: {
    name: string;
    directory: string;
    packageInfo: Record<string, unknown> | null;
    keyFiles: string[];
  };
  database: {
    recentCards: Array<{ id: string; title: string; type: string; modifiedAt: string }>;
    nodeCount: number;
    recentActivity: Array<{ type: string; description: string; timestamp: string }>;
  };
  terminal: {
    cwd: string;
    lastCommands: string[];
  };
}

export type ContextType = 'card' | 'project' | 'full';

const MAX_CONTEXT_SIZE = 8000; // Token limit for Claude API
const MAX_CONTENT_SIZE = 2000; // Max size for individual content sections

interface UseProjectContextReturn {
  getActiveCardContext: () => ProjectContext['activeCard'];
  getProjectContext: () => ProjectContext['project'];
  getDatabaseContext: () => ProjectContext['database'];
  formatContextForClaude: (type: ContextType) => string;
  getFullContext: () => ProjectContext;
}

/**
 * Hook for aggregating project context for AI commands
 */
export function useProjectContext(): UseProjectContextReturn {
  const { activeCard } = useNotebook();
  const { execute } = useDatabase();

  const getActiveCardContext = useCallback((): ProjectContext['activeCard'] => {
    if (!activeCard) {
      return null;
    }

    return {
      title: activeCard.properties?.title as string || activeCard.nodeId || 'Untitled',
      content: truncateContent(activeCard.markdownContent || '', MAX_CONTENT_SIZE),
      type: activeCard.cardType,
      createdAt: activeCard.createdAt,
      modifiedAt: activeCard.modifiedAt
    };
  }, [activeCard]);

  const getProjectContext = useCallback((): ProjectContext['project'] => {
    // In a real implementation, this would read from the file system
    // For now, we'll provide static project information
    const projectName = 'Isometry';
    const projectDirectory = '/Users/mshaler/Developer/Projects/Isometry';

    // Simulated package.json info (in real implementation, would read from file)
    const packageInfo = {
      name: 'isometry',
      version: '1.0.0',
      type: 'React + TypeScript project',
      dependencies: ['React', 'TypeScript', 'D3.js', 'Tailwind CSS', 'SQLite'],
      description: 'PAFV-based data visualization system with SuperGrid architecture'
    };

    const keyFiles = [
      'src/components/Canvas.tsx',
      'src/contexts/NotebookContext.tsx',
      'src/hooks/useDatabase.ts',
      'src/types/notebook.ts',
      'docs/README.md'
    ];

    return {
      name: projectName,
      directory: projectDirectory,
      packageInfo,
      keyFiles
    };
  }, []);

  const getDatabaseContext = useCallback((): ProjectContext['database'] => {
    if (!execute) {
      return {
        recentCards: [],
        nodeCount: 0,
        recentActivity: []
      };
    }

    try {
      // For now, return mock data to avoid async issues
      // In a full implementation, this would use proper async state management
      const recentCards: Array<{ id: string; title: string; type: string; modifiedAt: string }> = [];
      const nodeCount = 0;

      // Get recent activity (simplified for now)
      const recentActivity = recentCards.slice(0, 3).map(card => ({
        type: 'card_modified',
        description: `Updated card: ${card.title}`,
        timestamp: card.modifiedAt
      }));

      return {
        recentCards,
        nodeCount,
        recentActivity
      };
    } catch (error) {
      console.warn('Failed to fetch database context:', error);
      return {
        recentCards: [],
        nodeCount: 0,
        recentActivity: []
      };
    }
  }, [execute]);

  const getTerminalContext = useCallback((): ProjectContext['terminal'] => {
    // In a real implementation, this would track terminal state
    return {
      cwd: '/Users/mshaler/Developer/Projects/Isometry',
      lastCommands: [] // Would be populated from command history
    };
  }, []);

  const getFullContext = useCallback((): ProjectContext => {
    return {
      activeCard: getActiveCardContext(),
      project: getProjectContext(),
      database: getDatabaseContext(),
      terminal: getTerminalContext()
    };
  }, [getActiveCardContext, getProjectContext, getDatabaseContext, getTerminalContext]);

  const formatContextForClaude = useCallback((type: ContextType): string => {
    const context = getFullContext();

    let formatted = '';

    if (type === 'card' || type === 'full') {
      if (context.activeCard) {
        formatted += `# Active Notebook Card\n\n`;
        formatted += `**Title:** ${context.activeCard.title}\n`;
        formatted += `**Type:** ${context.activeCard.type}\n`;
        formatted += `**Modified:** ${formatDate(context.activeCard.modifiedAt)}\n\n`;
        formatted += `**Content:**\n\`\`\`markdown\n${context.activeCard.content}\n\`\`\`\n\n`;
      } else {
        formatted += `# Active Notebook Card\n\nNo active card.\n\n`;
      }
    }

    if (type === 'project' || type === 'full') {
      formatted += `# Project Context\n\n`;
      formatted += `**Name:** ${context.project.name}\n`;
      formatted += `**Directory:** ${context.project.directory}\n`;

      if (context.project.packageInfo) {
        formatted += `**Description:** ${context.project.packageInfo.description}\n`;
        if (context.project.packageInfo.dependencies) {
          formatted += `**Tech Stack:** ${Array.isArray(context.project.packageInfo.dependencies)
            ? context.project.packageInfo.dependencies.join(', ')
            : context.project.packageInfo.dependencies}\n`;
        }
      }

      if (context.project.keyFiles.length > 0) {
        formatted += `\n**Key Files:**\n`;
        context.project.keyFiles.forEach(file => {
          formatted += `- ${file}\n`;
        });
      }
      formatted += '\n';
    }

    if (type === 'full') {
      // Database context
      formatted += `# Database Context\n\n`;
      formatted += `**Total Nodes:** ${context.database.nodeCount}\n`;

      if (context.database.recentCards.length > 0) {
        formatted += `\n**Recent Cards:**\n`;
        context.database.recentCards.forEach(card => {
          formatted += `- ${card.title} (${card.type}) - ${formatDate(card.modifiedAt)}\n`;
        });
      }

      if (context.database.recentActivity.length > 0) {
        formatted += `\n**Recent Activity:**\n`;
        context.database.recentActivity.forEach(activity => {
          formatted += `- ${activity.description} - ${formatDate(activity.timestamp)}\n`;
        });
      }
      formatted += '\n';

      // Terminal context
      formatted += `# Terminal Context\n\n`;
      formatted += `**Working Directory:** ${context.terminal.cwd}\n`;
      if (context.terminal.lastCommands.length > 0) {
        formatted += `**Recent Commands:** ${context.terminal.lastCommands.slice(-3).join(', ')}\n`;
      }
    }

    // Truncate if too large
    if (formatted.length > MAX_CONTEXT_SIZE) {
      formatted = formatted.substring(0, MAX_CONTEXT_SIZE) + '\n\n[...context truncated...]';
    }

    return formatted.trim();
  }, [getFullContext]);

  return {
    getActiveCardContext,
    getProjectContext,
    getDatabaseContext,
    formatContextForClaude,
    getFullContext
  };
}

/**
 * Truncate content to specified size with smart truncation
 */
function truncateContent(content: string, maxSize: number): string {
  if (content.length <= maxSize) {
    return content;
  }

  // Try to truncate at a reasonable boundary (end of paragraph or line)
  const truncated = content.substring(0, maxSize);
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastNewline > maxSize * 0.7) {
    return truncated.substring(0, lastNewline) + '\n\n[...content truncated...]';
  }

  return truncated + '\n\n[...content truncated...]';
}

/**
 * Format date for display in context
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}