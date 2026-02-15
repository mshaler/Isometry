/**
 * Callout types for the CalloutExtension
 * Extracted to a separate file to avoid circular dependencies
 * between CalloutExtension.ts and CalloutNode.tsx
 */

export type CalloutType = 'info' | 'warning' | 'tip' | 'error';

export interface CalloutAttributes {
  type: CalloutType;
}
