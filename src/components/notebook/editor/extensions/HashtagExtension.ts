/**
 * HashtagExtension - TipTap Mark for #tag syntax with autocomplete
 *
 * Phase 97-02: Implements hashtag marks with autocomplete from existing tags
 *
 * Usage: Type # followed by tag name, select from dropdown
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface HashtagAttributes {
  tag: string;
}

export interface HashtagOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Partial<SuggestionOptions<string>>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hashtag: {
      setHashtag: (attributes: HashtagAttributes) => ReturnType;
      unsetHashtag: () => ReturnType;
    };
  }
}

export const HashtagExtension = Mark.create<HashtagOptions>({
  name: 'hashtag',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {},
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag'),
        renderHTML: (attributes) => ({ 'data-tag': attributes.tag }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="hashtag"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tag = HTMLAttributes.tag || '';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'hashtag',
        class: 'hashtag',
      }),
      `#${tag}`,
    ];
  },

  addCommands() {
    return {
      setHashtag:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetHashtag:
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
        pluginKey: new PluginKey('hashtagSuggestion'),
        char: '#',
        allowSpaces: false,
        ...this.options.suggestion,
      }),
    ];
  },
});

// Type alias for hashtag suggestion props
export type HashtagSuggestionProps = SuggestionProps<string>;

/**
 * Create suggestion configuration for hashtag autocomplete
 */
export function createHashtagSuggestion(
  queryFn: (query: string) => string[],
  onSelectFn?: (tag: string) => void,
  renderConfig?: SuggestionOptions<string>['render']
): Partial<SuggestionOptions<string>> {
  return {
    char: '#',
    allowSpaces: false,
    items: ({ query }) => {
      return queryFn(query);
    },
    command: ({ editor, range, props }) => {
      // Insert the hashtag with mark
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          {
            type: 'text',
            text: `#${props}`,
            marks: [
              {
                type: 'hashtag',
                attrs: { tag: props },
              },
            ],
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();

      // Callback when tag is selected
      onSelectFn?.(props);
    },
    render: renderConfig,
  };
}
