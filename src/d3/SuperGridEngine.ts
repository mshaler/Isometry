/**
 * SuperGridEngine - Re-export from modular implementation
 *
 * This file now delegates to the modular SuperGridEngine implementation
 * in the SuperGridEngine/ directory for better maintainability.
 */

// Re-export everything from the modular implementation
export * from './SuperGridEngine/index';
export { SuperGridEngine as default } from './SuperGridEngine/index';