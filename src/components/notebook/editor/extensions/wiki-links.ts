import { Mark, mergeAttributes } from '@tiptap/core';
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { CardSuggestion } from '@/utils/editor/backlinks';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { href: string; title: string }) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Partial<SuggestionOptions<CardSuggestion>>;
}

export const WikiLink = Mark.create<WikiLinkOptions>({
  name: 'wikiLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {} as Partial<SuggestionOptions<CardSuggestion>>,
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('href'),
        renderHTML: (attributes) => ({ href: attributes.href }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => ({ title: attributes.title }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="wiki-link"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-type': 'wiki-link',
          class: 'wiki-link text-blue-600 underline cursor-pointer hover:text-blue-800',
        }
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('wikiLinkSuggestion'),
        ...this.options.suggestion,
      }),
    ];
  },
});

export interface WikiLinkSuggestionProps extends SuggestionProps<CardSuggestion> {
  // Extend if needed
}

export function createWikiLinkSuggestion(
  queryFn: (query: string) => CardSuggestion[],
  onSelectFn: (item: CardSuggestion, sourceCardId: string | undefined) => void,
  sourceCardId: string | undefined,
  renderConfig: SuggestionOptions<CardSuggestion>['render']
): Partial<SuggestionOptions<CardSuggestion>> {
  return {
    char: '[[',
    allowSpaces: true,
    items: ({ query }) => {
      return queryFn(query);
    },
    command: ({ editor, range, props }) => {
      // Insert the link text with wiki link mark
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          {
            type: 'text',
            text: props.name,
            marks: [
              {
                type: 'wikiLink',
                attrs: {
                  href: `#card-${props.id}`,
                  title: props.name,
                },
              },
            ],
          },
        ])
        .run();

      // Create the LINK edge in sql.js
      onSelectFn(props, sourceCardId);
    },
    render: renderConfig,
  };
}
