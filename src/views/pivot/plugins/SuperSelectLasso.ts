// Isometry v5 — Phase 102 Plan 03 SuperSelectLasso Plugin
// Drag-to-select rectangular region with CSS div overlay.
//
// Design:
//   - Internal state: _dragging flag, _startX/Y, _overlay div element
//   - pointerdown: start drag, record start position
//   - pointermove: if dragging and distance > 5px threshold, create/resize .pv-lasso-overlay
//   - pointerup: compute intersecting cells, update SelectionState, remove overlay
//   - afterRender: ensure grid container has position: relative for absolute overlay positioning
//   - destroy: remove overlay if present, reset drag state
//
// Requirements: SLCT-02

import type { PluginHook, RenderContext } from './PluginTypes';
import type { SelectionState } from './SuperSelectClick';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superselect.lasso plugin.
 *
 * @param selectionState - Shared SelectionState (same instance as click plugin).
 * @param onSelectionChange - Callback invoked when selection changes after lasso completes.
 */
export function createSuperSelectLassoPlugin(
	selectionState: SelectionState,
	onSelectionChange: () => void,
): PluginHook {
	let _dragging = false;
	let _startX = 0;
	let _startY = 0;
	let _overlay: HTMLDivElement | null = null;
	let _container: HTMLElement | null = null;

	function removeOverlay(): void {
		if (_overlay?.parentElement) {
			_overlay.parentElement.removeChild(_overlay);
		}
		_overlay = null;
	}

	function createOrUpdateOverlay(container: HTMLElement, x1: number, y1: number, x2: number, y2: number): void {
		if (!_overlay) {
			_overlay = document.createElement('div');
			_overlay.className = 'pv-lasso-overlay';
			container.appendChild(_overlay);
		}

		const left = Math.min(x1, x2);
		const top = Math.min(y1, y2);
		const width = Math.abs(x2 - x1);
		const height = Math.abs(y2 - y1);

		_overlay.style.left = `${left}px`;
		_overlay.style.top = `${top}px`;
		_overlay.style.width = `${width}px`;
		_overlay.style.height = `${height}px`;
	}

	function getRelativeCoords(container: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
		const rect = container.getBoundingClientRect();
		return {
			x: clientX - rect.left,
			y: clientY - rect.top,
		};
	}

	return {
		/**
		 * Handle pointer events for lasso drag-to-select behavior.
		 */
		onPointerEvent(type: string, e: PointerEvent, ctx: RenderContext): boolean {
			if (type === 'pointerdown') {
				_dragging = true;
				_startX = e.clientX;
				_startY = e.clientY;
				_container = ctx.rootEl;
				return false; // Let click plugin handle single clicks
			}

			if (type === 'pointermove' && _dragging && _container) {
				const dx = e.clientX - _startX;
				const dy = e.clientY - _startY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist > 5) {
					const start = getRelativeCoords(_container, _startX, _startY);
					const current = getRelativeCoords(_container, e.clientX, e.clientY);
					createOrUpdateOverlay(_container, start.x, start.y, current.x, current.y);
					return true;
				}
				return false;
			}

			if (type === 'pointerup' && _dragging) {
				_dragging = false;

				if (_overlay && _container) {
					// Compute intersecting cells
					const lassoRect = _overlay.getBoundingClientRect();

					const cells = _container.querySelectorAll<HTMLElement>('.pv-data-cell');
					const intersectingKeys: string[] = [];

					for (const cell of cells) {
						const cellRect = cell.getBoundingClientRect();
						const overlaps =
							cellRect.left < lassoRect.right &&
							cellRect.right > lassoRect.left &&
							cellRect.top < lassoRect.bottom &&
							cellRect.bottom > lassoRect.top;

						if (overlaps) {
							const key = cell.getAttribute('data-key');
							if (key) intersectingKeys.push(key);
						}
					}

					// Update selection
					if (!e.metaKey) {
						selectionState.selectedKeys.clear();
					}
					for (const key of intersectingKeys) {
						selectionState.selectedKeys.add(key);
					}

					removeOverlay();
					onSelectionChange();
					return true;
				}

				removeOverlay();
				_container = null;
				return false;
			}

			return false;
		},

		/**
		 * Ensure grid container has position: relative for absolute overlay positioning.
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const style = root.style.position;
			if (!style || style === 'static') {
				root.style.position = 'relative';
			}
		},

		/**
		 * Remove overlay and reset drag state on plugin disable/destroy.
		 */
		destroy(): void {
			removeOverlay();
			_dragging = false;
			_container = null;
		},
	};
}
