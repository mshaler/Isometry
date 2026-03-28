import { fuzzyMatch } from './fuzzy';

/** A command that can be invoked from the command palette. */
export interface PaletteCommand {
	/** Unique identifier, e.g. 'view:list', 'action:clear-filters'. */
	id: string;
	/** Display text shown in the palette result row. */
	label: string;
	/** Grouping category for visual headers. */
	category: 'Views' | 'Actions' | 'Cards' | 'Settings' | 'Presets' | 'Help';
	/** Keyboard shortcut hint displayed as <kbd>, e.g. 'Cmd+1'. */
	shortcut?: string;
	/** Category icon character. */
	icon?: string;
	/** Contextual visibility predicate -- command hidden when this returns false. */
	visible?: () => boolean;
	/** Handler invoked when the command is selected. */
	execute: () => void;
}

/**
 * Registry of all executable commands available in the command palette.
 *
 * Commands are registered during app bootstrap from multiple sources
 * (view switching, actions, settings). The registry provides fuzzy search
 * with visibility filtering.
 */
export class CommandRegistry {
	private readonly commands: PaletteCommand[] = [];
	private readonly byId = new Map<string, PaletteCommand>();

	/** Register a single command. */
	register(cmd: PaletteCommand): void {
		this.commands.push(cmd);
		this.byId.set(cmd.id, cmd);
	}

	/** Register multiple commands at once. */
	registerAll(cmds: PaletteCommand[]): void {
		for (const cmd of cmds) {
			this.register(cmd);
		}
	}

	/**
	 * Fuzzy-search visible commands, sorted by score descending.
	 *
	 * Only commands passing their visibility predicate (or having none)
	 * are included in the results.
	 */
	search(query: string): PaletteCommand[] {
		const visible = this.getVisible();
		const scored: Array<{ cmd: PaletteCommand; score: number }> = [];

		for (const cmd of visible) {
			const score = fuzzyMatch(query, cmd.label);
			if (score !== null) {
				scored.push({ cmd, score });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => s.cmd);
	}

	/**
	 * Return all commands passing their visibility predicate.
	 *
	 * Commands without a `visible` predicate are always included.
	 * Commands whose `visible()` returns false are excluded.
	 */
	getVisible(): PaletteCommand[] {
		return this.commands.filter((cmd) => cmd.visible === undefined || cmd.visible());
	}

	/** Look up a command by its unique ID. */
	getById(id: string): PaletteCommand | undefined {
		return this.byId.get(id);
	}

	/** Remove all commands whose id starts with the given prefix. */
	unregisterByPrefix(prefix: string): void {
		const toRemove = this.commands.filter((cmd) => cmd.id.startsWith(prefix));
		for (const cmd of toRemove) {
			this.commands.splice(this.commands.indexOf(cmd), 1);
			this.byId.delete(cmd.id);
		}
	}
}

// ---------------------------------------------------------------------------
// Recent commands (localStorage persistence)
// ---------------------------------------------------------------------------

/** localStorage key for recent command IDs. */
export const RECENTS_KEY = 'isometry:palette-recents';

/** Maximum number of recent entries to store. */
export const MAX_RECENTS = 5;

/**
 * Push a command ID to the recents list.
 *
 * Deduplicates (moves existing ID to front), prepends, and caps at
 * MAX_RECENTS entries. Writes to localStorage.
 */
export function pushRecent(commandId: string): void {
	const recents = getRecents().filter((id) => id !== commandId);
	recents.unshift(commandId);
	localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

/**
 * Read recent command IDs from localStorage.
 *
 * Returns an empty array if the stored value is missing or unparseable.
 */
export function getRecents(): string[] {
	try {
		const raw = localStorage.getItem(RECENTS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

/**
 * Resolve recent command IDs against a registry, returning the actual
 * PaletteCommand objects. IDs that are no longer registered are skipped.
 */
export function getRecentCommands(registry: CommandRegistry): PaletteCommand[] {
	const ids = getRecents();
	const commands: PaletteCommand[] = [];
	for (const id of ids) {
		const cmd = registry.getById(id);
		if (cmd !== undefined) {
			commands.push(cmd);
		}
	}
	return commands;
}
