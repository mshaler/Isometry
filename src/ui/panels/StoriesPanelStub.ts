// Isometry — Phase 149
// StoriesPanelStub: "Coming soon" placeholder for the Stories feature.

import type { PanelFactory, PanelHook, PanelMeta } from './PanelTypes';
import { iconSvg } from '../icons';

export const STORIES_PANEL_META: PanelMeta = {
	id: 'stories-stub',
	name: 'Stories',
	icon: 'book-open',
	description: 'Stories',
	dependencies: [],
	defaultEnabled: false,
};

export const storiesPanelFactory: PanelFactory = (): PanelHook => {
	let el: HTMLElement | null = null;

	return {
		mount(container: HTMLElement): void {
			el = document.createElement('div');
			el.style.cssText =
				'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;padding:24px;';

			const icon = document.createElement('div');
			icon.innerHTML = iconSvg('book-open', 32);
			icon.style.color = 'var(--text-muted)';
			el.appendChild(icon);

			const heading = document.createElement('div');
			heading.textContent = 'Stories';
			heading.style.cssText =
				'font-size:var(--text-md);font-weight:600;color:var(--text-primary);';
			el.appendChild(heading);

			const body = document.createElement('div');
			body.textContent = 'Coming soon';
			body.setAttribute('role', 'status');
			body.style.cssText =
				'font-size:var(--text-base);font-weight:400;color:var(--text-muted);';
			el.appendChild(body);

			container.appendChild(el);
		},
		destroy(): void {
			el?.remove();
			el = null;
		},
	};
};
