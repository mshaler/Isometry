/**
 * EmbedExtension - TipTap Node for Isometry Embeds
 *
 * Renders live D3.js visualizations (SuperGrid, Network, Timeline) within documents.
 * /table slash command maps to SuperGrid embed - tables are live PAFV projections.
 *
 * @see Phase 98: Isometry Embeds
 * @see Pattern: BookmarkExtension.ts
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EmbedNode } from '../nodes/EmbedNode';
import {
  EmbedType,
  EmbedAttributes,
  DEFAULT_EMBED_ATTRIBUTES,
  DEFAULT_EMBED_DIMENSIONS,
} from './embed-types';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      /**
       * Insert an Isometry embed (SuperGrid, Network, or Timeline)
       */
      setEmbed: (type: EmbedType, attrs?: Partial<EmbedAttributes>) => ReturnType;
    };
  }
}

export const EmbedExtension = Node.create({
  name: 'embed',
  group: 'block',
  atom: true, // Non-editable, treated as single unit

  addAttributes() {
    return {
      type: {
        default: 'supergrid' as EmbedType,
        parseHTML: (element) => (element.getAttribute('data-type') || 'supergrid') as EmbedType,
        renderHTML: (attributes) => ({ 'data-type': attributes.type }),
      },
      sql: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-sql') || '',
        renderHTML: (attributes) => attributes.sql ? { 'data-sql': attributes.sql } : {},
      },
      xAxis: {
        default: 'category',
        parseHTML: (element) => element.getAttribute('data-x-axis') || 'category',
        renderHTML: (attributes) => attributes.xAxis ? { 'data-x-axis': attributes.xAxis } : {},
      },
      yAxis: {
        default: 'time',
        parseHTML: (element) => element.getAttribute('data-y-axis') || 'time',
        renderHTML: (attributes) => attributes.yAxis ? { 'data-y-axis': attributes.yAxis } : {},
      },
      xFacet: {
        default: 'folder',
        parseHTML: (element) => element.getAttribute('data-x-facet') || 'folder',
        renderHTML: (attributes) => attributes.xFacet ? { 'data-x-facet': attributes.xFacet } : {},
      },
      yFacet: {
        default: 'year',
        parseHTML: (element) => element.getAttribute('data-y-facet') || 'year',
        renderHTML: (attributes) => attributes.yFacet ? { 'data-y-facet': attributes.yFacet } : {},
      },
      width: {
        default: DEFAULT_EMBED_DIMENSIONS.width,
        parseHTML: (element) => {
          const w = element.getAttribute('data-width');
          return w ? parseInt(w, 10) : DEFAULT_EMBED_DIMENSIONS.width;
        },
        renderHTML: (attributes) => ({ 'data-width': String(attributes.width) }),
      },
      height: {
        default: DEFAULT_EMBED_DIMENSIONS.height,
        parseHTML: (element) => {
          const h = element.getAttribute('data-height');
          return h ? parseInt(h, 10) : DEFAULT_EMBED_DIMENSIONS.height;
        },
        renderHTML: (attributes) => ({ 'data-height': String(attributes.height) }),
      },
      valueDensity: {
        default: 0,
        parseHTML: (element) => {
          const v = element.getAttribute('data-value-density');
          return v ? parseInt(v, 10) : 0;
        },
        renderHTML: (attributes) => ({ 'data-value-density': String(attributes.valueDensity) }),
      },
      extentDensity: {
        default: 'dense',
        parseHTML: (element) => element.getAttribute('data-extent-density') || 'dense',
        renderHTML: (attributes) => ({ 'data-extent-density': attributes.extentDensity }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) => attributes.title ? { 'data-title': attributes.title } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-embed': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNode);
  },

  addCommands() {
    return {
      setEmbed: (type: EmbedType, attrs: Partial<EmbedAttributes> = {}) => ({ commands }) => {
        // Merge with default attributes for the type
        const defaults = DEFAULT_EMBED_ATTRIBUTES[type] || {};
        const mergedAttrs = {
          ...defaults,
          ...attrs,
          type,
        };

        return commands.insertContent({
          type: this.name,
          attrs: mergedAttrs,
        });
      },
    };
  },
});
