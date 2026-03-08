export type { PaletteCommand } from './CommandRegistry';
export {
	CommandRegistry,
	getRecentCommands,
	getRecents,
	MAX_RECENTS,
	pushRecent,
	RECENTS_KEY,
} from './CommandRegistry';
export { fuzzyMatch } from './fuzzy';
