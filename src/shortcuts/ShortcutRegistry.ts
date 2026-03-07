// Isometry v5 — Phase 44 Plan 01
// Centralized keyboard shortcut registry with input field guard.
//
// Requirements: KEYS-04
//
// Design:
//   - Single document keydown listener handles all registered shortcuts
//   - Built-in input field guard (INPUT, TEXTAREA, contentEditable)
//   - Platform-aware: Cmd → metaKey on Mac, ctrlKey on non-Mac
//   - Shortcut strings: 'Cmd+Z', 'Cmd+Shift+Z', 'Cmd+1', '?' (plain key)

/** Metadata for a registered shortcut. */
export interface ShortcutEntry {
	shortcut: string;
	handler: () => void;
	category: string;
	description: string;
}

/** Parsed representation of a shortcut string for matching against events. */
interface ParsedShortcut {
	key: string;
	cmd: boolean;
	shift: boolean;
	alt: boolean;
}

/**
 * Centralized keyboard shortcut registry.
 *
 * Consolidates all keyboard handlers behind a single document keydown listener
 * with built-in input field guards. Prevents conflicting bindings and duplicated
 * guard logic across the application.
 *
 * Platform detection:
 *   - Mac: 'Cmd' modifier maps to metaKey
 *   - Non-Mac: 'Cmd' modifier maps to ctrlKey
 *
 * @example
 * const shortcuts = new ShortcutRegistry();
 * shortcuts.register('Cmd+Z', () => undo(), { category: 'Editing', description: 'Undo' });
 * shortcuts.register('?', () => showHelp(), { category: 'Help', description: 'Show help' });
 * // Later:
 * shortcuts.destroy();
 */
export class ShortcutRegistry {
	private readonly entries = new Map<string, ShortcutEntry>();
	private readonly parsed = new Map<string, ParsedShortcut>();
	private readonly isMac: boolean;
	private readonly handleKeyDown: (event: KeyboardEvent) => void;

	constructor() {
		this.isMac =
			typeof navigator !== 'undefined' && typeof navigator.platform === 'string' && navigator.platform.includes('Mac');

		this.handleKeyDown = (event: KeyboardEvent): void => {
			// Input field guard: do not intercept when typing in form fields
			const target = event.target as HTMLElement | null;
			if (target !== null) {
				if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
					return;
				}
			}

			// Build normalized key from event
			const key = event.key.toLowerCase();

			// Determine if the platform modifier is pressed
			const cmdPressed = this.isMac ? event.metaKey : event.ctrlKey;

			// Try to match against registered shortcuts
			for (const [normalizedKey, parsed] of this.parsed) {
				if (parsed.key !== key) continue;
				if (parsed.cmd !== cmdPressed) continue;
				if (parsed.shift !== event.shiftKey) continue;
				if (parsed.alt !== event.altKey) continue;

				// For plain key shortcuts (no modifiers), also check that the
				// other platform modifier is not pressed. This prevents '?' from
				// firing when Cmd+? or Ctrl+? is pressed.
				if (!parsed.cmd && !parsed.shift && !parsed.alt) {
					const otherModifier = this.isMac ? event.ctrlKey : event.metaKey;
					if (event.metaKey || event.ctrlKey || otherModifier) continue;
				}

				event.preventDefault();
				const entry = this.entries.get(normalizedKey);
				if (entry) entry.handler();
				return;
			}
		};

		document.addEventListener('keydown', this.handleKeyDown);
	}

	/**
	 * Register a keyboard shortcut.
	 *
	 * @param shortcut - Shortcut string, e.g. 'Cmd+Z', 'Cmd+Shift+Z', 'Cmd+1', '?'
	 * @param handler - Function to call when the shortcut is triggered
	 * @param meta - Category and description for documentation/help overlay
	 */
	register(shortcut: string, handler: () => void, meta: { category: string; description: string }): void {
		const normalizedKey = this.normalize(shortcut);
		this.entries.set(normalizedKey, {
			shortcut,
			handler,
			category: meta.category,
			description: meta.description,
		});
		this.parsed.set(normalizedKey, this.parse(shortcut));
	}

	/**
	 * Remove a registered shortcut.
	 *
	 * @param shortcut - The shortcut string that was originally registered
	 */
	unregister(shortcut: string): void {
		const normalizedKey = this.normalize(shortcut);
		this.entries.delete(normalizedKey);
		this.parsed.delete(normalizedKey);
	}

	/**
	 * Get all registered shortcuts with their metadata.
	 *
	 * @returns Array of shortcut info objects (without handlers)
	 */
	getAll(): Array<{ shortcut: string; category: string; description: string }> {
		const result: Array<{ shortcut: string; category: string; description: string }> = [];
		for (const entry of this.entries.values()) {
			result.push({
				shortcut: entry.shortcut,
				category: entry.category,
				description: entry.description,
			});
		}
		return result;
	}

	/**
	 * Remove the keydown listener and clear all registrations.
	 */
	destroy(): void {
		document.removeEventListener('keydown', this.handleKeyDown);
		this.entries.clear();
		this.parsed.clear();
	}

	/**
	 * Normalize a shortcut string for use as a Map key.
	 * Lowercases all parts for case-insensitive comparison.
	 */
	private normalize(shortcut: string): string {
		return shortcut.toLowerCase();
	}

	/**
	 * Parse a shortcut string into its component parts.
	 *
	 * Examples:
	 *   'Cmd+Z'       → { key: 'z', cmd: true, shift: false, alt: false }
	 *   'Cmd+Shift+Z' → { key: 'z', cmd: true, shift: true, alt: false }
	 *   'Cmd+1'       → { key: '1', cmd: true, shift: false, alt: false }
	 *   '?'           → { key: '?', cmd: false, shift: false, alt: false }
	 */
	private parse(shortcut: string): ParsedShortcut {
		const parts = shortcut.split('+');
		const key = parts[parts.length - 1]!.toLowerCase();
		const modifiers = parts.slice(0, -1).map((m) => m.toLowerCase());

		return {
			key,
			cmd: modifiers.includes('cmd'),
			shift: modifiers.includes('shift'),
			alt: modifiers.includes('alt'),
		};
	}
}
