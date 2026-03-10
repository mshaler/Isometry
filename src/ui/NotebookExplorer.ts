// Isometry v5 -- Phase 57 Plan 01 + Phase 64 Plan 01 + Phase 65 Plan 02
// NotebookExplorer: tabbed Write/Preview layout with Markdown rendering,
// XSS sanitization via DOMPurify, keyboard shortcuts, formatting toolbar,
// per-card persistence via ui_state with selection-driven card binding,
// and D3 chart blocks via marked renderer extension + ChartRenderer.
//
// Requirements: NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - Tabbed toggle (Write | Preview) via segmented control
//   - Plain <textarea> editor with system font (NOT monospace)
//   - Preview renders Markdown through marked.parse() -> DOMPurify.sanitize() -> innerHTML
//   - Two-pass chart rendering: DOMPurify sanitizes placeholder divs, then D3 mounts SVG (NOTE-08)
//   - marked.use() renderer extension intercepts ```chart code blocks -> placeholder divs
//   - ChartRenderer queries Worker and renders D3 SVGs into sanitized placeholders
//   - FilterProvider subscription enables live chart updates on Preview tab (NOTE-07)
//   - Cmd+B/I/K handled via textarea-local keydown (NOT ShortcutRegistry -- input guard skips TEXTAREA)
//   - Per-card content persisted to ui_state via bridge.send('ui:set', { key: 'notebook:{cardId}' })
//   - SelectionProvider subscription drives card binding -- card switch flushes old content, loads new
//   - 500ms debounced auto-save on input events and formatting toolbar actions

import '../styles/notebook-explorer.css';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { AliasProvider } from '../providers/AliasProvider';
import type { FilterProvider } from '../providers/FilterProvider';
import type { SelectionProvider } from '../providers/SelectionProvider';
import type { WorkerBridge } from '../worker/WorkerBridge';
import { ChartRenderer } from './charts/ChartRenderer';

// ---------------------------------------------------------------------------
// DOMPurify sanitization config -- strict allowlist for WKWebView context
// ---------------------------------------------------------------------------

const SANITIZE_CONFIG = {
	ALLOWED_TAGS: [
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'p',
		'br',
		'hr',
		'ul',
		'ol',
		'li',
		'blockquote',
		'pre',
		'code',
		'strong',
		'em',
		'del',
		's',
		'a',
		'img',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'input', // GFM task list checkboxes
		'div',
		'span',
	],
	ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'type', 'checked', 'disabled', 'data-chart-id', 'data-chart-config'],
	ALLOW_DATA_ATTR: false,
	FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
	FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style'],
};

// ---------------------------------------------------------------------------
// Marked renderer extension -- intercept ```chart fenced code blocks (NOTE-06)
// ---------------------------------------------------------------------------

let _markedChartExtensionRegistered = false;

function _registerChartExtension(): void {
	if (_markedChartExtensionRegistered) return;
	_markedChartExtensionRegistered = true;
	marked.use({
		renderer: {
			code({ text, lang }: { text: string; lang?: string }) {
				if (lang === 'chart') {
					const chartId = `chart-${crypto.randomUUID()}`;
					const encodedConfig = btoa(text);
					return `<div class="notebook-chart-card" data-chart-id="${chartId}" data-chart-config="${encodedConfig}"></div>`;
				}
				return false; // Fall through to default renderer for non-chart code blocks
			},
		},
	});
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface NotebookExplorerConfig {
	bridge: WorkerBridge;
	selection: SelectionProvider;
	filter: FilterProvider;
	alias: AliasProvider;
}

// ---------------------------------------------------------------------------
// NotebookExplorer
// ---------------------------------------------------------------------------

/**
 * NotebookExplorer provides a tabbed Write/Preview Markdown notebook
 * embedded in the workbench panel rail.
 *
 * Per-card: content backed by ui_state (notebook:{cardId}).
 * SelectionProvider drives card binding -- card switch flushes and loads.
 */
export class NotebookExplorer {
	private readonly _bridge: WorkerBridge;
	private readonly _selection: SelectionProvider;
	private readonly _filter: FilterProvider;
	private readonly _alias: AliasProvider;
	private _rootEl: HTMLElement | null = null;
	private _textareaEl: HTMLTextAreaElement | null = null;
	private _previewEl: HTMLElement | null = null;
	private _writeTabEl: HTMLElement | null = null;
	private _previewTabEl: HTMLElement | null = null;
	private _toolbarEl: HTMLElement | null = null;
	private _activeTab: 'write' | 'preview' = 'write';
	private _content = ''; // Backed by ui_state (notebook:{cardId})
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private _activeCardId: string | null = null;
	private _dirty = false;
	private _saveTimer: ReturnType<typeof setTimeout> | null = null;
	private _unsubscribeSelection: (() => void) | null = null;
	private _chartRenderer: ChartRenderer | null = null;
	private _unsubscribeFilter: (() => void) | null = null;

	constructor(config: NotebookExplorerConfig) {
		this._bridge = config.bridge;
		this._selection = config.selection;
		this._filter = config.filter;
		this._alias = config.alias;

		// Register marked chart extension (idempotent)
		_registerChartExtension();
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		// 1. Create .notebook-explorer root
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'notebook-explorer';

		// 2. Segmented control (Write | Preview tabs)
		const controlEl = document.createElement('div');
		controlEl.className = 'notebook-segmented-control';

		this._writeTabEl = document.createElement('button');
		this._writeTabEl.className = 'notebook-tab notebook-tab--active';
		this._writeTabEl.textContent = 'Write';
		this._writeTabEl.setAttribute('aria-pressed', 'true');
		this._writeTabEl.addEventListener('click', () => this._switchTab('write'));

		this._previewTabEl = document.createElement('button');
		this._previewTabEl.className = 'notebook-tab';
		this._previewTabEl.textContent = 'Preview';
		this._previewTabEl.setAttribute('aria-pressed', 'false');
		this._previewTabEl.addEventListener('click', () => this._switchTab('preview'));

		controlEl.appendChild(this._writeTabEl);
		controlEl.appendChild(this._previewTabEl);
		this._rootEl.appendChild(controlEl);

		// 2b. Formatting toolbar (visible in Write mode only)
		this._toolbarEl = this._createToolbar();
		this._rootEl.appendChild(this._toolbarEl);

		// 3. Body container
		const bodyEl = document.createElement('div');
		bodyEl.className = 'notebook-body';

		// 3a. Textarea -- visible initially
		this._textareaEl = document.createElement('textarea');
		this._textareaEl.className = 'notebook-textarea';
		this._textareaEl.placeholder = 'Write Markdown...';
		this._textareaEl.rows = 8;

		// Sync content on input + trigger debounced save
		this._textareaEl.addEventListener('input', () => {
			this._content = this._textareaEl!.value;
			this._scheduleSave();
		});

		// 3b. Preview -- hidden initially
		this._previewEl = document.createElement('div');
		this._previewEl.className = 'notebook-preview';
		this._previewEl.style.display = 'none';

		bodyEl.appendChild(this._textareaEl);
		bodyEl.appendChild(this._previewEl);
		this._rootEl.appendChild(bodyEl);

		// 4. Keyboard shortcuts on textarea (Cmd+B/I/K)
		this._keydownHandler = (e: KeyboardEvent) => {
			const cmd = e.metaKey || e.ctrlKey;
			if (!cmd) return;

			if (e.key === 'b') {
				e.preventDefault();
				this._formatInline('**', '**');
			} else if (e.key === 'i') {
				e.preventDefault();
				this._formatInline('_', '_');
			} else if (e.key === 'k') {
				e.preventDefault();
				this._formatInline('[', '](url)');
			}
		};
		this._textareaEl.addEventListener('keydown', this._keydownHandler);

		// 5. Append to container
		container.appendChild(this._rootEl);

		// 6. Subscribe to SelectionProvider and check current selection
		this._unsubscribeSelection = this._selection.subscribe(() => {
			void this._onSelectionChange();
		});
		void this._onSelectionChange();
	}

	destroy(): void {
		// Flush pending save synchronously (fire-and-forget)
		if (this._dirty && this._activeCardId !== null) {
			this._cancelSave();
			void this._bridge.send('ui:set', {
				key: `notebook:${this._activeCardId}`,
				value: this._content,
			});
			this._dirty = false;
		}

		// Cancel debounce timer
		this._cancelSave();

		// Unsubscribe from selection
		if (this._unsubscribeSelection) {
			this._unsubscribeSelection();
			this._unsubscribeSelection = null;
		}

		// Unsubscribe from filter
		this._unsubscribeFilter?.();
		this._unsubscribeFilter = null;

		// Destroy chart renderer
		this._chartRenderer?.destroyCharts();
		this._chartRenderer = null;

		// Remove keydown listener
		if (this._textareaEl && this._keydownHandler) {
			this._textareaEl.removeEventListener('keydown', this._keydownHandler);
		}
		this._keydownHandler = null;

		// Remove from DOM
		this._rootEl?.remove();

		// Null out references
		this._rootEl = null;
		this._textareaEl = null;
		this._previewEl = null;
		this._writeTabEl = null;
		this._previewTabEl = null;
		this._toolbarEl = null;
	}

	// -----------------------------------------------------------------------
	// Selection-driven card binding
	// -----------------------------------------------------------------------

	private async _onSelectionChange(): Promise<void> {
		const ids = this._selection.getSelectedIds();
		const newCardId = ids.length > 0 ? ids[0]! : null;

		if (newCardId === this._activeCardId) return; // Same card, no-op

		// 1. Flush current card's content immediately (bypass debounce)
		if (this._activeCardId !== null && this._dirty) {
			this._cancelSave();
			await this._bridge.send('ui:set', {
				key: `notebook:${this._activeCardId}`,
				value: this._content,
			});
			this._dirty = false;
		}

		// 2. Update active card
		this._activeCardId = newCardId;

		// 3. Handle zero selection -- hide notebook body
		if (newCardId === null) {
			this._setVisible(false);
			this._content = '';
			if (this._textareaEl) {
				this._textareaEl.value = '';
			}
			return;
		}

		// 4. Show notebook and clear textarea synchronously (prevent flash of old content)
		this._setVisible(true);
		if (this._textareaEl) {
			this._textareaEl.value = '';
		}

		// 5. Load new card's content from ui_state
		const result = await this._bridge.send('ui:get', {
			key: `notebook:${newCardId}`,
		});

		// 6. Guard against stale response (rapid card switching)
		if (this._activeCardId !== newCardId) return;

		// 7. Apply loaded content
		this._content = result.value ?? '';
		this._dirty = false;
		if (this._textareaEl) {
			this._textareaEl.value = this._content;
		}

		// 8. If on Preview tab, re-render preview with new card's content
		if (this._activeTab === 'preview') {
			this._renderPreview();
		}
	}

	// -----------------------------------------------------------------------
	// Debounced auto-save
	// -----------------------------------------------------------------------

	private _scheduleSave(): void {
		this._dirty = true;
		if (this._saveTimer !== null) {
			clearTimeout(this._saveTimer);
		}
		this._saveTimer = setTimeout(() => {
			this._saveTimer = null;
			if (this._activeCardId === null) return;
			void this._bridge.send('ui:set', {
				key: `notebook:${this._activeCardId}`,
				value: this._content,
			});
			this._dirty = false;
		}, 500);
	}

	private _cancelSave(): void {
		if (this._saveTimer !== null) {
			clearTimeout(this._saveTimer);
			this._saveTimer = null;
		}
	}

	private _setVisible(visible: boolean): void {
		if (this._rootEl) {
			this._rootEl.style.display = visible ? '' : 'none';
		}
	}

	// -----------------------------------------------------------------------
	// Tab switching
	// -----------------------------------------------------------------------

	private _switchTab(tab: 'write' | 'preview'): void {
		if (this._activeTab === tab) return;
		this._activeTab = tab;

		if (tab === 'write') {
			// Stop filter subscription -- no chart queries while on Write tab
			this._unsubscribeFilter?.();
			this._unsubscribeFilter = null;

			// Show textarea and toolbar, hide preview
			this._textareaEl!.style.display = '';
			this._previewEl!.style.display = 'none';
			this._toolbarEl!.style.display = '';

			// Restore content
			this._textareaEl!.value = this._content;

			// Update tab states
			this._writeTabEl!.classList.add('notebook-tab--active');
			this._writeTabEl!.setAttribute('aria-pressed', 'true');
			this._previewTabEl!.classList.remove('notebook-tab--active');
			this._previewTabEl!.setAttribute('aria-pressed', 'false');
		} else {
			// Sync content from textarea before switching
			this._content = this._textareaEl!.value;

			// IMPORTANT: Show preview FIRST so chart containers have non-zero
			// clientWidth when D3 renders. mountCharts is async (Worker query),
			// but the initial innerHTML + querySelectorAll runs synchronously.
			this._textareaEl!.style.display = 'none';
			this._previewEl!.style.display = '';
			this._toolbarEl!.style.display = 'none';

			// Render preview (now that preview is visible)
			this._renderPreview();

			// Start filter subscription for live chart updates (NOTE-07)
			this._unsubscribeFilter?.();
			this._unsubscribeFilter = this._chartRenderer?.startFilterSubscription() ?? null;

			// Update tab states
			this._previewTabEl!.classList.add('notebook-tab--active');
			this._previewTabEl!.setAttribute('aria-pressed', 'true');
			this._writeTabEl!.classList.remove('notebook-tab--active');
			this._writeTabEl!.setAttribute('aria-pressed', 'false');
		}
	}

	// -----------------------------------------------------------------------
	// Markdown rendering pipeline
	// -----------------------------------------------------------------------

	private _renderPreview(): void {
		const rawHtml = marked.parse(this._content) as string;
		const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
		this._previewEl!.innerHTML = cleanHtml;

		// Pass 2: Mount D3 charts into sanitized placeholder divs (NOTE-08)
		if (!this._chartRenderer) {
			this._chartRenderer = new ChartRenderer({
				bridge: this._bridge,
				filter: this._filter,
				alias: this._alias,
			});
		}
		this._chartRenderer.destroyCharts(); // Clean previous charts
		void this._chartRenderer.mountCharts(this._previewEl!);
	}

	// -----------------------------------------------------------------------
	// Toolbar DOM (Phase 63 -- NOTE-01)
	// 8 buttons in 3 groups separated by dividers, visible in Write mode only
	// -----------------------------------------------------------------------

	private _createToolbar(): HTMLElement {
		const toolbar = document.createElement('div');
		toolbar.className = 'notebook-toolbar';

		// Group 1: Text style (bold, italic, strikethrough)
		const textGroup = this._createButtonGroup([
			{ label: 'B', title: 'Bold (Cmd+B)', action: () => this._formatInline('**', '**') },
			{ label: 'I', title: 'Italic (Cmd+I)', action: () => this._formatInline('_', '_') },
			{ label: 'S', title: 'Strikethrough', action: () => this._formatInline('~~', '~~') },
		]);
		toolbar.appendChild(textGroup);

		toolbar.appendChild(this._createDivider());

		// Group 2: Structure (heading, list, blockquote)
		const structGroup = this._createButtonGroup([
			{ label: 'H', title: 'Heading', action: () => this._cycleHeading() },
			{ label: '\u2022', title: 'List', action: () => this._formatLinePrefix('- ') },
			{ label: '>', title: 'Blockquote', action: () => this._formatLinePrefix('> ') },
		]);
		toolbar.appendChild(structGroup);

		toolbar.appendChild(this._createDivider());

		// Group 3: Insert (link, code)
		const insertGroup = this._createButtonGroup([
			{ label: '\uD83D\uDD17', title: 'Link (Cmd+K)', action: () => this._formatInline('[', '](url)') },
			{ label: '</>', title: 'Code', action: () => this._formatInline('`', '`') },
		]);
		toolbar.appendChild(insertGroup);

		return toolbar;
	}

	private _createButtonGroup(buttons: Array<{ label: string; title: string; action: () => void }>): HTMLElement {
		const group = document.createElement('div');
		group.className = 'notebook-toolbar-group';

		for (const btn of buttons) {
			const button = document.createElement('button');
			button.className = 'notebook-toolbar-btn';
			button.type = 'button';
			button.textContent = btn.label;
			button.title = btn.title;
			button.addEventListener('click', btn.action);
			group.appendChild(button);
		}

		return group;
	}

	private _createDivider(): HTMLElement {
		const divider = document.createElement('span');
		divider.className = 'notebook-toolbar-divider';
		return divider;
	}

	// -----------------------------------------------------------------------
	// Undo-safe formatting engine (Phase 63 -- NOTE-01, NOTE-02)
	// Replaces _wrapSelection() -- uses execCommand('insertText') with
	// contentEditable trick to preserve native browser undo stack.
	// -----------------------------------------------------------------------

	/**
	 * Insert text at the current selection, preserving the native undo stack.
	 * Uses the contentEditable + execCommand('insertText') trick from
	 * GitHub's markdown-toolbar-element.
	 */
	private _undoSafeInsert(text: string): void {
		const textarea = this._textareaEl!;
		textarea.focus();

		// Save selection before contentEditable toggle (may reset in some WebKit versions)
		const savedStart = textarea.selectionStart;
		const savedEnd = textarea.selectionEnd;

		textarea.contentEditable = 'true';
		try {
			// Restore selection after contentEditable toggle
			textarea.selectionStart = savedStart;
			textarea.selectionEnd = savedEnd;
			document.execCommand('insertText', false, text);
		} catch (_e) {
			// Fallback: direct value assignment (loses undo, but at least inserts)
			const before = textarea.value.slice(0, savedStart);
			const after = textarea.value.slice(savedEnd);
			textarea.value = before + text + after;
			textarea.dispatchEvent(new Event('input', { bubbles: true }));
		}
		textarea.contentEditable = 'false';

		// Explicitly sync -- execCommand may not fire input event in all WebKit versions
		this._content = textarea.value;
		this._scheduleSave();
	}

	/**
	 * Wrap selected text with before/after markers (bold, italic, code, strikethrough, link).
	 * Single insertText call = single undo step.
	 */
	private _formatInline(before: string, after: string): void {
		const textarea = this._textareaEl!;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = textarea.value.substring(start, end);
		const replacement = before + selected + after;

		// Ensure selection covers text to replace
		textarea.selectionStart = start;
		textarea.selectionEnd = end;

		this._undoSafeInsert(replacement);

		// Reposition cursor: inside wrappers if selection, or between them if empty
		if (selected.length > 0) {
			textarea.selectionStart = start + before.length;
			textarea.selectionEnd = start + before.length + selected.length;
		} else {
			textarea.selectionStart = start + before.length;
			textarea.selectionEnd = start + before.length;
		}
	}

	/**
	 * Prefix each selected line with a given string (list, blockquote).
	 * Always operates from the start of the first selected line.
	 */
	private _formatLinePrefix(prefix: string): void {
		const textarea = this._textareaEl!;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;

		// Find start of the line containing the cursor
		const lineStart = text.lastIndexOf('\n', start - 1) + 1;
		const selectedText = text.substring(lineStart, end);
		const lines = selectedText.split('\n');

		// Prefix each line, but skip empty trailing lines
		const prefixed = lines
			.map((line, i) => {
				if (i === lines.length - 1 && line === '') return line;
				return prefix + line;
			})
			.join('\n');

		// Select from line start to end, then insert
		textarea.selectionStart = lineStart;
		textarea.selectionEnd = end;
		this._undoSafeInsert(prefixed);
	}

	/**
	 * Cycle heading prefix on current line: plain -> H1 -> H2 -> H3 -> plain.
	 * H4+ treated as plain text (gets H1 prefix).
	 */
	private _cycleHeading(): void {
		const textarea = this._textareaEl!;
		const start = textarea.selectionStart;
		const text = textarea.value;
		const lineStart = text.lastIndexOf('\n', start - 1) + 1;
		const lineEndIdx = text.indexOf('\n', start);
		const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
		const line = text.substring(lineStart, lineEnd);

		const match = line.match(/^(#{1,3})\s/);
		let replacement: string;

		if (!match) {
			// No heading (or H4+) -> H1
			replacement = '# ' + line;
		} else if (match[1] === '#') {
			// H1 -> H2
			replacement = '## ' + line.substring(2);
		} else if (match[1] === '##') {
			// H2 -> H3
			replacement = '### ' + line.substring(3);
		} else {
			// H3 -> plain
			replacement = line.substring(4);
		}

		textarea.selectionStart = lineStart;
		textarea.selectionEnd = lineEnd;
		this._undoSafeInsert(replacement);
	}
}
