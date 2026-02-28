// Isometry v5 — Phase 4 Plan 07
// Keyboard shortcut registration for MutationManager undo/redo.
//
// Requirements: MUT-07
//
// Design:
//   - Cmd+Z (Mac) / Ctrl+Z (non-Mac) → undo()
//   - Cmd+Shift+Z (Mac) / Ctrl+Shift+Z or Ctrl+Y (non-Mac) → redo()
//   - Returns a cleanup function that removes the keydown listener
//   - Skips shortcuts when focus is in INPUT, TEXTAREA, or contentEditable elements

import type { MutationManager } from './MutationManager';

/**
 * Register keyboard shortcuts for undo/redo on the given MutationManager.
 *
 * Platform detection:
 *   - Mac: uses metaKey (Cmd key) for undo/redo
 *   - Non-Mac: uses ctrlKey (Ctrl key) for undo/redo
 *
 * Shortcuts:
 *   - Cmd+Z / Ctrl+Z → manager.undo()
 *   - Cmd+Shift+Z / Ctrl+Shift+Z → manager.redo()
 *   - Ctrl+Y (non-Mac only) → manager.redo()
 *
 * Input field guard:
 *   - Does NOT intercept shortcuts when typing in INPUT, TEXTAREA,
 *     or contentEditable elements — those have their own undo behavior.
 *
 * @param manager - The MutationManager to connect shortcuts to
 * @returns A cleanup function — call it to remove the keydown listener
 *
 * @example
 * const cleanup = setupMutationShortcuts(manager);
 * // Later, to remove:
 * cleanup();
 */
export function setupMutationShortcuts(manager: MutationManager): () => void {
  const isMac =
    typeof navigator !== 'undefined' &&
    typeof navigator.platform === 'string' &&
    navigator.platform.includes('Mac');

  function handleKeyDown(event: KeyboardEvent): void {
    // Guard: do not intercept when typing in form fields
    const target = event.target as HTMLElement | null;
    if (target !== null) {
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
    }

    // Check the platform-appropriate modifier key
    const modifier = isMac ? event.metaKey : event.ctrlKey;
    if (!modifier) return;

    if (event.key === 'z' && !event.shiftKey) {
      // Undo: Cmd+Z (Mac) or Ctrl+Z (non-Mac)
      event.preventDefault();
      void manager.undo();
    } else if (event.key === 'z' && event.shiftKey) {
      // Redo: Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (non-Mac)
      event.preventDefault();
      void manager.redo();
    } else if (!isMac && event.key === 'y') {
      // Redo: Ctrl+Y (non-Mac only)
      event.preventDefault();
      void manager.redo();
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}
