// Isometry v5 — Phase 102 Plan 03 SuperSelectKeyboard Plugin
// Shift+arrow range extension from anchor in SelectionState.
//
// Design:
//   - onPointerEvent type='keydown': handles Shift+Arrow keys
//   - Reads anchor from shared SelectionState
//   - Computes new position: anchor + direction delta
//   - Adds new key to selectedKeys, updates anchor
//   - preventDefault to prevent page scroll during keyboard navigation
//   - destroy: no-op (state owned by click plugin)
//
// Key format: "${rowIdx}:${colIdx}" — matches format used by click plugin.
//
// Requirements: SLCT-03

import type { PluginHook, RenderContext } from './PluginTypes';
import type { SelectionState } from './SuperSelectClick';

// ---------------------------------------------------------------------------
// Arrow key deltas
// ---------------------------------------------------------------------------

const ARROW_DELTAS: Record<string, { dr: number; dc: number }> = {
	ArrowUp: { dr: -1, dc: 0 },
	ArrowDown: { dr: 1, dc: 0 },
	ArrowLeft: { dr: 0, dc: -1 },
	ArrowRight: { dr: 0, dc: 1 },
};

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superselect.keyboard plugin.
 *
 * @param selectionState - Shared SelectionState (same instance as click + lasso plugins).
 * @param onSelectionChange - Callback invoked when selection changes.
 */
export function createSuperSelectKeyboardPlugin(
	selectionState: SelectionState,
	onSelectionChange: () => void,
): PluginHook {
	return {
		/**
		 * Handle keydown events with Shift+Arrow for range extension.
		 * PluginRegistry dispatches keyboard events through onPointerEvent with type 'keydown'.
		 */
		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			if (type !== 'keydown') return false;

			// Cast to KeyboardEvent to access key and shiftKey
			const ke = e as unknown as KeyboardEvent;

			if (!ke.shiftKey) return false;

			const delta = ARROW_DELTAS[ke.key];
			if (!delta) return false;

			if (!selectionState.anchor) return false;

			const newRowIdx = selectionState.anchor.rowIdx + delta.dr;
			const newColIdx = selectionState.anchor.colIdx + delta.dc;
			const newKey = `${newRowIdx}:${newColIdx}`;

			selectionState.selectedKeys.add(newKey);
			selectionState.anchor = { rowIdx: newRowIdx, colIdx: newColIdx };

			ke.preventDefault();
			onSelectionChange();
			return true;
		},

		/**
		 * No-op: selection state is owned and cleared by the click plugin.
		 */
		destroy(): void {
			// Intentionally empty — state lifecycle managed by createSuperSelectClickPlugin
		},
	};
}
