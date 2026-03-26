// Isometry v5 — Phase 98 FeaturePanel
// Sidebar toggle tree for the SuperGrid feature harness.
//
// Design:
//   - Renders categorized checkbox tree from PluginRegistry
//   - Expand/collapse per category
//   - Enable All / Disable All per category
//   - Shows enabled count badge (e.g., "SuperStack (1/3)")
//   - Dependency enforcement reflected visually (auto-checked/unchecked)
//   - Persists expanded state in component (not localStorage)
//
// Requirements: HAR-05, HAR-06, HAR-10, HAR-11

import type { PluginRegistry } from '../plugins/PluginRegistry';
import type { PluginMeta } from '../plugins/PluginTypes';

// ---------------------------------------------------------------------------
// FeaturePanel
// ---------------------------------------------------------------------------

export class FeaturePanel {
	private _rootEl: HTMLDivElement | null = null;
	private _registry: PluginRegistry;
	private _expandedCategories: Set<string> = new Set();
	private _unsubscribe: (() => void) | null = null;

	constructor(registry: PluginRegistry) {
		this._registry = registry;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'hns-feature-panel';
		container.appendChild(this._rootEl);

		// Expand all categories by default
		for (const cat of this._registry.getByCategory().keys()) {
			this._expandedCategories.add(cat);
		}

		// Subscribe to registry changes for re-render
		this._unsubscribe = this._registry.onChange(() => this._render());

		this._render();
	}

	destroy(): void {
		this._unsubscribe?.();
		this._rootEl?.remove();
		this._rootEl = null;
	}

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	private _render(): void {
		if (!this._rootEl) return;
		this._rootEl.innerHTML = '';

		const title = document.createElement('h2');
		title.className = 'hns-panel-title';
		title.textContent = 'Features';
		this._rootEl.appendChild(title);

		const grouped = this._registry.getByCategory();

		for (const [category, plugins] of grouped) {
			this._rootEl.appendChild(this._renderCategory(category, plugins));
		}
	}

	private _renderCategory(category: string, plugins: PluginMeta[]): HTMLDivElement {
		const section = document.createElement('div');
		section.className = 'hns-category';

		const enabledCount = plugins.filter((p) => this._registry.isEnabled(p.id)).length;
		const isExpanded = this._expandedCategories.has(category);

		// Category header
		const header = document.createElement('div');
		header.className = 'hns-category-header';

		const chevron = document.createElement('span');
		chevron.className = `hns-chevron ${isExpanded ? 'hns-chevron--open' : ''}`;
		chevron.textContent = '▸';
		header.appendChild(chevron);

		const label = document.createElement('span');
		label.className = 'hns-category-label';
		label.textContent = category;
		header.appendChild(label);

		const badge = document.createElement('span');
		badge.className = 'hns-category-badge';
		badge.textContent = `${enabledCount}/${plugins.length}`;
		if (enabledCount > 0) badge.classList.add('hns-category-badge--active');
		header.appendChild(badge);

		// Category-level actions
		const actions = document.createElement('span');
		actions.className = 'hns-category-actions';

		const enableAllBtn = document.createElement('button');
		enableAllBtn.className = 'hns-action-btn';
		enableAllBtn.textContent = 'All';
		enableAllBtn.title = 'Enable all in this category';
		enableAllBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			for (const p of plugins) this._registry.enable(p.id);
		});
		actions.appendChild(enableAllBtn);

		const disableAllBtn = document.createElement('button');
		disableAllBtn.className = 'hns-action-btn';
		disableAllBtn.textContent = 'None';
		disableAllBtn.title = 'Disable all in this category';
		disableAllBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			for (const p of plugins) this._registry.disable(p.id);
		});
		actions.appendChild(disableAllBtn);

		header.appendChild(actions);

		header.addEventListener('click', () => {
			if (this._expandedCategories.has(category)) {
				this._expandedCategories.delete(category);
			} else {
				this._expandedCategories.add(category);
			}
			this._render();
		});

		section.appendChild(header);

		// Plugin list (collapsible)
		if (isExpanded) {
			const list = document.createElement('div');
			list.className = 'hns-plugin-list';

			for (const plugin of plugins) {
				list.appendChild(this._renderPlugin(plugin));
			}

			section.appendChild(list);
		}

		return section;
	}

	private _renderPlugin(plugin: PluginMeta): HTMLLabelElement {
		const row = document.createElement('label');
		row.className = 'hns-plugin-row';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'hns-plugin-checkbox';
		checkbox.checked = this._registry.isEnabled(plugin.id);
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) {
				this._registry.enable(plugin.id);
			} else {
				this._registry.disable(plugin.id);
			}
		});
		row.appendChild(checkbox);

		const name = document.createElement('span');
		name.className = 'hns-plugin-name';
		name.textContent = plugin.name;
		row.appendChild(name);

		if (plugin.dependencies.length > 0) {
			const deps = document.createElement('span');
			deps.className = 'hns-plugin-deps';
			deps.textContent = `← ${plugin.dependencies.join(', ')}`;
			deps.title = `Depends on: ${plugin.dependencies.join(', ')}`;
			row.appendChild(deps);
		}

		return row;
	}
}
