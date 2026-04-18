/**
 * menuDefinitions.ts — Single source of truth for app menu structure.
 *
 * Both the web dropdown (CommandBar) and the macOS menu bar
 * (native/Isometry/Isometry/IsometryApp.swift — IsometryCommands, ViewCommands)
 * should mirror this structure. When you add or remove items here,
 * update the Swift Commands to match.
 *
 * SYNC REFERENCE:
 *   Swift side: IsometryApp.swift -> IsometryCommands (File/Edit menus)
 *               IsometryApp.swift -> ViewCommands (View menu)
 *   Web side:   This file -> consumed by CommandBar.ts
 */

import type { ViewType } from '../providers/types';
import { viewOrder } from './section-defs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MenuActionKey =
	| 'importFile'
	| 'importFromSource'
	| 'undo'
	| 'redo'
	| `switchView:${ViewType}`;

export interface MenuItemDef {
	readonly label: string;
	readonly shortcut?: string;
	readonly action: MenuActionKey;
}

export interface MenuSeparatorDef {
	readonly separator: true;
}

export interface MenuGroupDef {
	readonly heading: string;
	readonly items: ReadonlyArray<MenuItemDef | MenuSeparatorDef>;
}

export type MenuEntry = MenuGroupDef | MenuSeparatorDef;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isSeparator(entry: MenuEntry | MenuItemDef | MenuSeparatorDef): entry is MenuSeparatorDef {
	return 'separator' in entry;
}

// ---------------------------------------------------------------------------
// Menu definitions — mirrors macOS menu bar
// ---------------------------------------------------------------------------

const viewItems: ReadonlyArray<MenuItemDef> = viewOrder.map((vt, i) => ({
	label: vt.charAt(0).toUpperCase() + vt.slice(1),
	shortcut: '\u2318' + (i + 1),
	action: ('switchView:' + vt) as MenuActionKey,
}));

export const APP_MENU_DEFS: ReadonlyArray<MenuEntry> = [
	{
		heading: 'File',
		items: [
			{ label: 'Import File\u2026', shortcut: '\u2318I', action: 'importFile' },
			{ label: 'Import from\u2026', shortcut: '\u21E7\u2318I', action: 'importFromSource' },
		],
	},
	{ separator: true },
	{
		heading: 'Edit',
		items: [
			{ label: 'Undo', shortcut: '\u2318Z', action: 'undo' },
			{ label: 'Redo', shortcut: '\u21E7\u2318Z', action: 'redo' },
		],
	},
	{ separator: true },
	{
		heading: 'View',
		items: [...viewItems],
	},
];
