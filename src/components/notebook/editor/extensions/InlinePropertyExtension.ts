/**
 * InlinePropertyExtension - TipTap Mark for @key: value syntax
 *
 * Phase 97-01: Implements inline property marks that sync to PropertyEditor
 *
 * Usage: Type @status: active followed by space to create an inline property
 */

import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

export interface InlinePropertyAttributes {
  key: string;
  value: string;
}

export interface InlinePropertyOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineProperty: {
      setInlineProperty: (attributes: InlinePropertyAttributes) => ReturnType;
      unsetInlineProperty: () => ReturnType;
    };
  }
}

export const InlinePropertyExtension = Mark.create<InlinePropertyOptions>({
  name: 'inlineProperty',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-key'),
        renderHTML: (attributes) => ({ 'data-key': attributes.key }),
      },
      value: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-value'),
        renderHTML: (attributes) => ({ 'data-value': attributes.value }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-property"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const key = HTMLAttributes.key || '';
    const value = HTMLAttributes.value || '';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'inline-property',
        class: 'inline-property',
      }),
      `@${key}: ${value}`,
    ];
  },

  addCommands() {
    return {
      setInlineProperty:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetInlineProperty:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addInputRules() {
    return [
      // Match @key: value followed by space
      // Examples: @status: active , @priority: high , @due: 2026-02-15
      new InputRule({
        find: /@(\w+):\s*(\S+)\s$/,
        handler: ({ range, match, chain }) => {
          const [, key, value] = match;
          if (!key || !value) return null;

          const text = `@${key}: ${value}`;

          // Use chain to replace with marked text
          chain()
            .deleteRange(range)
            .insertContent([
              {
                type: 'text',
                text: text,
                marks: [
                  {
                    type: 'inlineProperty',
                    attrs: { key, value },
                  },
                ],
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();

          return null;
        },
      }),
    ];
  },
});
