// @vitest-environment jsdom
// Isometry v5 — Phase 54 Plan 01 (Task 1)
// Tests for CollapsibleSection: reusable collapsible panel primitive
// with expand/collapse animation, keyboard operation, ARIA, and localStorage persistence.
//
// Requirements: SHEL-02, INTG-01, INTG-04
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollapsibleSection, type CollapsibleSectionConfig } from '../../src/ui/CollapsibleSection';

describe('CollapsibleSection', () => {
	let container: HTMLDivElement;
	let section: CollapsibleSection;

	const defaultConfig: CollapsibleSectionConfig = {
		title: 'Properties',
		icon: '\u{1F527}',
		storageKey: 'properties',
		stubContent: 'Properties explorer coming soon',
	};

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		section?.destroy();
		container.remove();
		localStorage.clear();
	});

	// ---------------------------------------------------------------------------
	// Mount / Destroy lifecycle (INTG-01)
	// ---------------------------------------------------------------------------

	describe('mount/destroy lifecycle', () => {
		it('mount() creates DOM structure inside container', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const root = container.querySelector('.collapsible-section');
			expect(root).not.toBeNull();
			expect(root?.getAttribute('data-section')).toBe('properties');
		});

		it('mount() creates header button and body div', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header');
			expect(header).not.toBeNull();
			expect(header?.tagName).toBe('BUTTON');

			const body = container.querySelector('.collapsible-section__body');
			expect(body).not.toBeNull();
		});

		it('destroy() removes DOM from container', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			expect(container.querySelector('.collapsible-section')).not.toBeNull();

			section.destroy();

			expect(container.querySelector('.collapsible-section')).toBeNull();
		});

		it('destroy() sets getElement() to null', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);
			expect(section.getElement()).not.toBeNull();

			section.destroy();
			expect(section.getElement()).toBeNull();
		});

		it('getElement() returns the root element after mount', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const el = section.getElement();
			expect(el).not.toBeNull();
			expect(el?.classList.contains('collapsible-section')).toBe(true);
		});
	});

	// ---------------------------------------------------------------------------
	// ARIA attributes (INTG-04)
	// ---------------------------------------------------------------------------

	describe('ARIA attributes', () => {
		it('header button has aria-expanded="true" by default (expanded)', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header');
			expect(header?.getAttribute('aria-expanded')).toBe('true');
		});

		it('header button has aria-controls pointing to body element id', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header');
			const body = container.querySelector('.collapsible-section__body');
			expect(header?.getAttribute('aria-controls')).toBe('section-properties-body');
			expect(body?.id).toBe('section-properties-body');
		});

		it('header button has correct id', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header');
			expect(header?.id).toBe('section-properties-header');
		});

		it('body has role="region" and aria-labelledby pointing to header', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const body = container.querySelector('.collapsible-section__body');
			expect(body?.getAttribute('role')).toBe('region');
			expect(body?.getAttribute('aria-labelledby')).toBe('section-properties-header');
		});

		it('aria-expanded updates to "false" when collapsed', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			section.setCollapsed(true);

			const header = container.querySelector('.collapsible-section__header');
			expect(header?.getAttribute('aria-expanded')).toBe('false');
		});
	});

	// ---------------------------------------------------------------------------
	// Click toggle
	// ---------------------------------------------------------------------------

	describe('click toggle', () => {
		it('clicking header toggles from expanded to collapsed', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			header.click();

			expect(section.getCollapsed()).toBe(true);
			expect(header.getAttribute('aria-expanded')).toBe('false');
		});

		it('clicking header toggles from collapsed back to expanded', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			header.click(); // collapse
			header.click(); // expand

			expect(section.getCollapsed()).toBe(false);
			expect(header.getAttribute('aria-expanded')).toBe('true');
		});

		it('collapsed class added to root when collapsed', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const root = container.querySelector('.collapsible-section') as HTMLElement;
			const header = container.querySelector('.collapsible-section__header') as HTMLElement;

			expect(root.classList.contains('collapsible-section--collapsed')).toBe(false);

			header.click();
			expect(root.classList.contains('collapsible-section--collapsed')).toBe(true);
		});
	});

	// ---------------------------------------------------------------------------
	// Keyboard operation (Enter + Space)
	// ---------------------------------------------------------------------------

	describe('keyboard operation', () => {
		it('Enter key toggles collapsed state', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

			expect(section.getCollapsed()).toBe(true);
		});

		it('Space key toggles collapsed state and calls preventDefault', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			const event = new KeyboardEvent('keydown', {
				key: ' ',
				bubbles: true,
				cancelable: true,
			});
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
			header.dispatchEvent(event);

			expect(section.getCollapsed()).toBe(true);
			expect(preventDefaultSpy).toHaveBeenCalled();
		});

		it('other keys do not toggle state', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

			expect(section.getCollapsed()).toBe(false);
		});
	});

	// ---------------------------------------------------------------------------
	// Chevron indicator
	// ---------------------------------------------------------------------------

	describe('chevron indicator', () => {
		it('shows chevron-down when expanded', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const chevron = container.querySelector('.collapsible-section__chevron') as HTMLElement;
			expect(chevron.textContent).toBe('\u25BE'); // ▾
		});

		it('shows chevron-right when collapsed', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);
			section.setCollapsed(true);

			const chevron = container.querySelector('.collapsible-section__chevron') as HTMLElement;
			expect(chevron.textContent).toBe('\u25B8'); // ▸
		});
	});

	// ---------------------------------------------------------------------------
	// Count badge
	// ---------------------------------------------------------------------------

	describe('count badge', () => {
		it('count badge hidden by default when count not provided', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const count = container.querySelector('.collapsible-section__count') as HTMLElement;
			expect(count.style.display).toBe('none');
		});

		it('count badge visible when count provided in config', () => {
			section = new CollapsibleSection({ ...defaultConfig, count: 12 });
			section.mount(container);

			const count = container.querySelector('.collapsible-section__count') as HTMLElement;
			expect(count.style.display).not.toBe('none');
			expect(count.textContent).toBe('(12)');
		});

		it('setCount() updates badge text and visibility', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			section.setCount(5);

			const count = container.querySelector('.collapsible-section__count') as HTMLElement;
			expect(count.textContent).toBe('(5)');
			expect(count.style.display).not.toBe('none');
		});

		it('setCount(0) hides badge', () => {
			section = new CollapsibleSection({ ...defaultConfig, count: 5 });
			section.mount(container);

			section.setCount(0);

			const count = container.querySelector('.collapsible-section__count') as HTMLElement;
			expect(count.style.display).toBe('none');
		});
	});

	// ---------------------------------------------------------------------------
	// localStorage persistence
	// ---------------------------------------------------------------------------

	describe('localStorage persistence', () => {
		it('persists collapsed state to localStorage on toggle', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			section.setCollapsed(true);
			expect(localStorage.getItem('workbench:properties')).toBe('true');

			section.setCollapsed(false);
			expect(localStorage.getItem('workbench:properties')).toBe('false');
		});

		it('reads persisted collapsed state on mount', () => {
			localStorage.setItem('workbench:properties', 'true');

			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			expect(section.getCollapsed()).toBe(true);
			const header = container.querySelector('.collapsible-section__header');
			expect(header?.getAttribute('aria-expanded')).toBe('false');
		});

		it('defaults to expanded when no stored value exists', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			expect(section.getCollapsed()).toBe(false);
		});

		it('respects defaultCollapsed config when no stored value', () => {
			section = new CollapsibleSection({
				...defaultConfig,
				defaultCollapsed: true,
			});
			section.mount(container);

			expect(section.getCollapsed()).toBe(true);
		});

		it('stored value takes precedence over defaultCollapsed', () => {
			localStorage.setItem('workbench:properties', 'false');

			section = new CollapsibleSection({
				...defaultConfig,
				defaultCollapsed: true,
			});
			section.mount(container);

			expect(section.getCollapsed()).toBe(false);
		});

		it('click toggle persists state to localStorage', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const header = container.querySelector('.collapsible-section__header') as HTMLElement;
			header.click();

			expect(localStorage.getItem('workbench:properties')).toBe('true');
		});
	});

	// ---------------------------------------------------------------------------
	// Programmatic setCollapsed / getCollapsed
	// ---------------------------------------------------------------------------

	describe('programmatic control', () => {
		it('setCollapsed(true) collapses the section', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			section.setCollapsed(true);

			expect(section.getCollapsed()).toBe(true);
			const root = container.querySelector('.collapsible-section') as HTMLElement;
			expect(root.classList.contains('collapsible-section--collapsed')).toBe(true);
		});

		it('setCollapsed(false) expands the section', () => {
			section = new CollapsibleSection({
				...defaultConfig,
				defaultCollapsed: true,
			});
			section.mount(container);

			section.setCollapsed(false);

			expect(section.getCollapsed()).toBe(false);
			const root = container.querySelector('.collapsible-section') as HTMLElement;
			expect(root.classList.contains('collapsible-section--collapsed')).toBe(false);
		});
	});

	// ---------------------------------------------------------------------------
	// Stub content rendering
	// ---------------------------------------------------------------------------

	describe('stub content', () => {
		it('renders stub icon and text when stubContent provided', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const stubIcon = container.querySelector('.collapsible-section__stub-icon') as HTMLElement;
			const stubText = container.querySelector('.collapsible-section__stub-text') as HTMLElement;

			expect(stubIcon.textContent).toBe('\u{1F527}');
			expect(stubText.textContent).toBe('Properties explorer coming soon');
		});

		it('does not render stub when stubContent is not provided', () => {
			section = new CollapsibleSection({
				title: 'Test',
				icon: '\u{1F4CB}',
				storageKey: 'test',
			});
			section.mount(container);

			const stub = container.querySelector('.collapsible-section__stub');
			expect(stub).toBeNull();
		});
	});

	// ---------------------------------------------------------------------------
	// Title display
	// ---------------------------------------------------------------------------

	describe('title', () => {
		it('renders the title text in the header', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const title = container.querySelector('.collapsible-section__title') as HTMLElement;
			expect(title.textContent).toBe('Properties');
		});
	});

	// ---------------------------------------------------------------------------
	// getBodyEl — direct body element access (Phase 55)
	// ---------------------------------------------------------------------------

	describe('getBodyEl', () => {
		it('returns the body element after mount', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const body = section.getBodyEl();
			expect(body).not.toBeNull();
			expect(body?.classList.contains('collapsible-section__body')).toBe(true);
		});

		it('returns null before mount', () => {
			section = new CollapsibleSection(defaultConfig);
			expect(section.getBodyEl()).toBeNull();
		});

		it('returns null after destroy', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);
			section.destroy();
			expect(section.getBodyEl()).toBeNull();
		});
	});

	// ---------------------------------------------------------------------------
	// setContent — replace body content (Phase 55)
	// ---------------------------------------------------------------------------

	describe('setContent', () => {
		it('clears stub content and appends new element', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			// Verify stub exists
			const stubBefore = container.querySelector('.collapsible-section__stub');
			expect(stubBefore).not.toBeNull();

			// Set new content
			const explorer = document.createElement('div');
			explorer.className = 'properties-explorer';
			explorer.textContent = 'Explorer content';
			section.setContent(explorer);

			// Stub should be gone
			const stubAfter = container.querySelector('.collapsible-section__stub');
			expect(stubAfter).toBeNull();

			// Explorer should be present
			const body = section.getBodyEl()!;
			expect(body.children).toHaveLength(1);
			expect(body.querySelector('.properties-explorer')).not.toBeNull();
		});

		it('is a no-op when not mounted', () => {
			section = new CollapsibleSection(defaultConfig);
			const el = document.createElement('div');
			// Should not throw
			section.setContent(el);
		});

		it('replaces previous content on subsequent calls', () => {
			section = new CollapsibleSection(defaultConfig);
			section.mount(container);

			const first = document.createElement('div');
			first.className = 'first-content';
			section.setContent(first);

			const second = document.createElement('div');
			second.className = 'second-content';
			section.setContent(second);

			const body = section.getBodyEl()!;
			expect(body.children).toHaveLength(1);
			expect(body.querySelector('.first-content')).toBeNull();
			expect(body.querySelector('.second-content')).not.toBeNull();
		});
	});

	// ---------------------------------------------------------------------------
	// explorer-backed collapse regression (Phase 85)
	// ---------------------------------------------------------------------------

	describe('explorer-backed collapse regression (Phase 85)', () => {
		it('collapsing a section with explorer content adds collapsed class to root', () => {
			section = new CollapsibleSection({
				title: 'Properties',
				icon: '\u{1F527}',
				storageKey: 'properties-explorer-test',
			});
			section.mount(container);

			const explorerEl = document.createElement('div');
			explorerEl.className = 'properties-explorer';
			section.setContent(explorerEl);
			section.setState('ready');

			const root = section.getElement()!;
			const header = root.querySelector('.collapsible-section__header') as HTMLElement;
			header.click();

			expect(root.classList.contains('collapsible-section--collapsed')).toBe(true);
			expect(section.getCollapsed()).toBe(true);
		});

		it('expanding a collapsed explorer section removes collapsed class', () => {
			section = new CollapsibleSection({
				title: 'Properties',
				icon: '\u{1F527}',
				storageKey: 'properties-explorer-expand-test',
			});
			section.mount(container);

			const explorerEl = document.createElement('div');
			explorerEl.className = 'properties-explorer';
			section.setContent(explorerEl);
			section.setState('ready');

			const root = section.getElement()!;
			const header = root.querySelector('.collapsible-section__header') as HTMLElement;
			header.click(); // collapse
			header.click(); // expand

			expect(root.classList.contains('collapsible-section--collapsed')).toBe(false);
			expect(section.getCollapsed()).toBe(false);
		});

		it('body retains has-explorer class when collapsed', () => {
			section = new CollapsibleSection({
				title: 'Properties',
				icon: '\u{1F527}',
				storageKey: 'properties-has-explorer-test',
			});
			section.mount(container);

			const explorerEl = document.createElement('div');
			explorerEl.className = 'properties-explorer';
			section.setContent(explorerEl);
			section.setState('ready');

			section.setCollapsed(true);

			const body = section.getBodyEl()!;
			const root = section.getElement()!;
			expect(body.classList.contains('collapsible-section__body--has-explorer')).toBe(true);
			expect(root.classList.contains('collapsible-section--collapsed')).toBe(true);
		});
	});
});
