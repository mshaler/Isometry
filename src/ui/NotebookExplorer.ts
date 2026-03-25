// Isometry v5 — Phase 57 Plan 01 + Phase 64 Plan 01 + Phase 65 Plan 02 + Phase 91 Plan 01 + Phase 91 Plan 02
// NotebookExplorer: tabbed Write/Preview layout with Markdown rendering,
// XSS sanitization via DOMPurify, keyboard shortcuts, formatting toolbar,
// shadow-buffer architecture with MutationManager integration for title and content editing,
// idle state display, and D3 chart blocks via marked renderer extension + ChartRenderer.
//
// Requirements: NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06, NOTE-07, NOTE-08,
//               EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07
//
// Design:
//   - Tabbed toggle (Write | Preview) via segmented control
//   - Plain <textarea> editor with system font (NOT monospace)
//   - Title <input> above segmented control for card name editing
//   - Shadow-buffer: _snapshot captured on card load, _bufferName/_bufferContent mutated during edit
//   - Single MutationManager mutation on blur/switch/save (NOT per-keystroke or debounce timer)
//   - Preview renders Markdown through marked.parse() -> DOMPurify.sanitize() -> innerHTML
//   - Two-pass chart rendering: DOMPurify sanitizes placeholder divs, then D3 mounts SVG (NOTE-08)
//   - marked.use() renderer extension intercepts ```chart code blocks -> placeholder divs
//   - ChartRenderer queries Worker and renders D3 SVGs into sanitized placeholders
//   - FilterProvider subscription enables live chart updates on Preview tab (NOTE-07)
//   - Cmd+B/I/K handled via textarea-local keydown (NOT ShortcutRegistry -- input guard skips TEXTAREA)
//   - Cmd+S on title or textarea triggers blur → commit
//   - MutationManager subscriber: checks if active card still exists on every mutation
//   - Idle state shown when no card selected or card deleted by undo

import '../styles/notebook-explorer.css';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Card } from '../database/queries/types';
import { createCardMutation, updateCardMutation } from '../mutations/inverses';
import type { MutationManager } from '../mutations/MutationManager';
import type { AliasProvider } from '../providers/AliasProvider';
import type { FilterProvider } from '../providers/FilterProvider';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { SelectionProvider } from '../providers/SelectionProvider';
import type { WorkerBridge } from '../worker/WorkerBridge';
import { ChartRenderer } from './charts/ChartRenderer';
import { CardPropertyFields } from './CardPropertyFields';

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
	ALLOWED_ATTR: [
		'href',
		'src',
		'alt',
		'title',
		'class',
		'type',
		'checked',
		'disabled',
		'data-chart-id',
		'data-chart-config',
	],
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
	/** Optional SchemaProvider for dynamic field resolution in charts (DYNM-06 extension). */
	schema?: SchemaProvider;
	/** MutationManager for shadow-buffer commit of title and content edits (EDIT-01). */
	mutations: MutationManager;
}

// ---------------------------------------------------------------------------
// NotebookExplorer
// ---------------------------------------------------------------------------

/**
 * NotebookExplorer provides a tabbed Write/Preview Markdown notebook
 * embedded in the workbench panel rail.
 *
 * Shadow-buffer architecture: full Card snapshot captured via card:get on selection,
 * mutable buffers (_bufferName, _bufferContent) updated during editing,
 * single MutationManager mutation committed on blur/switch/Cmd+S.
 *
 * Idle state shown when no card is selected or active card is deleted by undo.
 */
export class NotebookExplorer {
	private readonly _bridge: WorkerBridge;
	private readonly _selection: SelectionProvider;
	private readonly _filter: FilterProvider;
	private readonly _alias: AliasProvider;
	private readonly _schema: SchemaProvider | undefined;
	private readonly _mutations: MutationManager;

	// DOM elements
	private _rootEl: HTMLElement | null = null;
	private _titleInputEl: HTMLInputElement | null = null;
	private _idleEl: HTMLElement | null = null;
	private _controlEl: HTMLElement | null = null;
	private _textareaEl: HTMLTextAreaElement | null = null;
	private _previewEl: HTMLElement | null = null;
	private _writeTabEl: HTMLElement | null = null;
	private _previewTabEl: HTMLElement | null = null;
	private _toolbarEl: HTMLElement | null = null;
	private _bodyEl: HTMLElement | null = null;

	// Property fields panel (Phase 93 — PROP-01)
	private _propertyFields: CardPropertyFields | null = null;
	private _propertyContainerEl: HTMLElement | null = null;

	// State
	private _activeTab: 'write' | 'preview' = 'write';
	private _activeCardId: string | null = null;

	// Creation state machine (CREA-01)
	private _creationState: 'idle' | 'buffering' | 'editing' = 'idle';
	private _isComposing = false;
	private _deferredBlur = false;

	// Shadow-buffer state (EDIT-01)
	private _snapshot: Card | null = null;
	private _bufferName = '';
	private _bufferContent = '';

	// Event handler references for cleanup
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private _titleKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

	// Subscriptions
	private _unsubscribeSelection: (() => void) | null = null;
	private _chartRenderer: ChartRenderer | null = null;
	private _unsubscribeFilter: (() => void) | null = null;
	private _unsubscribeMutation: (() => void) | null = null;

	constructor(config: NotebookExplorerConfig) {
		this._bridge = config.bridge;
		this._selection = config.selection;
		this._filter = config.filter;
		this._alias = config.alias;
		this._schema = config.schema;
		this._mutations = config.mutations;

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
		this._rootEl.setAttribute('data-creation-state', 'idle');

		// 2. Title input (above segmented control) — hidden until card is active
		this._titleInputEl = document.createElement('input');
		this._titleInputEl.type = 'text';
		this._titleInputEl.className = 'notebook-title-input';
		this._titleInputEl.placeholder = 'Untitled';
		this._titleInputEl.style.display = 'none';
		this._titleInputEl.addEventListener('compositionstart', () => {
			this._isComposing = true;
		});
		this._titleInputEl.addEventListener('compositionend', () => {
			this._isComposing = false;
			// Re-evaluate if a deferred blur happened during composition
			if (this._deferredBlur) {
				this._deferredBlur = false;
				void this._evaluateBufferingCommit();
			}
		});
		this._titleInputEl.addEventListener('blur', () => {
			if (this._creationState === 'buffering') {
				if (this._isComposing) {
					this._deferredBlur = true;
					return;
				}
				void this._evaluateBufferingCommit();
			} else {
				void this._commitTitle();
			}
		});
		this._titleKeydownHandler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 's') {
				e.preventDefault();
				this._titleInputEl!.blur();
			} else if (e.key === 'Escape' && this._creationState === 'buffering') {
				e.preventDefault();
				this._abandonCreation();
			} else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
				// Cmd+N inside title input — rapid creation or editing→buffering
				e.preventDefault();
				if (this._creationState === 'buffering') {
					// Rapid creation: commit current name if non-empty, then fresh buffer
					const name = this._titleInputEl!.value.trim();
					if (name.length > 0) {
						void this._evaluateBufferingCommit().then(() => {
							// After commit and selection change, re-enter buffering for next card
							this._enterBuffering();
						});
					} else {
						// Empty name: just restart buffering (no-op net effect)
						this._enterBuffering();
					}
				} else {
					// In editing state: auto-commit and enter buffering
					this.enterCreationMode();
				}
			}
		};
		this._titleInputEl.addEventListener('keydown', this._titleKeydownHandler);
		this._rootEl.appendChild(this._titleInputEl);

		// 3. Segmented control (Write | Preview tabs) — hidden in idle state
		this._controlEl = document.createElement('div');
		this._controlEl.className = 'notebook-segmented-control';
		this._controlEl.style.display = 'none';

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

		this._controlEl.appendChild(this._writeTabEl);
		this._controlEl.appendChild(this._previewTabEl);
		this._rootEl.appendChild(this._controlEl);

		// 4. Formatting toolbar (visible in Write mode only) — hidden in idle state
		this._toolbarEl = this._createToolbar();
		this._toolbarEl.style.display = 'none';
		this._rootEl.appendChild(this._toolbarEl);

		// 5. Body container — hidden in idle state
		this._bodyEl = document.createElement('div');
		this._bodyEl.className = 'notebook-body';
		this._bodyEl.style.display = 'none';

		// 5a. Textarea -- visible initially in write mode
		this._textareaEl = document.createElement('textarea');
		this._textareaEl.className = 'notebook-textarea';
		this._textareaEl.placeholder = 'Write notes for this card...';
		this._textareaEl.rows = 8;

		// Sync content buffer on input (no debounced save — shadow-buffer commits on blur)
		this._textareaEl.addEventListener('input', () => {
			this._bufferContent = this._textareaEl!.value;
		});

		// Commit content on blur
		this._textareaEl.addEventListener('blur', () => {
			void this._commitContent();
		});

		// 5b. Preview -- hidden initially
		this._previewEl = document.createElement('div');
		this._previewEl.className = 'notebook-preview';
		this._previewEl.style.display = 'none';

		this._bodyEl.appendChild(this._textareaEl);
		this._bodyEl.appendChild(this._previewEl);
		this._rootEl.appendChild(this._bodyEl);

		// 5c. Property fields panel (Phase 93 — PROP-01)
		this._propertyFields = new CardPropertyFields({
			mutations: this._mutations,
			bridge: this._bridge,
		});
		this._propertyContainerEl = document.createElement('div');
		this._propertyFields.mount(this._propertyContainerEl);
		this._propertyContainerEl.style.display = 'none';
		this._rootEl.appendChild(this._propertyContainerEl);

		// 6. Idle state — shown when no card is selected
		this._idleEl = document.createElement('div');
		this._idleEl.className = 'notebook-idle';

		const hintEl = document.createElement('p');
		hintEl.className = 'notebook-idle-hint';
		hintEl.textContent = 'Select a card or create a new one';
		this._idleEl.appendChild(hintEl);

		const newCardBtn = document.createElement('button');
		newCardBtn.type = 'button';
		newCardBtn.className = 'notebook-new-card-btn';
		newCardBtn.textContent = 'New Card';
		newCardBtn.addEventListener('click', () => this._enterBuffering());
		this._idleEl.appendChild(newCardBtn);

		this._rootEl.appendChild(this._idleEl);

		// 7. Keyboard shortcuts on textarea (Cmd+B/I/K/S/N)
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
			} else if (e.key === 's') {
				e.preventDefault();
				this._textareaEl!.blur();
			} else if (e.key === 'n') {
				// Cmd+N inside textarea — auto-commit current card and enter creation mode
				e.preventDefault();
				this.enterCreationMode();
			}
		};
		this._textareaEl.addEventListener('keydown', this._keydownHandler);

		// 8. Append to container
		container.appendChild(this._rootEl);

		// 9. Subscribe to MutationManager for card deletion detection
		this._unsubscribeMutation = this._mutations.subscribe(() => {
			void this._onMutationChange();
		});

		// 10. Subscribe to SelectionProvider and check current selection
		this._unsubscribeSelection = this._selection.subscribe(() => {
			void this._onSelectionChange();
		});
		void this._onSelectionChange();
	}

	destroy(): void {
		// Flush pending changes (fire-and-forget) before teardown
		void this._commitTitle();
		void this._commitContent();

		// Unsubscribe from MutationManager
		this._unsubscribeMutation?.();
		this._unsubscribeMutation = null;

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

		// Remove keydown listeners
		if (this._textareaEl && this._keydownHandler) {
			this._textareaEl.removeEventListener('keydown', this._keydownHandler);
		}
		this._keydownHandler = null;

		if (this._titleInputEl && this._titleKeydownHandler) {
			this._titleInputEl.removeEventListener('keydown', this._titleKeydownHandler);
		}
		this._titleKeydownHandler = null;

		// Destroy property fields panel (Phase 93 — PROP-01)
		this._propertyFields?.destroy();
		this._propertyFields = null;
		this._propertyContainerEl = null;

		// Remove from DOM
		this._rootEl?.remove();

		// Null out references
		this._rootEl = null;
		this._titleInputEl = null;
		this._idleEl = null;
		this._controlEl = null;
		this._textareaEl = null;
		this._previewEl = null;
		this._writeTabEl = null;
		this._previewTabEl = null;
		this._toolbarEl = null;
		this._bodyEl = null;
		this._snapshot = null;
	}

	// -----------------------------------------------------------------------
	// Shadow-buffer commit methods (EDIT-01, EDIT-02, EDIT-03)
	// -----------------------------------------------------------------------

	/**
	 * Commit title buffer to MutationManager if changed.
	 * Reads current value from the DOM input to ensure we have the latest user input.
	 * No-op if snapshot is null or value matches snapshot name.
	 */
	private async _commitTitle(): Promise<void> {
		if (!this._snapshot) return;
		// Read directly from DOM to capture any in-flight value changes
		const currentName = this._titleInputEl ? this._titleInputEl.value : this._bufferName;
		this._bufferName = currentName;
		if (this._bufferName === this._snapshot.name) return; // No change, skip
		const mutation = updateCardMutation(this._snapshot.id, this._snapshot, { name: this._bufferName });
		await this._mutations.execute(mutation);
		// Update snapshot to reflect committed state (prevents double-commit on card switch)
		this._snapshot = { ...this._snapshot, name: this._bufferName };
	}

	/**
	 * Commit content buffer to MutationManager if changed.
	 * Reads current value from the DOM textarea to ensure we have the latest user input.
	 * No-op if snapshot is null or value matches snapshot content.
	 */
	private async _commitContent(): Promise<void> {
		if (!this._snapshot) return;
		// Read directly from DOM to capture any in-flight value changes
		const currentContent = this._textareaEl ? this._textareaEl.value : this._bufferContent;
		this._bufferContent = currentContent;
		if (this._bufferContent === (this._snapshot.content ?? '')) return; // No change, skip
		const mutation = updateCardMutation(this._snapshot.id, this._snapshot, { content: this._bufferContent || null });
		await this._mutations.execute(mutation);
		this._snapshot = { ...this._snapshot, content: this._bufferContent || null };
	}

	// -----------------------------------------------------------------------
	// Card creation state machine (CREA-01, CREA-02, CREA-03, CREA-04, CREA-05)
	// -----------------------------------------------------------------------

	/**
	 * Enter buffering state: show title input for new card name, hide editor elements.
	 * If currently editing, auto-commits dirty buffers first.
	 * Called by "New Card" button and enterCreationMode() public method.
	 */
	private _enterBuffering(): void {
		// If currently editing, auto-commit dirty buffers first
		if (this._creationState === 'editing' && this._snapshot) {
			void this._commitTitle();
			void this._commitContent();
		}

		this._creationState = 'buffering';
		this._rootEl?.setAttribute('data-creation-state', 'buffering');
		this._snapshot = null;
		this._activeCardId = null;
		this._bufferName = '';
		this._bufferContent = '';
		this._isComposing = false;
		this._deferredBlur = false;

		// Show title input only, hide everything else
		if (this._titleInputEl) {
			this._titleInputEl.value = '';
			this._titleInputEl.placeholder = 'Card name\u2026';
			this._titleInputEl.setAttribute('aria-label', 'Card name');
			this._titleInputEl.style.display = '';
			this._titleInputEl.focus();
		}
		if (this._controlEl) this._controlEl.style.display = 'none';
		if (this._toolbarEl) this._toolbarEl.style.display = 'none';
		if (this._bodyEl) this._bodyEl.style.display = 'none';
		if (this._idleEl) this._idleEl.style.display = 'none';
		if (this._propertyContainerEl) this._propertyContainerEl.style.display = 'none';
	}

	/**
	 * Evaluate commit or abandon after blur during buffering state.
	 * Commits if name is non-empty; abandons otherwise.
	 */
	private async _evaluateBufferingCommit(): Promise<void> {
		const name = this._titleInputEl?.value.trim() ?? '';
		if (name.length === 0) {
			this._abandonCreation();
			return;
		}

		// Create the card via MutationManager
		const mutation = createCardMutation({ name, card_type: 'note' });
		await this._mutations.execute(mutation);

		// Extract generated card ID from the mutation's forward INSERT params[0]
		const newCardId = mutation.forward[0]!.params[0] as string;

		// Auto-select the new card — fires subscriber which loads card and transitions to editing
		this._selection.select(newCardId);

		// Explicitly transition to editing state. _onSelectionChange will call _showEditor()
		// which also sets these, but the explicit assignment here makes the buffering → editing
		// transition deterministic regardless of subscriber ordering.
		this._creationState = 'editing';
		this._rootEl?.setAttribute('data-creation-state', 'editing');
	}

	/**
	 * Abandon creation: clear title input, return to idle state.
	 */
	private _abandonCreation(): void {
		if (this._titleInputEl) {
			this._titleInputEl.value = '';
			this._titleInputEl.placeholder = 'Untitled';
			this._titleInputEl.removeAttribute('aria-label');
		}
		this._isComposing = false;
		this._deferredBlur = false;
		this._bufferName = '';
		this._showIdle();
	}

	/**
	 * Enter card creation mode. Public API for Cmd+N and Command Palette.
	 * If editing, auto-commits current card first.
	 */
	enterCreationMode(): void {
		this._enterBuffering();
	}

	// -----------------------------------------------------------------------
	// MutationManager subscriber — detect card deletion (EDIT-04)
	// -----------------------------------------------------------------------

	private async _onMutationChange(): Promise<void> {
		if (!this._activeCardId) return;
		const card = await this._bridge.send('card:get', { id: this._activeCardId });
		if (!card) {
			// Card was deleted (e.g., by undo) — reset to idle
			this._showIdle();
		}
	}

	// -----------------------------------------------------------------------
	// Idle / Editor state transitions
	// -----------------------------------------------------------------------

	private _showIdle(): void {
		if (this._titleInputEl) this._titleInputEl.style.display = 'none';
		if (this._controlEl) this._controlEl.style.display = 'none';
		if (this._toolbarEl) this._toolbarEl.style.display = 'none';
		if (this._bodyEl) this._bodyEl.style.display = 'none';
		if (this._idleEl) this._idleEl.style.display = '';
		if (this._propertyContainerEl) this._propertyContainerEl.style.display = 'none';

		// Reset creation and state machine
		this._creationState = 'idle';
		this._rootEl?.setAttribute('data-creation-state', 'idle');
		this._isComposing = false;
		this._deferredBlur = false;

		// Reset all state
		this._snapshot = null;
		this._activeCardId = null;
		this._bufferName = '';
		this._bufferContent = '';
	}

	private _showEditor(): void {
		this._creationState = 'editing';
		this._rootEl?.setAttribute('data-creation-state', 'editing');
		if (this._titleInputEl) this._titleInputEl.style.display = '';
		if (this._controlEl) this._controlEl.style.display = '';
		if (this._activeTab === 'write' && this._toolbarEl) {
			this._toolbarEl.style.display = '';
		}
		if (this._bodyEl) this._bodyEl.style.display = '';
		if (this._idleEl) this._idleEl.style.display = 'none';
		if (this._propertyContainerEl) this._propertyContainerEl.style.display = '';
	}

	// -----------------------------------------------------------------------
	// Selection-driven card binding
	// -----------------------------------------------------------------------

	private async _onSelectionChange(): Promise<void> {
		const ids = this._selection.getSelectedIds();
		const newCardId = ids.length > 0 ? ids[0]! : null;

		if (newCardId === this._activeCardId) return; // Same card, no-op

		// 1. Flush current card's pending changes before switching (EDIT-04)
		if (this._activeCardId !== null) {
			// Sync textarea buffer before commit
			if (this._textareaEl) {
				this._bufferContent = this._textareaEl.value;
			}
			// Sync title input buffer before commit
			if (this._titleInputEl) {
				this._bufferName = this._titleInputEl.value;
			}
			await this._commitTitle();
			await this._commitContent();
		}

		// 2. Update active card
		this._activeCardId = newCardId;

		// 3. Handle zero selection -- show idle state
		if (newCardId === null) {
			this._showIdle();
			return;
		}

		// 4. Clear inputs synchronously (prevent flash of old content)
		if (this._titleInputEl) this._titleInputEl.value = '';
		if (this._textareaEl) this._textareaEl.value = '';

		// 5. Load new card's full snapshot via card:get (EDIT-01, EDIT-06)
		const card = await this._bridge.send('card:get', { id: newCardId });

		// 6. Guard against stale response (rapid card switching)
		if (this._activeCardId !== newCardId) return;

		// 7. Handle deleted card
		if (!card) {
			this._showIdle();
			return;
		}

		// 8. Store snapshot and populate buffers
		this._snapshot = card;
		this._bufferName = card.name;
		this._bufferContent = card.content ?? '';

		// 9. Populate UI inputs
		if (this._titleInputEl) this._titleInputEl.value = this._bufferName;
		if (this._textareaEl) this._textareaEl.value = this._bufferContent;

		// 10. Show editor (track if transitioning from buffering for textarea focus)
		const wasBuffering = this._creationState === 'buffering';
		this._showEditor();

		// 10a. Update property fields with new card snapshot
		if (this._propertyFields && this._snapshot) {
			this._propertyFields.update(this._snapshot);
		}

		// 11. If transitioning from creation (buffering → editing), focus content textarea
		if (wasBuffering && this._textareaEl) {
			this._textareaEl.focus();
		}

		// 12. If on Preview tab, re-render preview with new card's content
		if (this._activeTab === 'preview') {
			this._renderPreview();
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

			// Restore content from buffer
			this._textareaEl!.value = this._bufferContent;

			// Update tab states
			this._writeTabEl!.classList.add('notebook-tab--active');
			this._writeTabEl!.setAttribute('aria-pressed', 'true');
			this._previewTabEl!.classList.remove('notebook-tab--active');
			this._previewTabEl!.setAttribute('aria-pressed', 'false');
		} else {
			// Sync content buffer from textarea before switching
			this._bufferContent = this._textareaEl!.value;

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
		const rawHtml = marked.parse(this._bufferContent) as string;
		const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
		this._previewEl!.innerHTML = cleanHtml;

		// Pass 2: Mount D3 charts into sanitized placeholder divs (NOTE-08)
		if (!this._chartRenderer) {
			const chartConfig = {
				bridge: this._bridge,
				filter: this._filter,
				alias: this._alias,
				...(this._schema !== undefined && { schema: this._schema }),
			};
			this._chartRenderer = new ChartRenderer(chartConfig);
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

		// Explicitly sync buffer -- execCommand may not fire input event in all WebKit versions
		this._bufferContent = textarea.value;
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

// ---------------------------------------------------------------------------
// Boot-time migration: legacy notebook:{cardId} ui_state → cards.content (EDIT-05)
// ---------------------------------------------------------------------------

/**
 * Migrate legacy notebook:{cardId} entries from ui_state to cards.content.
 *
 * This one-shot migration runs at boot, guarded by the sentinel key
 * `notebook:migration:v1` in ui_state. If the sentinel is already present,
 * the function returns immediately (idempotent).
 *
 * Conflict resolution: cards.content wins. Only rows where content IS NULL
 * or empty string are updated. Existing content is never overwritten.
 *
 * After migration, all migrated notebook:{cardId} keys are deleted from
 * ui_state. The sentinel is set last to mark migration complete.
 *
 * @param bridge - WorkerBridge for database and ui_state access
 */
export async function migrateNotebookContent(bridge: WorkerBridge): Promise<void> {
	// 1. Check sentinel — skip if already migrated
	const sentinel = await bridge.send('ui:get', { key: 'notebook:migration:v1' });
	if (sentinel.value !== null) return;

	// 2. Get all ui_state entries and filter to notebook:{cardId} keys with non-empty content
	const allEntries = await bridge.send('ui:getAll', {});
	const notebookEntries = allEntries.filter(
		(e: { key: string; value: string }) =>
			e.key.startsWith('notebook:') && e.key !== 'notebook:migration:v1' && e.value.trim() !== '',
	);

	// 3. For each notebook:{cardId} entry, UPDATE cards.content only if not already set
	for (const entry of notebookEntries) {
		const cardId = entry.key.replace('notebook:', '');
		await bridge.send('db:exec', {
			sql: "UPDATE cards SET content = ? WHERE id = ? AND (content IS NULL OR content = '')",
			params: [entry.value, cardId],
		});
	}

	// 4. Delete migrated notebook:{cardId} keys from ui_state
	for (const entry of notebookEntries) {
		await bridge.send('db:exec', {
			sql: 'DELETE FROM ui_state WHERE key = ?',
			params: [entry.key],
		});
	}

	// 5. Set sentinel last to mark migration complete
	await bridge.send('ui:set', { key: 'notebook:migration:v1', value: 'done' });
}
