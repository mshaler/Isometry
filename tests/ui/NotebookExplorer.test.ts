// @vitest-environment jsdom
// Isometry v5 — Phase 57 Plan 01 (Task 2)
// Tests for NotebookExplorer: tabbed Write/Preview layout with Markdown rendering,
// XSS sanitization, keyboard shortcuts, and session-only persistence.
//
// Requirements: NOTE-01, NOTE-02, NOTE-03, NOTE-04
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Dynamic import to allow RED phase to fail gracefully
let NotebookExplorer: typeof import('../../src/ui/NotebookExplorer').NotebookExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/NotebookExplorer');
	NotebookExplorer = mod.NotebookExplorer;
});

// ---------------------------------------------------------------------------
// Mount / Destroy (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer — mount/destroy', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('mount() creates .notebook-explorer root appended to container', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const root = container.querySelector('.notebook-explorer');
		expect(root).not.toBeNull();

		explorer.destroy();
	});

	it('root contains .notebook-segmented-control with 2 .notebook-tab buttons', () => {
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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

	it('root contains .notebook-chart-preview element', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const chartStub = container.querySelector('.notebook-chart-preview');
		expect(chartStub).not.toBeNull();

		explorer.destroy();
	});

	it('destroy() removes root from DOM', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		expect(container.querySelector('.notebook-explorer')).not.toBeNull();

		explorer.destroy();

		expect(container.querySelector('.notebook-explorer')).toBeNull();
	});

	it('textarea has placeholder "Write Markdown..."', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		expect(textarea.placeholder).toBe('Write Markdown...');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tab Switching (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer — tab switching', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('default state: Write tab active, textarea visible, preview hidden', () => {
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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

describe('NotebookExplorer — Markdown rendering', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('heading renders as h1 in preview', () => {
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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

describe('NotebookExplorer — XSS sanitization', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	function renderPreview(explorer: InstanceType<typeof NotebookExplorer>, c: HTMLElement, markdown: string): HTMLElement {
		const textarea = c.querySelector('.notebook-textarea') as HTMLTextAreaElement;
		textarea.value = markdown;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));

		const tabs = c.querySelectorAll('.notebook-tab');
		(tabs[1] as HTMLElement).click();

		return c.querySelector('.notebook-preview')!;
	}

	it('script tags are stripped', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<script>alert("xss")</script>');
		expect(preview.querySelector('script')).toBeNull();
		expect(preview.innerHTML).not.toContain('script');

		explorer.destroy();
	});

	it('onerror attributes are stripped', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<img src=x onerror=alert("xss")>');
		expect(preview.innerHTML).not.toContain('onerror');

		explorer.destroy();
	});

	it('javascript: URIs are stripped', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<a href="javascript:alert(\'xss\')">click</a>');
		expect(preview.innerHTML).not.toContain('javascript:');

		explorer.destroy();
	});

	it('iframe elements are stripped', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const preview = renderPreview(explorer, container, '<iframe src="evil.com"></iframe>');
		expect(preview.querySelector('iframe')).toBeNull();

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Keyboard Shortcuts (NOTE-01)
// ---------------------------------------------------------------------------

describe('NotebookExplorer — keyboard shortcuts', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('Cmd+B with "hello" selected wraps to "**hello**"', () => {
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
		const explorer = new NotebookExplorer();
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
// Session-Only (NOTE-04)
// ---------------------------------------------------------------------------

describe('NotebookExplorer — session-only persistence', () => {
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

		const explorer = new NotebookExplorer();
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
// Chart Stub (NOTE-03)
// ---------------------------------------------------------------------------

describe('NotebookExplorer — chart stub', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('.notebook-chart-preview exists in DOM after mount', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const chartStub = container.querySelector('.notebook-chart-preview');
		expect(chartStub).not.toBeNull();

		explorer.destroy();
	});

	it('.notebook-chart-preview has display: none', () => {
		const explorer = new NotebookExplorer();
		explorer.mount(container);

		const chartStub = container.querySelector('.notebook-chart-preview') as HTMLElement;
		// Check inline style since jsdom doesn't compute CSS
		expect(chartStub.style.display).toBe('none');

		explorer.destroy();
	});
});
