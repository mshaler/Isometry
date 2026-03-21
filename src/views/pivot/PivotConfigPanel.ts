// Isometry v5 — Phase 97 PivotConfigPanel
// Pointer-event DnD configuration panel for pivot table axis assignment.
//
// Design:
//   - 4-zone grid layout: Available / Rows / Columns / Z (future)
//   - Dimension chips are draggable via pointer events (no HTML5 DnD)
//   - Ghost element follows cursor during drag
//   - Drop zone highlighting on pointer hover via elementsFromPoint hit-testing
//   - Within-zone reorder: insertion line indicator at midpoint between chips
//   - Transpose button, hide-empty toggles
//
// Requirements: PIV-08..PIV-13, PIV-17

import type { HeaderDimension, DragPayload } from './PivotTypes';

// ---------------------------------------------------------------------------
// Config panel props
// ---------------------------------------------------------------------------

export interface PivotConfigPanelProps {
	rowDimensions: HeaderDimension[];
	colDimensions: HeaderDimension[];
	availableDimensions: HeaderDimension[];
	hideEmptyRows: boolean;
	hideEmptyCols: boolean;
	onDropToRow: (dimension: HeaderDimension, sourceZone: string, insertIndex?: number) => void;
	onDropToCol: (dimension: HeaderDimension, sourceZone: string, insertIndex?: number) => void;
	onDropToAvailable: (dimension: HeaderDimension, sourceZone: string) => void;
	onRemoveFromRow: (dimensionId: string) => void;
	onRemoveFromCol: (dimensionId: string) => void;
	onTranspose: () => void;
	onToggleHideEmptyRows: () => void;
	onToggleHideEmptyCols: () => void;
}

// ---------------------------------------------------------------------------
// PivotConfigPanel
// ---------------------------------------------------------------------------

export class PivotConfigPanel {
	private _rootEl: HTMLDivElement | null = null;
	private _props: PivotConfigPanelProps | null = null;

	// DnD state
	private _dragPayload: DragPayload | null = null;
	private _ghostEl: HTMLDivElement | null = null;
	private _lastHighlightedZone: HTMLElement | null = null;
	private _insertionLine: HTMLDivElement | null = null;
	private _lastInsertIndex = -1;
	private _lastInsertZone: string | null = null;

	// Bound listeners
	private _boundPointerMove: ((e: PointerEvent) => void) | null = null;
	private _boundPointerUp: ((e: PointerEvent) => void) | null = null;

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'pv-config-panel';
		container.appendChild(this._rootEl);
	}

	destroy(): void {
		this._cleanupDrag();
		this._rootEl?.remove();
		this._rootEl = null;
		this._props = null;
	}

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	render(props: PivotConfigPanelProps): void {
		this._props = props;
		if (!this._rootEl) return;

		// Clear and rebuild
		this._rootEl.innerHTML = '';

		// Grid container
		const grid = document.createElement('div');
		grid.className = 'pv-config-grid';

		// Zone: Available
		grid.appendChild(
			this._createZone('available', 'Available', props.availableDimensions, 'available'),
		);

		// Zone: Rows
		grid.appendChild(this._createZone('row', 'Rows', props.rowDimensions, 'row'));

		// Zone: Columns
		grid.appendChild(this._createZone('column', 'Columns', props.colDimensions, 'column'));

		// Zone: Z (future)
		const zZone = document.createElement('div');
		zZone.className = 'pv-zone-wrapper';
		const zLabel = document.createElement('label');
		zLabel.className = 'pv-zone-label';
		zLabel.textContent = 'Z';
		zZone.appendChild(zLabel);
		const zDrop = document.createElement('div');
		zDrop.className = 'pv-drop-zone pv-drop-zone--disabled';
		zDrop.dataset.zone = 'z';
		const zPlaceholder = document.createElement('div');
		zPlaceholder.className = 'pv-zone-placeholder';
		zPlaceholder.textContent = 'Future feature';
		zDrop.appendChild(zPlaceholder);
		zZone.appendChild(zDrop);
		grid.appendChild(zZone);

		this._rootEl.appendChild(grid);

		// Controls row
		const controls = document.createElement('div');
		controls.className = 'pv-controls';

		// Transpose button
		const transposeBtn = document.createElement('button');
		transposeBtn.className = 'pv-btn pv-btn--outline';
		transposeBtn.dataset.action = 'transpose';
		transposeBtn.innerHTML = '⇄ Transpose';
		transposeBtn.addEventListener('click', () => props.onTranspose());
		controls.appendChild(transposeBtn);

		// Hide empty rows toggle
		const hideRowsBtn = document.createElement('button');
		hideRowsBtn.className = `pv-btn ${props.hideEmptyRows ? 'pv-btn--active' : 'pv-btn--outline'}`;
		hideRowsBtn.dataset.action = 'toggle-hide-rows';
		hideRowsBtn.textContent = props.hideEmptyRows ? 'Show Empty Rows' : 'Hide Empty Rows';
		hideRowsBtn.addEventListener('click', () => props.onToggleHideEmptyRows());
		controls.appendChild(hideRowsBtn);

		// Hide empty cols toggle
		const hideColsBtn = document.createElement('button');
		hideColsBtn.className = `pv-btn ${props.hideEmptyCols ? 'pv-btn--active' : 'pv-btn--outline'}`;
		hideColsBtn.dataset.action = 'toggle-hide-cols';
		hideColsBtn.textContent = props.hideEmptyCols ? 'Show Empty Columns' : 'Hide Empty Columns';
		hideColsBtn.addEventListener('click', () => props.onToggleHideEmptyCols());
		controls.appendChild(hideColsBtn);

		this._rootEl.appendChild(controls);
	}

	// -----------------------------------------------------------------------
	// Zone builder
	// -----------------------------------------------------------------------

	private _createZone(
		zoneId: string,
		label: string,
		dimensions: HeaderDimension[],
		sourceZone: DragPayload['sourceZone'],
	): HTMLDivElement {
		const wrapper = document.createElement('div');
		wrapper.className = 'pv-zone-wrapper';

		const labelEl = document.createElement('label');
		labelEl.className = 'pv-zone-label';
		labelEl.textContent = label;
		wrapper.appendChild(labelEl);

		const dropZone = document.createElement('div');
		dropZone.className = 'pv-drop-zone';
		dropZone.dataset.zone = zoneId;

		const chipContainer = document.createElement('div');
		chipContainer.className = 'pv-chip-container';

		if (dimensions.length === 0) {
			const placeholder = document.createElement('div');
			placeholder.className = 'pv-zone-placeholder';
			placeholder.textContent =
				zoneId === 'available' ? 'Drop here to remove' : 'Drop dimensions here';
			chipContainer.appendChild(placeholder);
		} else {
			for (const dim of dimensions) {
				chipContainer.appendChild(this._createChip(dim, sourceZone, zoneId));
			}
		}

		dropZone.appendChild(chipContainer);
		wrapper.appendChild(dropZone);
		return wrapper;
	}

	// -----------------------------------------------------------------------
	// Chip builder
	// -----------------------------------------------------------------------

	private _createChip(
		dimension: HeaderDimension,
		sourceZone: DragPayload['sourceZone'],
		parentZoneId: string,
	): HTMLDivElement {
		const chip = document.createElement('div');
		chip.className = 'pv-chip';
		chip.dataset.dimensionId = dimension.id;

		// Grip icon
		const grip = document.createElement('span');
		grip.className = 'pv-chip-grip';
		grip.textContent = '⠿';
		chip.appendChild(grip);

		// Label
		const label = document.createElement('span');
		label.className = 'pv-chip-label';
		label.textContent = dimension.name;
		chip.appendChild(label);

		// Remove button (only in row/col zones, not available)
		if (parentZoneId === 'row' || parentZoneId === 'column') {
			const removeBtn = document.createElement('button');
			removeBtn.className = 'pv-chip-remove';
			removeBtn.textContent = '×';
			removeBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (parentZoneId === 'row') {
					this._props?.onRemoveFromRow(dimension.id);
				} else {
					this._props?.onRemoveFromCol(dimension.id);
				}
			});
			chip.appendChild(removeBtn);
		}

		// Pointer-event DnD: pointerdown starts drag
		chip.addEventListener('pointerdown', (e: PointerEvent) => {
			if ((e.target as HTMLElement).closest('.pv-chip-remove')) return;
			e.preventDefault();
			this._startDrag(dimension, sourceZone, e);
		});

		return chip;
	}

	// -----------------------------------------------------------------------
	// Pointer-event DnD
	// -----------------------------------------------------------------------

	private _startDrag(
		dimension: HeaderDimension,
		sourceZone: DragPayload['sourceZone'],
		e: PointerEvent,
	): void {
		this._dragPayload = { dimension, sourceZone };
		this._lastInsertIndex = -1;
		this._lastInsertZone = null;

		// Create ghost element
		this._ghostEl = document.createElement('div');
		this._ghostEl.className = 'pv-chip pv-chip--ghost';
		this._ghostEl.textContent = dimension.name;
		this._ghostEl.style.left = `${e.clientX + 8}px`;
		this._ghostEl.style.top = `${e.clientY + 8}px`;
		document.body.appendChild(this._ghostEl);

		// Create insertion line (hidden until needed)
		this._insertionLine = document.createElement('div');
		this._insertionLine.className = 'pv-insertion-line';
		document.body.appendChild(this._insertionLine);

		// Dim the source chip
		const sourceChip = this._rootEl?.querySelector(
			`.pv-chip[data-dimension-id="${dimension.id}"]`,
		) as HTMLElement | null;
		if (sourceChip) sourceChip.classList.add('pv-chip--dragging');

		// Set cursor
		document.body.style.cursor = 'grabbing';

		// Register document-level listeners
		this._boundPointerMove = this._handlePointerMove.bind(this);
		this._boundPointerUp = this._handlePointerUp.bind(this);
		document.addEventListener('pointermove', this._boundPointerMove);
		document.addEventListener('pointerup', this._boundPointerUp);
	}

	private _handlePointerMove(e: PointerEvent): void {
		// Move ghost
		if (this._ghostEl) {
			this._ghostEl.style.left = `${e.clientX + 8}px`;
			this._ghostEl.style.top = `${e.clientY + 8}px`;
		}

		// Hit-test drop zones
		const elements = document.elementsFromPoint(e.clientX, e.clientY);
		const dropZone = elements.find((el) =>
			el.classList.contains('pv-drop-zone'),
		) as HTMLElement | undefined;

		// Clear previous highlight
		if (this._lastHighlightedZone && this._lastHighlightedZone !== dropZone) {
			this._lastHighlightedZone.classList.remove('pv-drop-zone--hover');
		}

		// Hide insertion line by default
		if (this._insertionLine) {
			this._insertionLine.style.display = 'none';
		}
		this._lastInsertIndex = -1;
		this._lastInsertZone = null;

		if (dropZone && !dropZone.classList.contains('pv-drop-zone--disabled')) {
			dropZone.classList.add('pv-drop-zone--hover');
			this._lastHighlightedZone = dropZone;

			// Calculate insertion index for within-zone reorder
			const zoneId = dropZone.dataset.zone;
			if (zoneId === 'row' || zoneId === 'column') {
				this._updateInsertionLine(dropZone, e.clientY, zoneId);
			}
		} else {
			this._lastHighlightedZone = null;
		}
	}

	/**
	 * Calculate insertion position within a zone by comparing pointer Y
	 * to chip midpoints. Show insertion line between chips at that position.
	 */
	private _updateInsertionLine(
		dropZone: HTMLElement,
		pointerY: number,
		zoneId: string,
	): void {
		const chips = dropZone.querySelectorAll<HTMLElement>('.pv-chip');
		if (chips.length === 0) {
			this._lastInsertIndex = 0;
			this._lastInsertZone = zoneId;
			return;
		}

		let insertIndex = chips.length; // Default: append to end
		for (let i = 0; i < chips.length; i++) {
			const rect = chips[i].getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			if (pointerY < midY) {
				insertIndex = i;
				break;
			}
		}

		this._lastInsertIndex = insertIndex;
		this._lastInsertZone = zoneId;

		// Position insertion line
		if (this._insertionLine) {
			const zoneRect = dropZone.getBoundingClientRect();
			let lineY: number;

			if (insertIndex === 0) {
				const firstRect = chips[0].getBoundingClientRect();
				lineY = firstRect.top - 3;
			} else if (insertIndex >= chips.length) {
				const lastRect = chips[chips.length - 1].getBoundingClientRect();
				lineY = lastRect.bottom + 3;
			} else {
				const prevRect = chips[insertIndex - 1].getBoundingClientRect();
				const nextRect = chips[insertIndex].getBoundingClientRect();
				lineY = (prevRect.bottom + nextRect.top) / 2;
			}

			this._insertionLine.style.display = 'block';
			this._insertionLine.style.left = `${zoneRect.left + 8}px`;
			this._insertionLine.style.top = `${lineY}px`;
			this._insertionLine.style.width = `${zoneRect.width - 16}px`;
		}
	}

	private _handlePointerUp(e: PointerEvent): void {
		if (!this._dragPayload) {
			this._cleanupDrag();
			return;
		}

		// Hit-test final drop target
		const elements = document.elementsFromPoint(e.clientX, e.clientY);
		const dropZone = elements.find((el) => el.classList.contains('pv-drop-zone'));

		if (dropZone && !dropZone.classList.contains('pv-drop-zone--disabled')) {
			const targetZone = (dropZone as HTMLElement).dataset.zone;
			const { dimension, sourceZone } = this._dragPayload;

			if (targetZone === 'row') {
				this._props?.onDropToRow(
					dimension,
					sourceZone,
					this._lastInsertZone === 'row' ? this._lastInsertIndex : undefined,
				);
			} else if (targetZone === 'column') {
				this._props?.onDropToCol(
					dimension,
					sourceZone,
					this._lastInsertZone === 'column' ? this._lastInsertIndex : undefined,
				);
			} else if (targetZone === 'available') {
				this._props?.onDropToAvailable(dimension, sourceZone);
			}
		}

		this._cleanupDrag();
	}

	private _cleanupDrag(): void {
		// Remove ghost
		this._ghostEl?.remove();
		this._ghostEl = null;

		// Remove insertion line
		this._insertionLine?.remove();
		this._insertionLine = null;

		// Restore source chip
		if (this._dragPayload && this._rootEl) {
			const sourceChip = this._rootEl.querySelector(
				`.pv-chip[data-dimension-id="${this._dragPayload.dimension.id}"]`,
			) as HTMLElement | null;
			if (sourceChip) sourceChip.classList.remove('pv-chip--dragging');
		}

		// Clear highlight
		this._lastHighlightedZone?.classList.remove('pv-drop-zone--hover');
		this._lastHighlightedZone = null;

		// Reset
		document.body.style.cursor = '';
		this._lastInsertIndex = -1;
		this._lastInsertZone = null;

		// Remove document listeners
		if (this._boundPointerMove) {
			document.removeEventListener('pointermove', this._boundPointerMove);
			this._boundPointerMove = null;
		}
		if (this._boundPointerUp) {
			document.removeEventListener('pointerup', this._boundPointerUp);
			this._boundPointerUp = null;
		}

		this._dragPayload = null;
	}
}
