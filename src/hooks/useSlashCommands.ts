import { useState, useCallback, useRef, useMemo } from 'react';
import { getCursorPosition, getMenuPosition } from '../utils/cursorPosition';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: 'isometry' | 'template' | 'format';
  content: string;
  cursorOffset?: number; // Where to place cursor after insert
  shortcut?: string;
}

export interface SlashCommandMenuState {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  selectedIndex: number;
  commands: SlashCommand[];
}

const ISOMETRY_COMMANDS: SlashCommand[] = [
  {
    id: 'pafv-query',
    label: 'PAFV Query',
    description: 'Insert PAFV projection pattern',
    category: 'isometry',
    content: '```sql\n-- PAFV Query\nSELECT * FROM nodes\nWHERE plane = "?" AND axis = "?" \nORDER BY facet;\n```',
    cursorOffset: 45,
    shortcut: 'pafv'
  },
  {
    id: 'latch-filter',
    label: 'LATCH Filter',
    description: 'Insert LATCH filter template',
    category: 'isometry',
    content: '## Filter Criteria\n- **Location:** ?\n- **Alphabet:** ?\n- **Time:** ?\n- **Category:** ?\n- **Hierarchy:** ?',
    cursorOffset: 35,
    shortcut: 'latch'
  },
  {
    id: 'graph-query',
    label: 'Graph Query',
    description: 'Insert graph traversal query',
    category: 'isometry',
    content: '```sql\n-- Graph Traversal\nWITH RECURSIVE graph_walk(node_id, depth) AS (\n  SELECT ?, 0\n  UNION ALL\n  SELECT e.to_node, gw.depth + 1\n  FROM edges e\n  JOIN graph_walk gw ON e.from_node = gw.node_id\n  WHERE gw.depth < 5\n)\nSELECT n.* FROM nodes n\nJOIN graph_walk gw ON n.id = gw.node_id;\n```',
    cursorOffset: 82,
    shortcut: 'graph'
  },
  {
    id: 'meeting-template',
    label: 'Meeting Notes',
    description: 'Insert meeting notes template',
    category: 'template',
    content: '# Meeting: [Title]\n\n**Date:** ' + new Date().toLocaleDateString() + '\n**Attendees:** \n**Duration:** \n\n## Agenda\n- [ ] \n\n## Discussion Notes\n\n\n## Action Items\n- [ ] **[Name]** - \n\n## Next Steps\n\n',
    cursorOffset: 19,
    shortcut: 'meeting'
  },
  {
    id: 'code-snippet',
    label: 'Code Snippet',
    description: 'Insert code block template',
    category: 'format',
    content: '```typescript\n// \n```',
    cursorOffset: 15,
    shortcut: 'code'
  },
  {
    id: 'task-list',
    label: 'Task List',
    description: 'Insert checkbox task list',
    category: 'format',
    content: '## Tasks\n- [ ] \n- [ ] \n- [ ] ',
    cursorOffset: 14,
    shortcut: 'tasks'
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert markdown table',
    category: 'format',
    content: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n|          |          |          |\n|          |          |          |',
    cursorOffset: 11,
    shortcut: 'table'
  },
  {
    id: 'math',
    label: 'Math Expression',
    description: 'Insert LaTeX math block',
    category: 'format',
    content: '$$\n\n$$',
    cursorOffset: 3,
    shortcut: 'math'
  }
];

export function useSlashCommands() {
  const [menuState, setMenuState] = useState<SlashCommandMenuState>({
    isOpen: false,
    query: '',
    position: { x: 0, y: 0 },
    selectedIndex: 0,
    commands: []
  });

  const insertTextCallback = useRef<((text: string, cursorOffset?: number) => void) | null>(null);

  // Filter commands based on query with fuzzy matching
  const filteredCommands = useMemo(() => {
    const query = menuState.query.toLowerCase();
    if (!query) return ISOMETRY_COMMANDS;

    return ISOMETRY_COMMANDS.filter(cmd => {
      const searchableText = `${cmd.label} ${cmd.description} ${cmd.shortcut || ''}`.toLowerCase();
      // Simple fuzzy matching: all query characters must appear in order
      let queryIndex = 0;
      for (let i = 0; i < searchableText.length && queryIndex < query.length; i++) {
        if (searchableText[i] === query[queryIndex]) {
          queryIndex++;
        }
      }
      return queryIndex === query.length;
    });
  }, [menuState.query]);

  // Register text insertion callback from editor
  const registerInsertText = useCallback((callback: (text: string, cursorOffset?: number) => void) => {
    insertTextCallback.current = callback;
  }, []);

  // Open menu at specific position
  const openMenu = useCallback((position: { x: number; y: number }, query = '') => {
    setMenuState({
      isOpen: true,
      query,
      position,
      selectedIndex: 0,
      commands: filteredCommands
    });
  }, [filteredCommands]);

  // Close menu
  const closeMenu = useCallback(() => {
    setMenuState(prev => ({
      ...prev,
      isOpen: false,
      query: '',
      selectedIndex: 0
    }));
  }, []);

  // Update search query
  const updateQuery = useCallback((query: string) => {
    setMenuState(prev => ({
      ...prev,
      query,
      selectedIndex: 0,
      commands: filteredCommands
    }));
  }, [filteredCommands]);

  // Navigate menu selection
  const navigateMenu = useCallback((direction: 'up' | 'down') => {
    setMenuState(prev => {
      const maxIndex = Math.max(0, filteredCommands.length - 1);
      const newIndex = direction === 'up'
        ? Math.max(0, prev.selectedIndex - 1)
        : Math.min(maxIndex, prev.selectedIndex + 1);

      return {
        ...prev,
        selectedIndex: newIndex
      };
    });
  }, [filteredCommands]);

  // Execute selected command
  const executeCommand = useCallback((commandId?: string) => {
    const command = commandId
      ? ISOMETRY_COMMANDS.find(cmd => cmd.id === commandId)
      : filteredCommands[menuState.selectedIndex];

    if (command && insertTextCallback.current) {
      insertTextCallback.current(command.content, command.cursorOffset);
      closeMenu();
      return true;
    }
    return false;
  }, [filteredCommands, menuState.selectedIndex, closeMenu]);

  // Execute command by shortcut
  const executeByShortcut = useCallback((shortcut: string) => {
    const command = ISOMETRY_COMMANDS.find(cmd => cmd.shortcut === shortcut);
    if (command) {
      return executeCommand(command.id);
    }
    return false;
  }, [executeCommand]);

  // Detect slash command trigger and handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent, currentContent: string, cursorPosition: number, element?: HTMLTextAreaElement | HTMLInputElement) => {
    // If menu is open, handle navigation
    if (menuState.isOpen) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          navigateMenu('up');
          return true;
        case 'ArrowDown':
          event.preventDefault();
          navigateMenu('down');
          return true;
        case 'Enter':
          event.preventDefault();
          return executeCommand();
        case 'Escape':
          event.preventDefault();
          closeMenu();
          return true;
        case 'Tab':
          event.preventDefault();
          return executeCommand();
        case 'Backspace': {
          // If we delete the last character and it was the '/', close menu
          const beforeCursor = currentContent.substring(0, cursorPosition - 1);
          const afterSlash = beforeCursor.split('/').pop() || '';
          if (afterSlash === '' && menuState.query === '') {
            closeMenu();
          }
          return false; // Let normal backspace happen
        }
        default:
          // Continue typing to update query
          return false;
      }
    }

    // Check for slash command trigger
    if (event.key === '/') {
      const beforeCursor = currentContent.substring(0, cursorPosition);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // Only trigger if at start of line or after whitespace
      if (currentLine.length === 0 || /\s$/.test(currentLine)) {
        // Calculate real cursor position for menu placement
        let position = { x: 100, y: 100 }; // Fallback position

        if (element) {
          try {
            const cursorPos = getCursorPosition(element, cursorPosition);
            const menuPos = getMenuPosition(cursorPos, 300, 200);
            position = { x: menuPos.x, y: menuPos.y };
          } catch (error) {
            console.warn('Failed to calculate cursor position, using fallback:', error);
          }
        }

        setTimeout(() => openMenu(position), 0);
      }
    }

    return false;
  }, [menuState, navigateMenu, executeCommand, closeMenu, openMenu]);

  // Handle text input when menu is open (for updating query)
  const handleTextInput = useCallback((text: string, cursorPosition: number, fullContent: string) => {
    if (!menuState.isOpen) return false;

    // Find the text after the last '/' before cursor
    const beforeCursor = fullContent.substring(0, cursorPosition);
    const lastSlashIndex = beforeCursor.lastIndexOf('/');

    if (lastSlashIndex === -1) {
      closeMenu();
      return false;
    }

    const query = beforeCursor.substring(lastSlashIndex + 1);
    updateQuery(query);
    return false; // Don't prevent normal text input
  }, [menuState.isOpen, closeMenu, updateQuery]);

  return {
    menuState: {
      ...menuState,
      commands: filteredCommands
    },
    commands: ISOMETRY_COMMANDS,
    filteredCommands,
    registerInsertText,
    openMenu,
    closeMenu,
    updateQuery,
    navigateMenu,
    executeCommand,
    executeByShortcut,
    handleKeyDown,
    handleTextInput
  };
}