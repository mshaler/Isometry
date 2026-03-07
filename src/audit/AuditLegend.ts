// Isometry v5 — Phase 37 AuditLegend
// Floating legend panel showing change indicator and source provenance colors.
//
// Positioned above the toggle button (bottom: 60px, right: 16px).
// Shows two sections: Changes (3 colors) and Sources (9 colors with labels).
// Dismissible via close button.
//
// Requirements: AUDIT-06, AUDIT-08

import { AUDIT_COLORS, SOURCE_COLORS, SOURCE_LABELS } from './audit-colors';

/**
 * AuditLegend displays a floating panel with color explanations
 * for change indicators and source provenance.
 *
 * show() creates and appends the panel DOM to the container.
 * hide() removes the panel from the DOM.
 * destroy() hides and cleans up.
 */
export class AuditLegend {
	private _container: HTMLElement;
	private _panel: HTMLDivElement | null = null;

	constructor(container: HTMLElement) {
		this._container = container;
	}

	/**
	 * Create and display the legend panel. No-op if already showing.
	 */
	show(): void {
		if (this._panel) return;

		const panel = document.createElement('div');
		panel.className = 'audit-legend';

		// Header
		const header = document.createElement('div');
		header.className = 'audit-legend-header';

		const title = document.createElement('span');
		title.className = 'audit-legend-title';
		title.textContent = 'Audit Legend';
		header.appendChild(title);

		const closeBtn = document.createElement('button');
		closeBtn.className = 'audit-legend-close';
		closeBtn.type = 'button';
		closeBtn.innerHTML = '&times;';
		closeBtn.addEventListener('click', () => this.hide());
		header.appendChild(closeBtn);

		panel.appendChild(header);

		// Changes section
		const changesSection = this._createSection('Changes', [
			{ color: AUDIT_COLORS.new, label: 'New (added this session)' },
			{ color: AUDIT_COLORS.modified, label: 'Modified (updated this session)' },
			{ color: AUDIT_COLORS.deleted, label: 'Deleted (removed from source)' },
		]);
		panel.appendChild(changesSection);

		// Sources section — dynamically generated from SOURCE_COLORS
		const sourceItems: Array<{ color: string; label: string }> = [];
		for (const [key, color] of Object.entries(SOURCE_COLORS)) {
			sourceItems.push({
				color,
				label: SOURCE_LABELS[key] ?? key,
			});
		}
		const sourcesSection = this._createSection('Sources', sourceItems);
		panel.appendChild(sourcesSection);

		this._container.appendChild(panel);
		this._panel = panel;
	}

	/**
	 * Remove the legend panel from the DOM.
	 */
	hide(): void {
		if (this._panel) {
			this._panel.remove();
			this._panel = null;
		}
	}

	/**
	 * Hide and clean up references.
	 */
	destroy(): void {
		this.hide();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private _createSection(titleText: string, items: Array<{ color: string; label: string }>): HTMLDivElement {
		const section = document.createElement('div');
		section.className = 'audit-legend-section';

		const sectionTitle = document.createElement('div');
		sectionTitle.className = 'audit-legend-section-title';
		sectionTitle.textContent = titleText;
		section.appendChild(sectionTitle);

		for (const item of items) {
			const row = document.createElement('div');
			row.className = 'audit-legend-item';

			const swatch = document.createElement('span');
			swatch.className = 'audit-legend-swatch';
			swatch.style.background = item.color;
			row.appendChild(swatch);

			const label = document.createElement('span');
			label.textContent = item.label;
			row.appendChild(label);

			section.appendChild(row);
		}

		return section;
	}
}
