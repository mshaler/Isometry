/**
 * CardBoard Component System
 * Main exports
 */

// ============================================
// Types
// ============================================

export * from './types';

// ============================================
// Factory Utilities
// ============================================

export {
  createAccessor,
  createAccessors,
  generateInstanceId,
  resetInstanceCounter,
  transitions,
  enterTransition,
  exitTransition,
  scaleTransition,
  namedTransition,
  createDispatcher,
  cx,
  parseClasses,
  mergeClasses,
  getElementDimensions,
  isElementInViewport,
  debounce,
  throttle,
  keyById,
  keyByProps,
  icons,
  getIconSvg,
  getSpinnerSvg,
} from './factory';

export type { TransitionPreset, IconName } from './factory';

// ============================================
// Primitives
// ============================================

export { cbCard } from './primitives/cb-card';
export type { CbCard, CardProps, CardEvents } from './primitives/cb-card';

// Placeholder exports for future components
// export { cbBadge } from './primitives/cb-badge';
// export { cbAvatar } from './primitives/cb-avatar';
// export { cbIcon } from './primitives/cb-icon';

// ============================================
// Controls
// ============================================

export { cbButton } from './controls/cb-button';
export type { CbButton, ButtonProps, ButtonData } from './controls/cb-button';

// Placeholder exports for future components
// export { cbInput } from './controls/cb-input';
// export { cbSelect } from './controls/cb-select';
// export { cbToggle } from './controls/cb-toggle';
// export { cbSlider } from './controls/cb-slider';

// ============================================
// Containers
// ============================================

export { cbCanvas } from './containers/cb-canvas';
export type { CbCanvas, CanvasProps } from './containers/cb-canvas';

// Placeholder exports for future components
// export { cbWindow } from './containers/cb-window';
// export { cbPanel } from './containers/cb-panel';
// export { cbToolbar } from './containers/cb-toolbar';

// ============================================
// Overlays (Future)
// ============================================

// export { cbModal } from './overlays/cb-modal';
// export { cbTooltip } from './overlays/cb-tooltip';
// export { cbPopover } from './overlays/cb-popover';
// export { cbContextMenu } from './overlays/cb-contextmenu';

// ============================================
// Views (Future)
// ============================================

// export { cbGrid } from './views/cb-grid';
// export { cbKanban } from './views/cb-kanban';
// export { cbTimeline } from './views/cb-timeline';
// export { cbNetwork } from './views/cb-network';
