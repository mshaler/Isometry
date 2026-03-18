// Isometry v5 — Phase 88 Plan 02
// DataExplorerPanel: four-section explorer panel for data import/export, catalog, apps, and DB utilities.
//
// Requirements: DEXP-01, DEXP-04, DEXP-05, DEXP-06
//
// Design:
//   - mount/destroy lifecycle matching existing explorer panels (PropertiesExplorer, etc.)
//   - 4 CollapsibleSection instances: Import/Export, Catalog, Apps, DB Utilities
//   - Catalog section body is a mount point for SuperGrid (Plan 03 mounts real SuperGrid)
//   - Apps section is a stub with "Coming soon"
//   - HTML5 drag-and-drop on Import zone (no library dependency)
//   - DB Utilities shows stats (card_count, connection_count, db_size_bytes) and action buttons

import { CollapsibleSection } from './CollapsibleSection';
import type { CollapsibleSectionConfig } from './CollapsibleSection';
import '../styles/data-explorer.css';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DataExplorerPanelConfig {
	onImportFile: () => void;
	onExport: (format: 'csv' | 'json' | 'markdown') => void;
	onExportDatabase: () => void;
	onVacuum: () => Promise<void>;
	onFileDrop: (file: File) => void;
	onSelectCard: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const DEXP_SECTIONS: CollapsibleSectionConfig[] = [
	{ title: 'Import / Export', icon: '\uD83D\uDCC2', storageKey: 'dexp-import', defaultCollapsed: false },
	{ title: 'Catalog', icon: '\uD83D\uDDC3', storageKey: 'dexp-catalog', defaultCollapsed: false },
	{ title: 'Apps', icon: '\uD83D\uDD0C', storageKey: 'dexp-apps', defaultCollapsed: true },
	{ title: 'DB Utilities', icon: '\uD83D\uDEE0', storageKey: 'dexp-db-utils', defaultCollapsed: true },
];

// ---------------------------------------------------------------------------
// DataExplorerPanel
// ---------------------------------------------------------------------------

/**
 * DataExplorerPanel is the top-level UI shell for the Data Explorer sidebar.
 * It contains 4 CollapsibleSection panels:
 *   - Import/Export: import button, drag-drop zone, 3 export format buttons
 *   - Catalog: mount point for SuperGrid (Plan 03 mounts the real SuperGrid)
 *   - Apps: stub with "Coming soon"
 *   - DB Utilities: stat rows + vacuum + export DB buttons
 *
 * mount(container) creates the DOM structure.
 * destroy() removes DOM and cleans up event listeners.
 * getCatalogBodyEl() returns the Catalog section body for SuperGrid mounting.
 * updateStats(stats) updates the DB Utilities stat rows.
 * expandSection(key) programmatically expands a named section.
 */
export class DataExplorerPanel {
	private _config: DataExplorerPanelConfig;
	private _rootEl: HTMLElement | null = null;
	private _sections: CollapsibleSection[] = [];
	private _catalogBodyEl: HTMLElement | null = null;
	private _statsEls: { cards: HTMLElement; connections: HTMLElement; size: HTMLElement } | null = null;
	private _vacuumBtn: HTMLButtonElement | null = null;
	private _recentCardsListEl: HTMLElement | null = null;
	private _dropZone: HTMLElement | null = null;
	private _dropZoneLabel: HTMLElement | null = null;
	private _dragHandlers: {
		enter: (e: DragEvent) => void;
		over: (e: DragEvent) => void;
		leave: (e: DragEvent) => void;
		drop: (e: DragEvent) => void;
	} | null = null;

	constructor(config: DataExplorerPanelConfig) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		// Root element
		const root = document.createElement('div');
		root.className = 'data-explorer';
		this._rootEl = root;

		// Create 4 CollapsibleSection instances and mount into root
		const sections: CollapsibleSection[] = [];
		for (const sectionConfig of DEXP_SECTIONS) {
			const section = new CollapsibleSection(sectionConfig);
			section.mount(root);
			sections.push(section);
		}
		this._sections = sections;

		// Build section content — sections array always has exactly 4 entries (matches DEXP_SECTIONS length)
		// biome-ignore lint/style/noNonNullAssertion: DEXP_SECTIONS has exactly 4 entries
		this._buildImportExportSection(sections[0]!);
		// biome-ignore lint/style/noNonNullAssertion: DEXP_SECTIONS has exactly 4 entries
		this._buildCatalogSection(sections[1]!);
		// biome-ignore lint/style/noNonNullAssertion: DEXP_SECTIONS has exactly 4 entries
		this._buildAppsSection(sections[2]!);
		// biome-ignore lint/style/noNonNullAssertion: DEXP_SECTIONS has exactly 4 entries
		this._buildDbUtilitiesSection(sections[3]!);

		container.appendChild(root);
	}

	/**
	 * Returns the Catalog section body element for SuperGrid mounting.
	 * Plan 03 calls this to mount the real SuperGrid.
	 */
	getCatalogBodyEl(): HTMLElement | null {
		return this._catalogBodyEl;
	}

	/**
	 * Update the DB Utilities stat rows with live database metrics.
	 */
	updateStats(stats: { card_count: number; connection_count: number; db_size_bytes: number }): void {
		if (!this._statsEls) return;
		this._statsEls.cards.textContent = String(stats.card_count);
		this._statsEls.connections.textContent = String(stats.connection_count);
		const kb = Math.round(stats.db_size_bytes / 1024);
		this._statsEls.size.textContent = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
	}

	/**
	 * Update the Recent Cards list in DB Utilities with the 8 most recently created cards.
	 * Called from refreshDataExplorer() after datasets:recent-cards bridge response.
	 */
	updateRecentCards(cards: Array<{ id: string; name: string; source: string; created_at: string }>): void {
		if (!this._recentCardsListEl) return;
		this._recentCardsListEl.innerHTML = '';
		if (cards.length === 0) {
			const empty = document.createElement('li');
			empty.className = 'dexp-recent-card-empty';
			empty.textContent = 'No cards yet';
			this._recentCardsListEl.appendChild(empty);
			return;
		}
		for (const card of cards) {
			const li = document.createElement('li');
			li.className = 'dexp-recent-card-row';
			li.setAttribute('role', 'button');
			li.setAttribute('aria-label', card.name);
			li.tabIndex = 0;

			const titleEl = document.createElement('div');
			titleEl.className = 'dexp-recent-card-title';
			titleEl.textContent = card.name;

			const metaEl = document.createElement('div');
			metaEl.className = 'dexp-recent-card-meta';
			const date = new Date(card.created_at);
			const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
			metaEl.textContent = `${card.source} \u00b7 ${dateStr}`;

			li.appendChild(titleEl);
			li.appendChild(metaEl);

			li.addEventListener('click', () => this._config.onSelectCard(card.id));
			li.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this._config.onSelectCard(card.id);
				}
			});

			this._recentCardsListEl.appendChild(li);
		}
	}

	/**
	 * Programmatically expand the section matching the given key suffix.
	 * e.g. key='catalog' matches storageKey 'dexp-catalog'.
	 */
	expandSection(key: string): void {
		for (const section of this._sections) {
			// Access via the DOM to find storageKey — check data-section attribute
			const el = section.getElement();
			const sectionKey = el?.getAttribute('data-section') ?? '';
			if (sectionKey === `dexp-${key}`) {
				section.setCollapsed(false);
			}
		}
	}

	/**
	 * Remove DOM element and clean up event listeners.
	 */
	destroy(): void {
		// Remove drag event listeners
		if (this._dropZone && this._dragHandlers) {
			this._dropZone.removeEventListener('dragenter', this._dragHandlers.enter);
			this._dropZone.removeEventListener('dragover', this._dragHandlers.over);
			this._dropZone.removeEventListener('dragleave', this._dragHandlers.leave);
			this._dropZone.removeEventListener('drop', this._dragHandlers.drop);
		}
		this._dragHandlers = null;
		this._dropZone = null;
		this._dropZoneLabel = null;

		// Destroy all sections
		for (const section of this._sections) {
			section.destroy();
		}
		this._sections = [];

		// Remove root element
		if (this._rootEl) {
			this._rootEl.remove();
			this._rootEl = null;
		}

		// Null all references
		this._catalogBodyEl = null;
		this._statsEls = null;
		this._vacuumBtn = null;
		this._recentCardsListEl = null;
	}

	// ---------------------------------------------------------------------------
	// Private — section builders
	// ---------------------------------------------------------------------------

	/**
	 * Build the Import / Export section content.
	 * - Import File CTA button
	 * - Drag-and-drop zone with HTML5 drag events
	 * - 3 ghost-style export buttons (CSV, JSON, Markdown)
	 */
	private _buildImportExportSection(section: CollapsibleSection): void {
		const body = section.getBodyEl();
		if (!body) return;

		// Wrapper div for import/export controls
		const wrapper = document.createElement('div');
		wrapper.className = 'data-explorer-import';

		// Import File button (primary CTA)
		const importBtn = document.createElement('button');
		importBtn.type = 'button';
		importBtn.className = 'dexp-import-btn';
		importBtn.textContent = 'Import File';
		importBtn.addEventListener('click', () => this._config.onImportFile());
		wrapper.appendChild(importBtn);

		// Drag-and-drop zone
		const dropZone = document.createElement('div');
		dropZone.className = 'dexp-drop-zone';
		dropZone.setAttribute('role', 'region');
		dropZone.setAttribute('aria-label', 'Drop file to import');
		dropZone.setAttribute('aria-live', 'polite');

		const dropLabel = document.createElement('span');
		dropLabel.textContent = 'Drop a file here to import';
		dropZone.appendChild(dropLabel);

		this._dropZone = dropZone;
		this._dropZoneLabel = dropLabel;

		// Register HTML5 drag events
		const enterHandler = (e: DragEvent) => {
			e.preventDefault();
			dropZone.classList.add('dexp-drop-zone--active');
			dropLabel.textContent = 'Drop to import';
		};
		const overHandler = (e: DragEvent) => {
			e.preventDefault();
			dropZone.classList.add('dexp-drop-zone--active');
		};
		const leaveHandler = (e: DragEvent) => {
			e.preventDefault();
			dropZone.classList.remove('dexp-drop-zone--active');
			dropLabel.textContent = 'Drop a file here to import';
		};
		const dropHandler = (e: DragEvent) => {
			e.preventDefault();
			dropZone.classList.remove('dexp-drop-zone--active');
			dropLabel.textContent = 'Drop a file here to import';
			const file = e.dataTransfer?.files[0];
			if (file) {
				this._config.onFileDrop(file);
			}
		};

		dropZone.addEventListener('dragenter', enterHandler);
		dropZone.addEventListener('dragover', overHandler);
		dropZone.addEventListener('dragleave', leaveHandler);
		dropZone.addEventListener('drop', dropHandler);

		this._dragHandlers = {
			enter: enterHandler,
			over: overHandler,
			leave: leaveHandler,
			drop: dropHandler,
		};

		wrapper.appendChild(dropZone);

		// Export buttons row
		const exportRow = document.createElement('div');
		exportRow.className = 'dexp-export-row';

		const exportFormats: Array<{ label: string; format: 'csv' | 'json' | 'markdown' }> = [
			{ label: 'CSV', format: 'csv' },
			{ label: 'JSON', format: 'json' },
			{ label: 'Markdown', format: 'markdown' },
		];

		for (const { label, format } of exportFormats) {
			const exportBtn = document.createElement('button');
			exportBtn.type = 'button';
			exportBtn.className = 'dexp-export-btn';
			exportBtn.textContent = label;
			exportBtn.addEventListener('click', () => this._config.onExport(format));
			exportRow.appendChild(exportBtn);
		}

		wrapper.appendChild(exportRow);
		body.appendChild(wrapper);

		section.setState('ready');
	}

	/**
	 * Build the Catalog section — body is the mount point for SuperGrid.
	 * Plan 03 mounts the real SuperGrid into this body element.
	 * State is set to 'loading' until Plan 03 sets it to 'ready'.
	 */
	private _buildCatalogSection(section: CollapsibleSection): void {
		const body = section.getBodyEl();
		if (!body) return;

		// Add the catalog grid class for CSS :has() guard in workbench.css
		// This class signals to workbench.css to apply max-height: 2000px
		body.classList.add('data-explorer__catalog-grid');

		// Store reference for Plan 03 to mount SuperGrid into
		this._catalogBodyEl = body;

		// State remains 'loading' — Plan 03 sets to 'ready' after SuperGrid mounts
	}

	/**
	 * Build the Apps section — stub with "Coming soon".
	 * Reuses .collapsible-section__stub* classes from workbench.css.
	 */
	private _buildAppsSection(section: CollapsibleSection): void {
		const body = section.getBodyEl();
		if (!body) return;

		const stub = document.createElement('div');
		stub.className = 'collapsible-section__stub';

		const stubIcon = document.createElement('div');
		stubIcon.className = 'collapsible-section__stub-icon';
		stubIcon.textContent = '\uD83D\uDD0C'; // plug emoji

		const stubText = document.createElement('div');
		stubText.className = 'collapsible-section__stub-text';

		const stubHeading = document.createElement('h3');
		stubHeading.textContent = 'Apps';

		const stubBody = document.createElement('p');
		stubBody.textContent = 'Coming soon';

		stubText.appendChild(stubHeading);
		stubText.appendChild(stubBody);

		stub.appendChild(stubIcon);
		stub.appendChild(stubText);
		body.appendChild(stub);

		section.setState('ready');
	}

	/**
	 * Build the DB Utilities section content.
	 * - 3 stat rows: Cards, Connections, Database size
	 * - Vacuum / Optimize button (destructive)
	 * - Export Database button (ghost)
	 */
	private _buildDbUtilitiesSection(section: CollapsibleSection): void {
		const body = section.getBodyEl();
		if (!body) return;

		// Stats container
		const statsContainer = document.createElement('div');
		statsContainer.className = 'dexp-db-stats';

		// Helper to create a stat row with label and value elements
		const makeStatRow = (label: string): HTMLElement => {
			const row = document.createElement('div');
			row.className = 'dexp-stat-row';

			const labelEl = document.createElement('span');
			labelEl.textContent = label;

			const valueEl = document.createElement('span');
			valueEl.textContent = '\u2014'; // em dash placeholder

			row.appendChild(labelEl);
			row.appendChild(valueEl);
			return row;
		};

		const cardsRow = makeStatRow('Cards');
		const connectionsRow = makeStatRow('Connections');
		const sizeRow = makeStatRow('Database size');

		// Store references to value spans for updateStats()
		this._statsEls = {
			cards: cardsRow.querySelector('span:last-child') as HTMLElement,
			connections: connectionsRow.querySelector('span:last-child') as HTMLElement,
			size: sizeRow.querySelector('span:last-child') as HTMLElement,
		};

		statsContainer.appendChild(cardsRow);
		statsContainer.appendChild(connectionsRow);
		statsContainer.appendChild(sizeRow);
		body.appendChild(statsContainer);

		// Action buttons row
		const actionsContainer = document.createElement('div');
		actionsContainer.className = 'dexp-db-actions';

		// Vacuum / Optimize button (destructive)
		const vacuumBtn = document.createElement('button');
		vacuumBtn.type = 'button';
		vacuumBtn.className = 'dexp-vacuum-btn';
		vacuumBtn.textContent = 'Vacuum / Optimize';
		vacuumBtn.addEventListener('click', async () => {
			vacuumBtn.textContent = 'Optimizing\u2026';
			vacuumBtn.disabled = true;
			try {
				await this._config.onVacuum();
			} finally {
				vacuumBtn.textContent = 'Vacuum / Optimize';
				vacuumBtn.disabled = false;
			}
		});
		this._vacuumBtn = vacuumBtn;

		// Export Database button (ghost)
		const exportDbBtn = document.createElement('button');
		exportDbBtn.type = 'button';
		exportDbBtn.className = 'dexp-export-db-btn';
		exportDbBtn.textContent = 'Export Database';
		exportDbBtn.addEventListener('click', () => this._config.onExportDatabase());

		actionsContainer.appendChild(vacuumBtn);
		actionsContainer.appendChild(exportDbBtn);
		body.appendChild(actionsContainer);

		// Recent Cards heading
		const recentHeading = document.createElement('h4');
		recentHeading.className = 'dexp-recent-cards-heading';
		recentHeading.textContent = 'Recent Cards';
		body.appendChild(recentHeading);

		// Recent Cards list
		const recentList = document.createElement('ul');
		recentList.className = 'dexp-recent-cards';
		recentList.setAttribute('aria-label', 'Recent cards');
		this._recentCardsListEl = recentList;
		body.appendChild(recentList);

		section.setState('ready');
	}
}
