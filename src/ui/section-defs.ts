// Isometry v5 — Phase 145
// section-defs.ts: Shared navigation constants for sidebar and dock.
//
// Single source of truth for:
//   - SidebarItemDef / SidebarSectionDef interfaces
//   - SECTION_DEFS array (sidebar grouping)
//   - viewOrder array (Cmd+1-9 view switching order)
//   - DockSectionDef interface and DOCK_DEFS array (Phase 146 dock taxonomy)
//   - STORIES_STUB_DEFS and DATASETS_STUB_DEFS (Phase 181 stub ribbon rows)

import type { ViewType } from '../providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarItemDef {
	key: string;
	label: string;
	icon: string;
}

export interface SidebarSectionDef {
	key: string;
	label: string;
	icon: string;
	items?: SidebarItemDef[];
	stub?: { icon: string; heading: string; body: string };
}

// ---------------------------------------------------------------------------
// Section definitions — sidebar grouping (matches UI-SPEC table)
// ---------------------------------------------------------------------------

export const SECTION_DEFS: readonly SidebarSectionDef[] = [
	{
		key: 'data-explorer',
		label: 'Data Explorer',
		icon: 'database',
		items: [
			{ key: 'catalog', label: 'Catalog / CAS', icon: 'folder-open' },
			{ key: 'extensions', label: 'Extensions', icon: 'plug' },
		],
	},
	{
		key: 'visualization',
		label: 'Visualization Explorer',
		icon: 'bar-chart-2',
		items: [
			{ key: 'list', label: 'List', icon: 'list' },
			{ key: 'gallery', label: 'Gallery', icon: 'image' },
			{ key: 'kanban', label: 'Kanban', icon: 'columns' },
			{ key: 'grid', label: 'Grid', icon: 'grid' },
			{ key: 'supergrid', label: 'SuperGrid', icon: 'table-2' },
			{ key: 'calendar', label: 'Map', icon: 'map' },
			{ key: 'timeline', label: 'Timeline', icon: 'clock' },
			{ key: 'network', label: 'Charts', icon: 'trending-up' },
			{ key: 'tree', label: 'Graphs', icon: 'git-branch' },
		],
	},
	{
		key: 'graph',
		label: 'GRAPH Explorers',
		icon: 'share-2',
		items: [
			{ key: 'path', label: 'Path', icon: 'route' },
			{ key: 'centrality', label: 'Centrality', icon: 'star' },
			{ key: 'community', label: 'Community', icon: 'users' },
			{ key: 'similarity', label: 'Similarity', icon: 'git-merge' },
			{ key: 'link', label: 'Link', icon: 'link' },
			{ key: 'embed', label: 'Embed', icon: 'box' },
		],
		stub: {
			icon: 'share-2',
			heading: 'GRAPH Explorers',
			body: 'Graph analysis tools \u2014 coming soon.',
		},
	},
	{
		key: 'formula',
		label: 'Formula Explorer',
		icon: 'function-square',
		items: [
			{ key: 'dsl', label: 'DSL Formulas', icon: 'function-square' },
			{ key: 'sql', label: 'SQL Queries', icon: 'database' },
			{ key: 'graph-queries', label: 'Graph Queries', icon: 'share-2' },
			{ key: 'audit', label: 'Audit View', icon: 'search' },
		],
		stub: {
			icon: 'function-square',
			heading: 'Formula Explorer',
			body: 'DSL formulas, SQL queries, and graph queries \u2014 coming soon.',
		},
	},
	{
		key: 'interface-builder',
		label: 'Interface Builder',
		icon: 'puzzle',
		items: [
			{ key: 'formats', label: 'Formats', icon: 'file-text' },
			{ key: 'templates', label: 'Templates', icon: 'folder' },
			{ key: 'apps', label: 'Apps', icon: 'smartphone' },
		],
		stub: {
			icon: 'puzzle',
			heading: 'Interface Builder',
			body: 'Formats, templates, and apps \u2014 coming soon.',
		},
	},
];

// ---------------------------------------------------------------------------
// View order — Cmd+1-9 keyboard shortcut binding order
// ---------------------------------------------------------------------------

export const viewOrder: readonly ViewType[] = [
	'list',
	'grid',
	'kanban',
	'calendar',
	'timeline',
	'gallery',
	'network',
	'tree',
	'supergrid',
];

// ---------------------------------------------------------------------------
// Dock definitions — Phase 146 verb-noun taxonomy
// ---------------------------------------------------------------------------

export interface DockSectionDef {
	key: string;
	label: string;
	items: SidebarItemDef[];
}

export const DOCK_DEFS: readonly DockSectionDef[] = [
	{
		key: 'integrate',
		label: 'Integrate',
		items: [
			{ key: 'catalog', label: 'Data', icon: 'database' },
		],
	},
	{
		key: 'visualize',
		label: 'Visualize',
		items: [
			{ key: 'supergrid', label: 'SuperGrids', icon: 'table-2' },
			{ key: 'timeline', label: 'Timelines', icon: 'clock' },
			{ key: 'network', label: 'Maps', icon: 'map' },
			{ key: 'tree', label: 'Charts', icon: 'trending-up' },
			{ key: 'graph', label: 'Graphs', icon: 'share-2' },
		],
	},
	{
		key: 'analyze',
		label: 'Analyze',
		items: [
			{ key: 'filter', label: 'Filters', icon: 'tags' },
			{ key: 'formula', label: 'Formulas', icon: 'code' },
		],
	},
	{
		key: 'activate',
		label: 'Activate',
		items: [
			{ key: 'stories', label: 'Stories', icon: 'book-open' },
			{ key: 'notebook', label: 'Notebooks', icon: 'notebook-pen' },
		],
	},
	{
		key: 'help',
		label: 'Settings & Help',
		items: [
			{ key: 'settings', label: 'Settings', icon: 'settings' },
			{ key: 'help-page', label: 'Help', icon: 'help-circle' },
		],
	},
];

// ---------------------------------------------------------------------------
// Stub ribbon definitions — Phase 181 (STOR-01..03, DSET-01..03)
// Permanently disabled placeholder rows for Stories and Datasets.
// ---------------------------------------------------------------------------

export const STORIES_STUB_DEFS: readonly SidebarItemDef[] = [
	{ key: 'story-new', label: 'New Story', icon: 'file-plus' },
	{ key: 'story-play', label: 'Present', icon: 'presentation' },
	{ key: 'story-share', label: 'Publish', icon: 'send' },
];

export const DATASETS_STUB_DEFS: readonly SidebarItemDef[] = [
	{ key: 'dataset-import', label: 'Import', icon: 'upload' },
	{ key: 'dataset-export', label: 'Export', icon: 'download' },
	{ key: 'dataset-browse', label: 'Browse', icon: 'hard-drive' },
];
