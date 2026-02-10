/**
 * SuperDensityRenderer - Re-export from modular implementation
 *
 * This file now delegates to the modular SuperDensityRenderer implementation
 * in the SuperDensityRenderer/ directory for better maintainability.
 */

// Re-export everything from the modular implementation
export * from './SuperDensityRenderer';
export { SuperDensityRenderer as default } from './SuperDensityRenderer';