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
				this._wrapSelection('**', '**');
			} else if (e.key === 'i') {
				e.preventDefault();
				this._wrapSelection('_', '_');
			} else if (e.key === 'k') {
				e.preventDefault();
				this._wrapSelection('[', '](url)');
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
	}

	// -----------------------------------------------------------------------
	// Tab switching
	// -----------------------------------------------------------------------

	private _switchTab(tab: 'write' | 'preview'): void {
		if (this._activeTab === tab) return;
		this._activeTab = tab;

		if (tab === 'write') {
			// Show textarea, hide preview
			this._textareaEl!.style.display = '';
			this._previewEl!.style.display = 'none';

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

			// Show preview, hide textarea
			this._textareaEl!.style.display = 'none';
			this._previewEl!.style.display = '';

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
	// Selection wrapping (Cmd+B/I/K)
	// -----------------------------------------------------------------------

	private _wrapSelection(before: string, after: string): void {
		const textarea = this._textareaEl!;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selected = text.substring(start, end);

		textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);

		// Position cursor: if selection existed, reselect it inside wrappers
		// If no selection, place cursor between wrappers
		if (selected.length > 0) {
			textarea.selectionStart = start + before.length;
			textarea.selectionEnd = start + before.length + selected.length;
		} else {
			textarea.selectionStart = start + before.length;
			textarea.selectionEnd = start + before.length;
		}

		textarea.focus();
		this._content = textarea.value;
	}
}
