// Isometry v5 — Phase 57 Plan 01
// NotebookExplorer: tabbed Write/Preview layout with Markdown rendering,
// XSS sanitization via DOMPurify, keyboard shortcuts, and session-only persistence.
//
// Requirements: NOTE-01, NOTE-02, NOTE-03, NOTE-04
//
// Design:
//   - Tabbed toggle (Write | Preview) via segmented control
//   - Plain <textarea> editor with system font (NOT monospace)
//   - Preview renders Markdown through marked.parse() -> DOMPurify.sanitize() -> innerHTML
//   - Cmd+B/I/K handled via textarea-local keydown (NOT ShortcutRegistry — input guard skips TEXTAREA)
//   - Content stored in class field only — NO localStorage, NO database, NO bridge calls
//   - .notebook-chart-preview stub reserved for future D3 chart blocks

import '../styles/notebook-explorer.css';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// ---------------------------------------------------------------------------
// DOMPurify sanitization config — strict allowlist for WKWebView context
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
	ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'type', 'checked', 'disabled'],
	ALLOW_DATA_ATTR: false,
	FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
	FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style'],
};

// ---------------------------------------------------------------------------
// NotebookExplorer
// ---------------------------------------------------------------------------

/**
 * NotebookExplorer provides a tabbed Write/Preview Markdown notebook
 * embedded in the workbench panel rail.
 *
 * Session-only: content lives in a class field and clears on page refresh.
 * No providers, no database, no localStorage — pure UI component.
 */
export class NotebookExplorer {
	private _rootEl: HTMLElement | null = null;
	private _textareaEl: HTMLTextAreaElement | null = null;
	private _previewEl: HTMLElement | null = null;
	private _chartStubEl: HTMLElement | null = null;
	private _writeTabEl: HTMLElement | null = null;
	private _previewTabEl: HTMLElement | null = null;
	private _toolbarEl: HTMLElement | null = null;
	private _activeTab: 'write' | 'preview' = 'write';
	private _content = ''; // Session-only state — no persistence
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

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

		// 3a. Textarea — visible initially
		this._textareaEl = document.createElement('textarea');
		this._textareaEl.className = 'notebook-textarea';
		this._textareaEl.placeholder = 'Write Markdown...';
		this._textareaEl.rows = 8;

		// Sync content on input
		this._textareaEl.addEventListener('input', () => {
			this._content = this._textareaEl!.value;
		});

		// 3b. Preview — hidden initially
		this._previewEl = document.createElement('div');
		this._previewEl.className = 'notebook-preview';
		this._previewEl.style.display = 'none';

		// 3c. Chart stub — always hidden (NOTE-03)
		this._chartStubEl = document.createElement('div');
		this._chartStubEl.className = 'notebook-chart-preview';
		this._chartStubEl.style.display = 'none';

		bodyEl.appendChild(this._textareaEl);
		bodyEl.appendChild(this._previewEl);
		bodyEl.appendChild(this._chartStubEl);
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
	}

	destroy(): void {
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
		this._chartStubEl = null;
		this._writeTabEl = null;
		this._previewTabEl = null;
		this._toolbarEl = null;
	}

	// -----------------------------------------------------------------------
	// Tab switching
	// -----------------------------------------------------------------------

	private _switchTab(tab: 'write' | 'preview'): void {
		if (this._activeTab === tab) return;
		this._activeTab = tab;

		if (tab === 'write') {
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

			// Render preview
			this._renderPreview();

			// Show preview, hide textarea and toolbar
			this._textareaEl!.style.display = 'none';
			this._previewEl!.style.display = '';
			this._toolbarEl!.style.display = 'none';

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
	}

	// -----------------------------------------------------------------------
	// Toolbar DOM (Phase 63 — NOTE-01)
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

	private _createButtonGroup(
		buttons: Array<{ label: string; title: string; action: () => void }>,
	): HTMLElement {
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
	// Undo-safe formatting engine (Phase 63 — NOTE-01, NOTE-02)
	// Replaces _wrapSelection() — uses execCommand('insertText') with
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

		// Explicitly sync — execCommand may not fire input event in all WebKit versions
		this._content = textarea.value;
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
