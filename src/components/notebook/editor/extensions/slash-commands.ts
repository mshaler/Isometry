import { Extension, Editor, Range } from '@tiptap/core';
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  category: 'isometry' | 'template' | 'format';
  shortcut?: string;
  content?: string;
  cursorOffset?: number;
  action: (params: { editor: Editor; range: Range }) => void;
}

// Command registry - adapted from useSlashCommands.ts
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'save-card',
    label: 'Save Card',
    description: 'Save current content as new card',
    category: 'isometry',
    shortcut: 'save',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Dispatch custom event for CaptureComponent to handle
      window.dispatchEvent(new CustomEvent('isometry:save-card', {
        detail: { markdown: editor.getText() }
      }));
    },
  },
  {
    id: 'send-to-shell',
    label: 'Send to Shell',
    description: 'Send content or command to shell',
    category: 'isometry',
    shortcut: 'shell',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('isometry:send-to-shell', {
        detail: { content: editor.getText() }
      }));
    },
  },
  {
    id: 'pafv-query',
    label: 'PAFV Query',
    description: 'Insert PAFV projection pattern',
    category: 'isometry',
    shortcut: 'pafv',
    content: '```sql\n-- PAFV Query\nSELECT * FROM nodes\nWHERE plane = "?" AND axis = "?" \nORDER BY facet;\n```',
    cursorOffset: 45,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        '```sql\n-- PAFV Query\nSELECT * FROM nodes\nWHERE plane = "?" AND axis = "?" \nORDER BY facet;\n```'
      ).run();
    },
  },
  {
    id: 'latch-filter',
    label: 'LATCH Filter',
    description: 'Insert LATCH filter template',
    category: 'isometry',
    shortcut: 'latch',
    content: '## Filter Criteria\n- **Location:** ?\n- **Alphabet:** ?\n- **Time:** ?\n- **Category:** ?\n- **Hierarchy:** ?',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        '## Filter Criteria\n- **Location:** ?\n- **Alphabet:** ?\n- **Time:** ?\n- **Category:** ?\n- **Hierarchy:** ?'
      ).run();
    },
  },
  {
    id: 'graph-query',
    label: 'Graph Query',
    description: 'Insert graph traversal query',
    category: 'isometry',
    shortcut: 'graph',
    content: '```sql\n-- Graph Traversal\nWITH RECURSIVE graph_walk(node_id, depth) AS (\n  SELECT ?, 0\n  UNION ALL\n  SELECT e.to_node, gw.depth + 1\n  FROM edges e\n  JOIN graph_walk gw ON e.from_node = gw.node_id\n  WHERE gw.depth < 5\n)\nSELECT n.* FROM nodes n\nJOIN graph_walk gw ON n.id = gw.node_id;\n```',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        '```sql\n-- Graph Traversal\nWITH RECURSIVE graph_walk(node_id, depth) AS (\n  SELECT ?, 0\n  UNION ALL\n  SELECT e.to_node, gw.depth + 1\n  FROM edges e\n  JOIN graph_walk gw ON e.from_node = gw.node_id\n  WHERE gw.depth < 5\n)\nSELECT n.* FROM nodes n\nJOIN graph_walk gw ON n.id = gw.node_id;\n```'
      ).run();
    },
  },
  {
    id: 'template',
    label: 'Insert Template',
    description: 'Choose from saved templates',
    category: 'template',
    shortcut: 'template',
    action: ({ editor, range }) => {
      // Delete the slash command trigger first
      editor.chain().focus().deleteRange(range).run();

      // Dispatch event to open template picker modal
      // The modal will handle inserting the selected template
      window.dispatchEvent(new CustomEvent('isometry:open-template-picker', {
        detail: {
          editor,
          insertPosition: editor.state.selection.from
        }
      }));
    },
  },
  {
    id: 'meeting-template',
    label: 'Meeting Notes',
    description: 'Insert meeting notes template',
    category: 'template',
    shortcut: 'meeting',
    action: ({ editor, range }) => {
      const date = new Date().toLocaleDateString();
      editor.chain().focus().deleteRange(range).insertContent(
        `# Meeting: [Title]\n\n**Date:** ${date}\n**Attendees:** \n**Duration:** \n\n## Agenda\n- [ ] \n\n## Discussion Notes\n\n\n## Action Items\n- [ ] **[Name]** - \n\n## Next Steps\n\n`
      ).run();
    },
  },
  {
    id: 'code-snippet',
    label: 'Code Snippet',
    description: 'Insert code block template',
    category: 'format',
    shortcut: 'code',
    action: ({ editor, range }) => {
      editor.chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: 'typescript' })
        .run();
    },
  },
  {
    id: 'task-list',
    label: 'Task List',
    description: 'Insert checkbox task list',
    category: 'format',
    shortcut: 'tasks',
    action: ({ editor, range }) => {
      editor.chain()
        .focus()
        .deleteRange(range)
        .toggleTaskList()
        .run();
    },
  },
  // Isometry Embeds - Live D3.js visualizations
  {
    id: 'supergrid',
    label: 'SuperGrid',
    description: 'Embed live SuperGrid visualization',
    category: 'isometry',
    shortcut: 'grid',
    action: ({ editor, range }) => {
      editor.chain()
        .focus()
        .deleteRange(range)
        .setEmbed('supergrid')
        .run();
    },
  },
  {
    id: 'table',
    label: 'Table (SuperGrid)',
    description: 'Insert table as live SuperGrid view',
    category: 'isometry',
    shortcut: 'table',
    action: ({ editor, range }) => {
      // Tables are SuperGrid embeds - live PAFV projections
      editor.chain()
        .focus()
        .deleteRange(range)
        .setEmbed('supergrid', { title: 'Table' })
        .run();
    },
  },
  {
    id: 'network',
    label: 'Network Graph',
    description: 'Embed live network visualization',
    category: 'isometry',
    shortcut: 'network',
    action: ({ editor, range }) => {
      editor.chain()
        .focus()
        .deleteRange(range)
        .setEmbed('network')
        .run();
    },
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Embed live timeline visualization',
    category: 'isometry',
    shortcut: 'timeline',
    action: ({ editor, range }) => {
      editor.chain()
        .focus()
        .deleteRange(range)
        .setEmbed('timeline')
        .run();
    },
  },
  {
    id: 'math',
    label: 'Math Expression',
    description: 'Insert LaTeX math block',
    category: 'format',
    shortcut: 'math',
    content: '$$\n\n$$',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent(
        '$$\n\n$$'
      ).run();
    },
  },
  // Heading commands (h1-h6)
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    category: 'format',
    shortcut: 'h1',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    category: 'format',
    shortcut: 'h2',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    category: 'format',
    shortcut: 'h3',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: 'h4',
    label: 'Heading 4',
    description: 'Subsection heading',
    category: 'format',
    shortcut: 'h4',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run();
    },
  },
  {
    id: 'h5',
    label: 'Heading 5',
    description: 'Minor heading',
    category: 'format',
    shortcut: 'h5',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 5 }).run();
    },
  },
  {
    id: 'h6',
    label: 'Heading 6',
    description: 'Smallest heading',
    category: 'format',
    shortcut: 'h6',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 6 }).run();
    },
  },
  // Divider, quote, and date commands
  {
    id: 'divider',
    label: 'Divider',
    description: 'Insert horizontal line',
    category: 'format',
    shortcut: 'hr',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Insert blockquote',
    category: 'format',
    shortcut: 'quote',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    id: 'date',
    label: 'Current Date',
    description: "Insert today's date",
    category: 'format',
    shortcut: 'date',
    action: ({ editor, range }) => {
      const formattedDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      editor.chain().focus().deleteRange(range).insertContent(formattedDate).run();
    },
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlight important information',
    category: 'format',
    shortcut: 'callout',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
    },
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Collapsible section',
    category: 'format',
    shortcut: 'toggle',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setToggle().run();
    },
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    description: 'Add URL preview',
    category: 'format',
    shortcut: 'bookmark',
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBookmark().run();
    },
  },
];

export interface SlashCommandSuggestionProps extends SuggestionProps<SlashCommand> {
  items: SlashCommand[];
  command: (props: SlashCommand) => void;
}

export function createSlashCommandSuggestion(
  renderConfig: SuggestionOptions<SlashCommand>['render']
): Partial<SuggestionOptions<SlashCommand>> {
  return {
    char: '/',
    startOfLine: false,
    items: ({ query }) => {
      const q = query.toLowerCase();
      if (!q) return SLASH_COMMANDS;
      return SLASH_COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
      );
    },
    command: ({ editor, range, props }) => {
      props.action({ editor, range });
    },
    render: renderConfig,
  };
}

export interface SlashCommandsOptions {
  suggestion: Partial<SuggestionOptions<SlashCommand>>;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {} as Partial<SuggestionOptions<SlashCommand>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommandsSuggestion'),
        ...this.options.suggestion,
      }),
    ];
  },
});
