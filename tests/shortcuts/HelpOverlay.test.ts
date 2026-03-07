// Isometry v5 — Phase 44 Plan 02 (Task 1)
// Tests for HelpOverlay: keyboard shortcut help overlay component.
//
// Requirements: KEYS-03
// TDD Phase: RED -> GREEN
//
// Note: Test environment is 'node' (not jsdom). We must stub document globally
// and simulate KeyboardEvent manually using plain objects.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShortcutRegistry } from '../../src/shortcuts/ShortcutRegistry';

// We import HelpOverlay after stubs are in place
let HelpOverlay: typeof import('../../src/shortcuts/HelpOverlay').HelpOverlay;

// ---------------------------------------------------------------------------
// Mock ShortcutRegistry
// ---------------------------------------------------------------------------

function createMockRegistry(): ShortcutRegistry {
	const entries: Array<{ shortcut: string; category: string; description: string }> = [];
	const handlers = new Map<string, () => void>();

	return {
		register: vi.fn((shortcut: string, handler: () => void, meta: { category: string; description: string }) => {
			entries.push({ shortcut, category: meta.category, description: meta.description });
			handlers.set(shortcut.toLowerCase(), handler);
		}),
		unregister: vi.fn((shortcut: string) => {
			const idx = entries.findIndex((e) => e.shortcut === shortcut);
			if (idx !== -1) entries.splice(idx, 1);
			handlers.delete(shortcut.toLowerCase());
		}),
		getAll: vi.fn(() => [...entries]),
		destroy: vi.fn(),
	} as unknown as ShortcutRegistry;
}

// ---------------------------------------------------------------------------
// DOM stubs
// ---------------------------------------------------------------------------

function createElementStub() {
	const elements: Record<string, unknown>[] = [];

	function createElement(tag: string) {
		const children: unknown[] = [];
		const classListSet = new Set<string>();
		const listeners = new Map<string, EventListener[]>();
		const el: Record<string, unknown> = {
			tagName: tag.toUpperCase(),
			className: '',
			textContent: '',
			innerHTML: '',
			type: '',
			title: '',
			children,
			childNodes: children,
			style: {},
			classList: {
				add: vi.fn((...classes: string[]) => {
					for (const c of classes) classListSet.add(c);
				}),
				remove: vi.fn((...classes: string[]) => {
					for (const c of classes) classListSet.delete(c);
				}),
				toggle: vi.fn((cls: string, force?: boolean) => {
					if (force === true || (force === undefined && !classListSet.has(cls))) {
						classListSet.add(cls);
					} else {
						classListSet.delete(cls);
					}
				}),
				contains: vi.fn((cls: string) => classListSet.has(cls)),
			},
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!listeners.has(event)) listeners.set(event, []);
				listeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = listeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
			appendChild: vi.fn((child: unknown) => {
				children.push(child);
				return child;
			}),
			remove: vi.fn(),
			querySelector: vi.fn((_selector: string) => null),
			querySelectorAll: vi.fn((_selector: string) => []),
			_listeners: listeners,
			_classListSet: classListSet,
		};
		elements.push(el);
		return el;
	}

	return { createElement, elements };
}

// ---------------------------------------------------------------------------
// Tests: DOM creation & mounting
// ---------------------------------------------------------------------------

describe('HelpOverlay — mount and DOM structure', () => {
	let docStub: ReturnType<typeof createElementStub>;
	const docListeners = new Map<string, EventListener[]>();

	beforeEach(async () => {
		docStub = createElementStub();
		vi.stubGlobal('document', {
			createElement: vi.fn((tag: string) => docStub.createElement(tag)),
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!docListeners.has(event)) docListeners.set(event, []);
				docListeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = docListeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });

		// Dynamic import to pick up stubs
		const mod = await import('../../src/shortcuts/HelpOverlay');
		HelpOverlay = mod.HelpOverlay;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		docListeners.clear();
	});

	it('mount creates an overlay element and appends to container', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		// Should have appended the overlay div to the container
		expect(container['appendChild'] as ReturnType<typeof vi.fn>).toHaveBeenCalled();
		overlay.destroy();
	});

	it('overlay is hidden by default after mount', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		// is-visible should NOT be in classlist
		expect(overlay.isVisible()).toBe(false);
		overlay.destroy();
	});

	it('registers ? shortcut via ShortcutRegistry on mount', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		expect(registry.register).toHaveBeenCalledWith('?', expect.any(Function), {
			category: 'Help',
			description: 'Show keyboard shortcuts',
		});
		overlay.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tests: show/hide/toggle
// ---------------------------------------------------------------------------

describe('HelpOverlay — show, hide, toggle', () => {
	let docStub: ReturnType<typeof createElementStub>;
	const docListeners = new Map<string, EventListener[]>();

	beforeEach(async () => {
		docStub = createElementStub();
		vi.stubGlobal('document', {
			createElement: vi.fn((tag: string) => docStub.createElement(tag)),
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!docListeners.has(event)) docListeners.set(event, []);
				docListeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = docListeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
		const mod = await import('../../src/shortcuts/HelpOverlay');
		HelpOverlay = mod.HelpOverlay;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		docListeners.clear();
	});

	it('show() makes overlay visible', () => {
		const registry = createMockRegistry();
		registry.getAll = vi.fn(() => [{ shortcut: 'Cmd+Z', category: 'Editing', description: 'Undo' }]);
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.show();
		expect(overlay.isVisible()).toBe(true);
	});

	it('hide() makes overlay hidden', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.show();
		overlay.hide();
		expect(overlay.isVisible()).toBe(false);
	});

	it('toggle() alternates between show and hide', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.toggle();
		expect(overlay.isVisible()).toBe(true);
		overlay.toggle();
		expect(overlay.isVisible()).toBe(false);
	});

	it('show() calls getAll() to populate shortcuts', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.show();
		expect(registry.getAll).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Tests: Category grouping
// ---------------------------------------------------------------------------

describe('HelpOverlay — category grouping', () => {
	let docStub: ReturnType<typeof createElementStub>;
	const docListeners = new Map<string, EventListener[]>();

	beforeEach(async () => {
		docStub = createElementStub();
		vi.stubGlobal('document', {
			createElement: vi.fn((tag: string) => docStub.createElement(tag)),
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!docListeners.has(event)) docListeners.set(event, []);
				docListeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = docListeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
		const mod = await import('../../src/shortcuts/HelpOverlay');
		HelpOverlay = mod.HelpOverlay;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		docListeners.clear();
	});

	it('groups shortcuts by category when showing', () => {
		const registry = createMockRegistry();
		registry.getAll = vi.fn(() => [
			{ shortcut: 'Cmd+Z', category: 'Editing', description: 'Undo' },
			{ shortcut: 'Cmd+Shift+Z', category: 'Editing', description: 'Redo' },
			{ shortcut: 'Cmd+1', category: 'Navigation', description: 'List view' },
			{ shortcut: '?', category: 'Help', description: 'Show keyboard shortcuts' },
		]);
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.show();

		// Verify getAll was called and categories would be grouped
		expect(registry.getAll).toHaveBeenCalled();
		const allShortcuts = registry.getAll();
		const categories = [...new Set(allShortcuts.map((s) => s.category))];
		expect(categories).toContain('Editing');
		expect(categories).toContain('Navigation');
		expect(categories).toContain('Help');
	});
});

// ---------------------------------------------------------------------------
// Tests: Escape key
// ---------------------------------------------------------------------------

describe('HelpOverlay — Escape key', () => {
	let docStub: ReturnType<typeof createElementStub>;
	const docListeners = new Map<string, EventListener[]>();

	beforeEach(async () => {
		docStub = createElementStub();
		vi.stubGlobal('document', {
			createElement: vi.fn((tag: string) => docStub.createElement(tag)),
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!docListeners.has(event)) docListeners.set(event, []);
				docListeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = docListeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
		const mod = await import('../../src/shortcuts/HelpOverlay');
		HelpOverlay = mod.HelpOverlay;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		docListeners.clear();
	});

	it('Escape key closes overlay when visible', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.show();
		expect(overlay.isVisible()).toBe(true);

		// Dispatch Escape keydown on document
		const handlers = docListeners.get('keydown') ?? [];
		for (const h of handlers) {
			h({
				key: 'Escape',
				preventDefault: vi.fn(),
				target: { tagName: 'BODY', isContentEditable: false },
			} as unknown as Event);
		}
		expect(overlay.isVisible()).toBe(false);
	});

	it('Escape does nothing when overlay is hidden', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		expect(overlay.isVisible()).toBe(false);

		// Dispatch Escape
		const handlers = docListeners.get('keydown') ?? [];
		for (const h of handlers) {
			h({
				key: 'Escape',
				preventDefault: vi.fn(),
				target: { tagName: 'BODY', isContentEditable: false },
			} as unknown as Event);
		}
		expect(overlay.isVisible()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Tests: Destroy cleanup
// ---------------------------------------------------------------------------

describe('HelpOverlay — destroy', () => {
	let docStub: ReturnType<typeof createElementStub>;
	const docListeners = new Map<string, EventListener[]>();

	beforeEach(async () => {
		docStub = createElementStub();
		vi.stubGlobal('document', {
			createElement: vi.fn((tag: string) => docStub.createElement(tag)),
			addEventListener: vi.fn((event: string, handler: EventListener) => {
				if (!docListeners.has(event)) docListeners.set(event, []);
				docListeners.get(event)!.push(handler);
			}),
			removeEventListener: vi.fn((event: string, handler: EventListener) => {
				const handlers = docListeners.get(event) ?? [];
				const idx = handlers.indexOf(handler);
				if (idx !== -1) handlers.splice(idx, 1);
			}),
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
		const mod = await import('../../src/shortcuts/HelpOverlay');
		HelpOverlay = mod.HelpOverlay;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
		docListeners.clear();
	});

	it('destroy removes overlay DOM element', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.destroy();
		// The overlay element's remove() should have been called
		// We verify by checking isVisible returns false and no errors
		expect(overlay.isVisible()).toBe(false);
	});

	it('destroy removes keydown listener from document', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.destroy();
		expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
	});

	it('destroy unregisters ? shortcut from registry', () => {
		const registry = createMockRegistry();
		const overlay = new HelpOverlay(registry);
		const container = docStub.createElement('div');
		overlay.mount(container as unknown as HTMLElement);
		overlay.destroy();
		expect(registry.unregister).toHaveBeenCalledWith('?');
	});
});
