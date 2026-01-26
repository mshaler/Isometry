import { UnifiedApp } from './components/UnifiedApp';

/**
 * Unified App Demo
 *
 * This combines our working MVP data visualization with the complete
 * Figma-designed UI for a full-featured interface.
 *
 * This demonstrates Phase 2 of the GSD UI/UX unification:
 * - All 9 Figma components integrated
 * - Preserves MVP Canvas data visualization
 * - Full context provider hierarchy
 * - Theme system working across all components
 */
function UnifiedDemo() {
  return <UnifiedApp />;
}

export default UnifiedDemo;