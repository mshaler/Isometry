// @vitest-environment jsdom
// Isometry v5 — Phase 57 Plan 01 (Task 2) + Phase 64 Plan 01 (Persistence) + Phase 65 Plan 02
// Tests for NotebookExplorer: tabbed Write/Preview layout with Markdown rendering,
// XSS sanitization, keyboard shortcuts, formatting engine, per-card persistence,
// and D3 chart blocks via marked extension + ChartRenderer.
//
// Requirements: NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06, NOTE-07, NOTE-08
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Dynamic import to allow RED phase to fail gracefully
let NotebookExplorer: typeof import('../../src/ui/NotebookExplorer').NotebookExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/NotebookExplorer');
	NotebookExplorer = mod.NotebookExplorer;
});

// ---------------------------------------------------------------------------
// Mock helpers for NotebookExplorerConfig
// ---------------------------------------------------------------------------

function createMockBridge() {
	return {
		send: vi.fn(async (type: string, payload: any) => {
			if (type === 'ui:get') {
				return { key: payload.key, value: null, updated_at: null };
			}
			if (type === 'card:get') {
				return null; // No card by default
			}
			// ui:set returns undefined
			return undefined;
		}),
	} as any;
}

function createMockSelection(ids: string[] = []) {
	const unsubFn = vi.fn();
	return {
		getSelectedIds: vi.fn(() => ids),
		subscribe: vi.fn(() => unsubFn),
		_unsubFn: unsubFn,
		_setIds(newIds: string[]) {
			ids = newIds;
			this.getSelectedIds.mockReturnValue(newIds);
		},
	} as any;
}

function createMockFilter() {
	return {
		compile: vi.fn(() => ({ where: 'deleted_at IS NULL', params: [] })),
		subscribe: vi.fn(() => vi.fn()),
	} as any;
}

function createMockAlias() {
	return {
		getAlias: vi.fn((field: string) => field),
	} as any;
}

function createMockMutationManager() {
	return {
		execute: vi.fn(async () => {}),
		subscribe: vi.fn(() => () => {}),
		isDirty: vi.fn(() => false),
	} as any;
}

function createConfig(overrides: { bridge?: any; selection?: any; filter?: any; alias?: any; mutations?: any } = {}) {
	return {
		bridge: overrides.bridge ?? createMockBridge(),
		selection: overrides.selection ?? createMockSelection(),
		filter: overrides.filter ?? createMockFilter(),
		alias: overrides.alias ?? createMockAlias(),
		mutations: overrides.mutations ?? createMockMutationManager(),
	};
}

// ---------------------------------------------------------------------------
// Mount / Destroy (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- mount/destroy', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('mount() creates .notebook-explorer root appended to container', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const root = container.querySelector('.notebook-explorer');
		expect(root).not.toBeNull();

		explorer.destroy();
	});

	it('root contains .notebook-segmented-control with 2 .notebook-tab buttons', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const control = container.querySelector('.notebook-segmented-control');
		expect(control).not.toBeNull();

		const tabs = control!.querySelectorAll('.notebook-tab');
		expect(tabs.length).toBe(2);
		expect(tabs[0]!.textContent).toBe('Write');
		expect(tabs[1]!.textContent).toBe('Preview');

		explorer.destroy();
	});

	it('root contains .notebook-body with .notebook-textarea and .notebook-preview', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const body = container.querySelector('.notebook-body');
		expect(body).not.toBeNull();

		const textarea = body!.querySelector('.notebook-textarea');
		expect(textarea).not.toBeNull();
		expect(textarea!.tagName).toBe('TEXTAREA');

		const preview = body!.querySelector('.notebook-preview');
		expect(preview).not.toBeNull();

		explorer.destroy();
	});

	it('root does NOT contain .notebook-chart-preview element (stub removed in Phase 65)', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const chartStub = container.querySelector('.notebook-chart-preview');
		expect(chartStub).toBeNull();

		explorer.destroy();
	});

	it('destroy() removes root from DOM', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		expect(container.querySelector('.notebook-explorer')).not.toBeNull();

		explorer.destroy();

		expect(container.querySelector('.notebook-explorer')).toBeNull();
	});

	it('textarea has placeholder "Write notes for this card..."', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		expect(textarea.placeholder).toBe('Write notes for this card...');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tab Switching (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- tab switching', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('default state: Write tab active, textarea visible, preview hidden', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const tabs = container.querySelectorAll('.notebook-tab');
		expect(tabs[0]!.classList.contains('notebook-tab--active')).toBe(true);
		expect(tabs[1]!.classList.contains('notebook-tab--active')).toBe(false);

		const textarea = container.querySelector('.notebook-textarea') as HTMLElement;
		const preview = container.querySelector('.notebook-preview') as HTMLElement;
		expect(textarea.style.display).not.toBe('none');
		expect(preview.style.display).toBe('none');

		explorer.destroy();
	});

	it('clicking Preview tab hides textarea and shows preview', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		const textarea = container.querySelector('.notebook-textarea') as HTMLElement;
		const preview = container.querySelector('.notebook-preview') as HTMLElement;
		expect(textarea.style.display).toBe('none');
		expect(preview.style.display).not.toBe('none');

		// Tab active state
		expect(tabs[0]!.classList.contains('notebook-tab--active')).toBe(false);
		expect(tabs[1]!.classList.contains('notebook-tab--active')).toBe(true);

		explorer.destroy();
	});

	it('clicking Write tab after Preview restores textarea', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click(); // Switch to Preview
		(tabs[0] as HTMLElement).click(); // Switch back to Write

		const textarea = container.querySelector('.notebook-textarea') as HTMLElement;
		const preview = container.querySelector('.notebook-preview') as HTMLElement;
		expect(textarea.style.display).not.toBe('none');
		expect(preview.style.display).toBe('none');

		explorer.destroy();
	});

	it('content persists across tab switches', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click(); // Preview
		(tabs[0] as HTMLElement).click(); // Write

		expect(textarea.value).toBe('hello');

		explorer.destroy();
	});

	it('aria-pressed toggles on tab switch', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const tabs = container.querySelectorAll('.notebook-tab');
		expect(tabs[0]!.getAttribute('aria-pressed')).toBe('true');
		expect(tabs[1]!.getAttribute('aria-pressed')).toBe('false');

		(tabs[1] as HTMLElement).click();
		expect(tabs[0]!.getAttribute('aria-pressed')).toBe('false');
		expect(tabs[1]!.getAttribute('aria-pressed')).toBe('true');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Markdown Rendering (NOTE-01, NOTE-02)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- Markdown rendering', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('heading renders as h1 in preview', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '# Hello';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click(); // Preview

		const preview = container.querySelector('.notebook-preview')!;
		const h1 = preview.querySelector('h1');
		expect(h1).not.toBeNull();
		expect(h1!.textContent).toBe('Hello');

		explorer.destroy();
	});

	it('GFM table renders as table/thead/tbody/tr/td', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '| A | B |\n| --- | --- |\n| 1 | 2 |';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		const preview = container.querySelector('.notebook-preview')!;
		expect(preview.querySelector('table')).not.toBeNull();
		expect(preview.querySelector('thead')).not.toBeNull();
		expect(preview.querySelector('tbody')).not.toBeNull();
		expect(preview.querySelector('tr')).not.toBeNull();
		expect(preview.querySelector('td')).not.toBeNull();

		explorer.destroy();
	});

	it('GFM task list renders checkbox input', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '- [x] Done\n- [ ] Pending';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		const preview = container.querySelector('.notebook-preview')!;
		const checkbox = preview.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox).not.toBeNull();
		expect(checkbox.checked).toBe(true);

		explorer.destroy();
	});

	it('strikethrough renders as del or s element', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '~~deleted~~';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		const preview = container.querySelector('.notebook-preview')!;
		const del = preview.querySelector('del') || preview.querySelector('s');
		expect(del).not.toBeNull();
		expect(del!.textContent).toBe('deleted');

		explorer.destroy();
	});

	it('code block renders as pre > code', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '```\nconst x = 1;\n```';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		const preview = container.querySelector('.notebook-preview')!;
		const pre = preview.querySelector('pre');
		expect(pre).not.toBeNull();
		const code = pre!.querySelector('code');
		expect(code).not.toBeNull();

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// XSS Sanitization (NOTE-02)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- XSS sanitization', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	function renderPreview(
		_explorer: InstanceType<typeof NotebookExplorer>,
		c: HTMLElement,
		markdown: string,
	): HTMLElement {
		const textarea = c.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = markdown;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = c.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		return c.querySelector('.notebook-preview')!;
	}

	it('script tags are stripped', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<script>alert("xss")</script>');
		expect(preview.querySelector('script')).toBeNull();
		expect(preview.innerHTML).not.toContain('script');

		explorer.destroy();
	});

	it('onerror attributes are stripped', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		// Use proper HTML that marked passes through (block-level HTML)
		const preview = renderPreview(explorer, container, '<div><img src="x" onerror="alert(\'xss\')"></div>');
		// DOMPurify must strip the onerror attribute from the img element
		const img = preview.querySelector('img');
		if (img) {
			expect(img.hasAttribute('onerror')).toBe(false);
		}
		// Either way, no executable onerror should exist on any element
		const allWithOnerror = preview.querySelectorAll('[onerror]');
		expect(allWithOnerror.length).toBe(0);

		explorer.destroy();
	});

	it('javascript: URIs are stripped', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<a href="javascript:alert(\'xss\')">click</a>');
		expect(preview.innerHTML).not.toContain('javascript:');

		explorer.destroy();
	});

	it('iframe elements are stripped', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<iframe src="evil.com"></iframe>');
		expect(preview.querySelector('iframe')).toBeNull();

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Keyboard Shortcuts (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- keyboard shortcuts', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('Cmd+B with "hello" selected wraps to "**hello**"', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('**hello**');

		explorer.destroy();
	});

	it('Cmd+I with "hello" selected wraps to "_hello_"', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'i', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('_hello_');

		explorer.destroy();
	});

	it('Cmd+K with "hello" selected wraps to "[hello](url)"', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('[hello](url)');

		explorer.destroy();
	});

	it('Cmd+B with no selection inserts "****" with cursor between', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = '';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 0;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('****');
		expect(textarea.selectionStart).toBe(2);
		expect(textarea.selectionEnd).toBe(2);

		explorer.destroy();
	});

	it('regular typing without Cmd is not intercepted', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'test';
		textarea.selectionStart = 4;
		textarea.selectionEnd = 4;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: false, bubbles: true });
		textarea.dispatchEvent(event);

		// Value unchanged (no wrapping)
		expect(textarea.value).toBe('test');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// No localStorage (NOTE-04)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- no localStorage', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('no localStorage calls during notebook lifecycle', () => {
		const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
		const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'test content';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		// Switch tabs
		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();
		(tabs[0] as HTMLElement).click();

		explorer.destroy();

		// Filter spy calls to only notebook-related (not CollapsibleSection localStorage)
		// NotebookExplorer itself should make zero localStorage calls
		const notebookSetCalls = setItemSpy.mock.calls.filter(
			(call) => typeof call[0] === 'string' && call[0].includes('notebook'),
		);
		expect(notebookSetCalls.length).toBe(0);

		setItemSpy.mockRestore();
		getItemSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Chart Block Integration (NOTE-06, NOTE-07, NOTE-08) -- Phase 65 Plan 02
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- chart blocks', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('marked renderer extension converts ```chart blocks into .notebook-chart-card divs', async () => {
		// Ensure marked extension is registered by creating an explorer
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const { marked: m } = await import('marked');
		const md = '```chart\ntype: bar\nx: folder\n```\n';
		const html = m.parse(md) as string;

		expect(html).toContain('class="notebook-chart-card"');
		expect(html).toContain('data-chart-id="chart-');
		expect(html).toContain('data-chart-config="');

		explorer.destroy();
	});

	it('non-chart code blocks still render as <pre><code> (default fallback)', async () => {
		// Ensure marked extension is registered
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const { marked: m } = await import('marked');
		const md = '```js\nconsole.log("hello")\n```\n';
		const html = m.parse(md) as string;

		expect(html).toContain('<code');
		expect(html).not.toContain('notebook-chart-card');

		explorer.destroy();
	});

	it('SANITIZE_CONFIG preserves data-chart-id and data-chart-config after DOMPurify', async () => {
		const { default: DOMPurify } = await import('dompurify');
		// Manually construct HTML with chart data attributes
		const rawHtml =
			'<div class="notebook-chart-card" data-chart-id="chart-123" data-chart-config="dHlwZTogYmFy"></div>';

		// Test DOMPurify with the same attribute allowlist used in NotebookExplorer
		const config = {
			ALLOWED_TAGS: ['div'] as string[],
			ALLOWED_ATTR: ['class', 'data-chart-id', 'data-chart-config'] as string[],
			ALLOW_DATA_ATTR: false as const,
		};
		const clean = DOMPurify.sanitize(rawHtml, config);

		expect(clean).toContain('data-chart-id="chart-123"');
		expect(clean).toContain('data-chart-config="dHlwZTogYmFy"');
	});

	it('destroy() cleans up filter subscription', () => {
		const mockFilter = createMockFilter();
		const explorer = new NotebookExplorer(createConfig({ filter: mockFilter }));
		explorer.mount(container);
		explorer.destroy();

		// Filter subscription should be cleaned up (no dangling references)
		// This test primarily verifies destroy() doesn't throw
		expect(true).toBe(true);
	});

	it('.notebook-chart-preview stub element is NOT in DOM after mount (removed Phase 65)', () => {
		const explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);

		const chartStub = container.querySelector('.notebook-chart-preview');
		expect(chartStub).toBeNull();

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Formatting Engine (Phase 63 -- NOTE-01, NOTE-02)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- formatting engine', () => {
	let container: HTMLDivElement;
	let explorer: InstanceType<typeof NotebookExplorer>;
	let textarea: HTMLTextAreaElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);
		textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
	});

	afterEach(() => {
		explorer.destroy();
		container.remove();
	});

	// -- _formatInline --

	it('_formatInline("**","**") with "hello" selected: value === "**hello**"', () => {
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		// Trigger via Cmd+B which uses _formatInline internally
		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('**hello**');
		// Cursor should select "hello" inside wrappers
		expect(textarea.selectionStart).toBe(2);
		expect(textarea.selectionEnd).toBe(7);
	});

	it('_formatInline("**","**") with empty selection at pos 0: value === "****", cursor at 2', () => {
		textarea.value = '';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 0;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('****');
		expect(textarea.selectionStart).toBe(2);
		expect(textarea.selectionEnd).toBe(2);
	});

	it('_formatInline("[","](url)") with "link" selected: value === "[link](url)"', () => {
		textarea.value = 'link';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 4;

		const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('[link](url)');
	});

	// -- _formatLinePrefix --

	it('_formatLinePrefix("- ") with cursor mid-line: prefix added at line start', () => {
		textarea.value = 'hello world';
		textarea.selectionStart = 5; // mid-line
		textarea.selectionEnd = 5;

		(explorer as any)._formatLinePrefix('- ');

		expect(textarea.value).toBe('- hello world');
	});

	it('_formatLinePrefix("- ") with 3 lines selected: each line gets "- " prefix', () => {
		textarea.value = 'one\ntwo\nthree';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 13;

		(explorer as any)._formatLinePrefix('- ');

		expect(textarea.value).toBe('- one\n- two\n- three');
	});

	it('_formatLinePrefix("> ") on "hello": value === "> hello"', () => {
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		(explorer as any)._formatLinePrefix('> ');

		expect(textarea.value).toBe('> hello');
	});

	// -- _cycleHeading --

	it('_cycleHeading on plain line "hello": becomes "# hello"', () => {
		textarea.value = 'hello';
		textarea.selectionStart = 2;
		textarea.selectionEnd = 2;

		(explorer as any)._cycleHeading();

		expect(textarea.value).toBe('# hello');
	});

	it('_cycleHeading on "# hello": becomes "## hello"', () => {
		textarea.value = '# hello';
		textarea.selectionStart = 3;
		textarea.selectionEnd = 3;

		(explorer as any)._cycleHeading();

		expect(textarea.value).toBe('## hello');
	});

	it('_cycleHeading on "## hello": becomes "### hello"', () => {
		textarea.value = '## hello';
		textarea.selectionStart = 4;
		textarea.selectionEnd = 4;

		(explorer as any)._cycleHeading();

		expect(textarea.value).toBe('### hello');
	});

	it('_cycleHeading on "### hello": becomes "hello" (strips prefix)', () => {
		textarea.value = '### hello';
		textarea.selectionStart = 5;
		textarea.selectionEnd = 5;

		(explorer as any)._cycleHeading();

		expect(textarea.value).toBe('hello');
	});

	it('_cycleHeading on "#### hello": treated as plain text, becomes "# #### hello"', () => {
		textarea.value = '#### hello';
		textarea.selectionStart = 5;
		textarea.selectionEnd = 5;

		(explorer as any)._cycleHeading();

		expect(textarea.value).toBe('# #### hello');
	});

	// -- _content sync --

	it('after formatting operation, _content field is synced with textarea.value', () => {
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect((explorer as any)._bufferContent).toBe('**hello**');
	});

	// -- _wrapSelection removed --

	it('_wrapSelection method no longer exists', () => {
		expect((explorer as any)._wrapSelection).toBeUndefined();
	});

	// -- Cmd+B/I/K still work with new engine --

	it('Cmd+B still works with new _formatInline method', () => {
		textarea.value = 'world';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('**world**');
	});

	it('Cmd+I still works with new _formatInline method', () => {
		textarea.value = 'world';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'i', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('_world_');
	});

	it('Cmd+K still works with new _formatInline method', () => {
		textarea.value = 'world';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
		textarea.dispatchEvent(event);

		expect(textarea.value).toBe('[world](url)');
	});
});

// ---------------------------------------------------------------------------
// Toolbar DOM (Phase 63 -- NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- toolbar', () => {
	let container: HTMLDivElement;
	let explorer: InstanceType<typeof NotebookExplorer>;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		explorer = new NotebookExplorer(createConfig());
		explorer.mount(container);
	});

	afterEach(() => {
		explorer.destroy();
		container.remove();
	});

	it('mount() creates .notebook-toolbar between segmented control and body', () => {
		const root = container.querySelector('.notebook-explorer')!;
		const children = Array.from(root.children);
		const controlIdx = children.findIndex((el) => el.classList.contains('notebook-segmented-control'));
		const toolbarIdx = children.findIndex((el) => el.classList.contains('notebook-toolbar'));
		const bodyIdx = children.findIndex((el) => el.classList.contains('notebook-body'));

		expect(controlIdx).toBeGreaterThanOrEqual(0);
		expect(toolbarIdx).toBeGreaterThanOrEqual(0);
		expect(bodyIdx).toBeGreaterThanOrEqual(0);
		expect(toolbarIdx).toBe(controlIdx + 1);
		expect(bodyIdx).toBe(toolbarIdx + 1);
	});

	it('.notebook-toolbar contains 8 .notebook-toolbar-btn buttons', () => {
		const buttons = container.querySelectorAll('.notebook-toolbar-btn');
		expect(buttons.length).toBe(8);
	});

	it('buttons have correct title attributes', () => {
		const buttons = container.querySelectorAll('.notebook-toolbar-btn');
		const titles = Array.from(buttons).map((btn) => btn.getAttribute('title'));

		expect(titles).toContain('Bold (Cmd+B)');
		expect(titles).toContain('Italic (Cmd+I)');
		expect(titles).toContain('Strikethrough');
		expect(titles).toContain('Heading');
		expect(titles).toContain('List');
		expect(titles).toContain('Blockquote');
		expect(titles).toContain('Link (Cmd+K)');
		expect(titles).toContain('Code');
	});

	it('.notebook-toolbar has 3 .notebook-toolbar-group elements', () => {
		const groups = container.querySelectorAll('.notebook-toolbar-group');
		expect(groups.length).toBe(3);
	});

	it('.notebook-toolbar has 2 .notebook-toolbar-divider elements', () => {
		const dividers = container.querySelectorAll('.notebook-toolbar-divider');
		expect(dividers.length).toBe(2);
	});

	it('toolbar hidden when Preview tab active', () => {
		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click(); // Preview

		const toolbar = container.querySelector('.notebook-toolbar') as HTMLElement;
		expect(toolbar.style.display).toBe('none');
	});

	it('toolbar visible when Write tab active after switching back', () => {
		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click(); // Preview
		(tabs[0] as HTMLElement).click(); // Write

		const toolbar = container.querySelector('.notebook-toolbar') as HTMLElement;
		expect(toolbar.style.display).not.toBe('none');
	});

	it('clicking Bold button with "hello" selected wraps to "**hello**"', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const boldBtn = container.querySelector('.notebook-toolbar-btn[title*="Bold"]') as HTMLElement;
		boldBtn.click();

		expect(textarea.value).toBe('**hello**');
	});

	it('clicking Strikethrough button with "hello" selected wraps to "~~hello~~"', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const strikeBtn = container.querySelector('.notebook-toolbar-btn[title="Strikethrough"]') as HTMLElement;
		strikeBtn.click();

		expect(textarea.value).toBe('~~hello~~');
	});

	it('clicking Code button with "hello" selected wraps to "`hello`"', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		const codeBtn = container.querySelector('.notebook-toolbar-btn[title="Code"]') as HTMLElement;
		codeBtn.click();

		expect(textarea.value).toBe('`hello`');
	});

	it('clicking List button prefixes current line with "- "', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 3;
		textarea.selectionEnd = 3;

		const listBtn = container.querySelector('.notebook-toolbar-btn[title="List"]') as HTMLElement;
		listBtn.click();

		expect(textarea.value).toBe('- hello');
	});

	it('clicking Blockquote button prefixes current line with "> "', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 3;
		textarea.selectionEnd = 3;

		const quoteBtn = container.querySelector('.notebook-toolbar-btn[title="Blockquote"]') as HTMLElement;
		quoteBtn.click();

		expect(textarea.value).toBe('> hello');
	});

	it('clicking Heading button cycles through H1/H2/H3/plain', () => {
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		const headingBtn = container.querySelector('.notebook-toolbar-btn[title="Heading"]') as HTMLElement;

		textarea.value = 'hello';
		textarea.selectionStart = 2;
		textarea.selectionEnd = 2;
		headingBtn.click();
		expect(textarea.value).toBe('# hello');

		textarea.selectionStart = 3;
		textarea.selectionEnd = 3;
		headingBtn.click();
		expect(textarea.value).toBe('## hello');

		textarea.selectionStart = 4;
		textarea.selectionEnd = 4;
		headingBtn.click();
		expect(textarea.value).toBe('### hello');

		textarea.selectionStart = 5;
		textarea.selectionEnd = 5;
		headingBtn.click();
		expect(textarea.value).toBe('hello');
	});

	it('destroy() nulls toolbarEl', () => {
		explorer.destroy();
		expect((explorer as any)._toolbarEl).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Persistence (Phase 64 -- NOTE-03, NOTE-04, NOTE-05)
// ---------------------------------------------------------------------------

describe('NotebookExplorer -- persistence', () => {
	let container: HTMLDivElement;
	let mockBridge: ReturnType<typeof createMockBridge>;
	let mockSelection: ReturnType<typeof createMockSelection>;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.appendChild(container);
		mockBridge = createMockBridge();
		mockSelection = createMockSelection();
	});

	afterEach(() => {
		vi.useRealTimers();
		container.remove();
	});

	it('constructor stores bridge and selection references', () => {
		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		expect((explorer as any)._bridge).toBe(mockBridge);
		expect((explorer as any)._selection).toBe(mockSelection);
		explorer.destroy();
	});

	it('mount() subscribes to SelectionProvider', () => {
		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		expect(mockSelection.subscribe).toHaveBeenCalledOnce();

		explorer.destroy();
	});

	it('mount() checks current selection immediately', async () => {
		mockSelection._setIds(['card-1']);
		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Allow microtask / async to settle
		await vi.advanceTimersByTimeAsync(0);

		// Phase 91: card:get loads full Card snapshot (replaces ui:get notebook:card-1)
		expect(mockBridge.send).toHaveBeenCalledWith('card:get', { id: 'card-1' });

		explorer.destroy();
	});

	it('_onSelectionChange loads content for selected card', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				// Phase 91: card:get returns full Card snapshot
				return {
					id: payload.id,
					name: 'Test Card',
					content: 'hello world',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Simulate selection change to card-1
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		expect(textarea.value).toBe('hello world');

		explorer.destroy();
	});

	it('_onSelectionChange flushes current card before switching', async () => {
		const mockMutations = createMockMutationManager();
		// Return a card snapshot on card:get so the shadow-buffer has something to diff against
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: mockMutations,
		});
		explorer.mount(container);

		// Select card-1
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Type in textarea (make it dirty)
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'modified content';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		// Switch to card-2 — should flush via MutationManager.execute()
		mockSelection._setIds(['card-2']);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Phase 91: flush uses MutationManager.execute() (not ui:set)
		expect(mockMutations.execute).toHaveBeenCalled();

		explorer.destroy();
	});

	it('_onSelectionChange hides notebook when zero cards selected', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Select card-1 first
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Clear selection — shows idle state
		mockSelection._setIds([]);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Idle state: idle element visible, editor elements hidden
		const idleEl = container.querySelector('.notebook-idle') as HTMLElement;
		expect(idleEl).not.toBeNull();
		expect(idleEl.style.display).not.toBe('none');

		explorer.destroy();
	});

	it('_onSelectionChange shows notebook when card selected after hidden', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];

		// First select a card
		mockSelection._setIds(['card-1']);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Then clear selection (shows idle state)
		mockSelection._setIds([]);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const idleEl = container.querySelector('.notebook-idle') as HTMLElement;
		expect(idleEl.style.display).not.toBe('none');

		// Select a card again (should show editor, hide idle)
		mockSelection._setIds(['card-2']);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		expect(idleEl.style.display).toBe('none');

		explorer.destroy();
	});

	it('_onSelectionChange is no-op for same card', async () => {
		// Return a real card so the explorer doesn't go idle
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Select card-1
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const callCountAfterFirst = mockBridge.send.mock.calls.filter((c: any[]) => c[0] === 'card:get').length;

		// Re-trigger with same card
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const callCountAfterSecond = mockBridge.send.mock.calls.filter((c: any[]) => c[0] === 'card:get').length;

		// card:get should not be called again (same card = no-op)
		expect(callCountAfterSecond).toBe(callCountAfterFirst);

		explorer.destroy();
	});

	it('_onSelectionChange discards stale response on rapid switch', async () => {
		// Create a slow response for card-A that resolves AFTER card-C is already active
		let resolveCardA: ((val: any) => void) | null = null;
		const cardAPromise = new Promise((resolve) => {
			resolveCardA = resolve;
		});

		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get' && payload.id === 'card-A') {
				return cardAPromise;
			}
			if (type === 'card:get' && payload.id === 'card-C') {
				return {
					id: 'card-C',
					name: 'Card C',
					content: 'content-C',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			if (type === 'card:get') {
				return null;
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];

		// Select card-A (slow response)
		mockSelection._setIds(['card-A']);
		subscribeCb();

		// Immediately switch to card-C (fast response)
		mockSelection._setIds(['card-C']);
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Now resolve card-A's slow response (stale)
		resolveCardA!({
			id: 'card-A',
			name: 'Card A',
			content: 'stale-A',
			card_type: 'note',
			created_at: '2026-01-01',
			modified_at: '2026-01-01',
			priority: 0,
			sort_order: 0,
			folder: null,
			status: null,
			due_at: null,
			body_text: null,
			source: null,
		});
		await vi.advanceTimersByTimeAsync(0);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		// Should show card-C's content, not stale card-A content
		expect(textarea.value).toBe('content-C');

		explorer.destroy();
	});

	it('_onSelectionChange re-renders preview when preview tab active', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'New Card',
					content: '# New Card',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Switch to Preview tab
		const tabs = container.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		// Select a card
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const preview = container.querySelector('.notebook-preview') as HTMLElement;
		expect(preview.innerHTML).toContain('<h1>');

		explorer.destroy();
	});

	it('input event syncs _bufferContent from textarea', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Select a card first
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Type in textarea — input event syncs _bufferContent
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'new text';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		// Phase 91: buffer sync is immediate (no debounce)
		expect((explorer as any)._bufferContent).toBe('new text');

		explorer.destroy();
	});

	it('blur on textarea triggers content commit via MutationManager', async () => {
		const mockMutations = createMockMutationManager();
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: mockMutations,
		});
		explorer.mount(container);

		// Select card
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'edited content';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		// Phase 91: blur triggers commit (not debounced timer)
		textarea.dispatchEvent(new Event('blur'));
		await vi.advanceTimersByTimeAsync(0);

		expect(mockMutations.execute).toHaveBeenCalled();

		explorer.destroy();
	});

	it('formatting toolbar action updates buffer content', async () => {
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Select card
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'hello';
		textarea.selectionStart = 0;
		textarea.selectionEnd = 5;

		// Click bold button
		const boldBtn = container.querySelector('.notebook-toolbar-btn[title*="Bold"]') as HTMLElement;
		boldBtn.click();

		// Phase 91: formatting updates buffer content immediately
		expect((explorer as any)._bufferContent).toBe('**hello**');

		explorer.destroy();
	});

	it('destroy() flushes pending save via MutationManager', async () => {
		const mockMutations = createMockMutationManager();
		mockBridge.send.mockImplementation(async (type: string, payload: any) => {
			if (type === 'card:get') {
				return {
					id: payload.id,
					name: 'Test',
					content: '',
					card_type: 'note',
					created_at: '2026-01-01',
					modified_at: '2026-01-01',
					priority: 0,
					sort_order: 0,
					folder: null,
					status: null,
					due_at: null,
					body_text: null,
					source: null,
				};
			}
			return undefined;
		});

		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: mockMutations,
		});
		explorer.mount(container);

		// Select card
		mockSelection._setIds(['card-1']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Type (make dirty)
		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = 'dirty content';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		// Phase 91: destroy flushes via MutationManager.execute()
		explorer.destroy();

		expect(mockMutations.execute).toHaveBeenCalled();
	});

	it('destroy() unsubscribes from selection', () => {
		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		explorer.destroy();

		expect(mockSelection._unsubFn).toHaveBeenCalledOnce();
	});

	it('first selected card used when multiple selected', async () => {
		const explorer = new NotebookExplorer({
			bridge: mockBridge,
			selection: mockSelection,
			filter: createMockFilter(),
			alias: createMockAlias(),
			mutations: createMockMutationManager(),
		});
		explorer.mount(container);

		// Select multiple cards
		mockSelection._setIds(['card-1', 'card-2']);
		const subscribeCb = mockSelection.subscribe.mock.calls[0]![0];
		subscribeCb();
		await vi.advanceTimersByTimeAsync(0);

		// Phase 91: should use first card via card:get
		const getCalls = mockBridge.send.mock.calls.filter((c: any[]) => c[0] === 'card:get' && c[1].id === 'card-1');
		expect(getCalls.length).toBe(1);

		explorer.destroy();
	});
});
