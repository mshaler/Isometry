// Isometry v5 — Phase 50 Accessibility Module Barrel Export
// Public API for accessibility utilities.

export { Announcer } from './Announcer';
export { COMBOBOX_ATTRS } from './combobox-contract';
export { contrastRatio, linearize, parseHex, relativeLuminance } from './contrast';
export { MotionProvider } from './MotionProvider';

// Module-level singleton — imported by transitions.ts and main.ts
import { MotionProvider } from './MotionProvider';
export const motionProvider = new MotionProvider();
