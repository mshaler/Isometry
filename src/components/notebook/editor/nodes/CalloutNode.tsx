import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';
import type { CalloutType } from '../extensions/callout-types';

const CALLOUT_CONFIG: Record<CalloutType, { icon: string; label: string }> = {
  info: { icon: '\u{1F4A1}', label: 'Info' },
  warning: { icon: '\u{26A0}\u{FE0F}', label: 'Warning' },
  tip: { icon: '\u{2728}', label: 'Tip' },
  error: { icon: '\u{274C}', label: 'Error' },
};

export function CalloutNode({ node, updateAttributes }: NodeViewProps) {
  const type = (node.attrs.type as CalloutType) || 'info';
  const config = CALLOUT_CONFIG[type] || CALLOUT_CONFIG.info;

  return (
    <NodeViewWrapper className={`callout callout--${type}`}>
      <div className="callout__header">
        <span className="callout__icon">{config.icon}</span>
        <select
          className="callout__type-selector"
          value={type}
          onChange={(e) => updateAttributes({ type: e.target.value as CalloutType })}
          contentEditable={false}
        >
          {Object.entries(CALLOUT_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <NodeViewContent className="callout__content" />
    </NodeViewWrapper>
  );
}
