// Isometry v5 — Phase 134 Plan 01
// Tour step definitions for driver.js guided tour.
//
// 7 steps covering the must-have surfaces (sidebar nav, supergrid PAFV,
// density controls, LATCH panel, notebook, command palette, completion).

export interface TourStep {
	target: string;
	title: string;
	bodyTemplate: string;
	bodyFallback: string;
	isLastStep: boolean;
}

export const TOUR_STEPS: TourStep[] = [
	{
		target: '[data-tour-target="sidebar-nav"]',
		title: 'Your views',
		bodyTemplate:
			'Isometry offers 9 ways to explore your data. The \u2736 badge marks the best view for your current dataset \u2014 click it to switch.',
		bodyFallback:
			'Isometry offers 9 ways to explore your data. The \u2736 badge marks the best view for your current dataset \u2014 click it to switch.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="supergrid"]',
		title: 'SuperGrid: PAFV projection',
		bodyTemplate:
			'Each cell shows cards where the row axis matches {rowAxis} and the column axis matches {columnAxis}. The cell count is your data density.',
		bodyFallback:
			'Each cell shows cards where the row axis matches the row axis and the column axis matches the column axis. The cell count is your data density.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="supergrid-density"]',
		title: 'Density controls',
		bodyTemplate:
			'Switch between Spreadsheet, Matrix, and Summary layouts to change how much data each cell shows.',
		bodyFallback:
			'Switch between Spreadsheet, Matrix, and Summary layouts to change how much data each cell shows.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="latch-explorers"]',
		title: 'LATCH panel',
		bodyTemplate:
			'Drag any column to the row or column axis to instantly reshape the grid. Location, Alphabet, Time, Category, and Hierarchy \u2014 every axis tells a different story.',
		bodyFallback:
			'Drag any column to the row or column axis to instantly reshape the grid. Location, Alphabet, Time, Category, and Hierarchy \u2014 every axis tells a different story.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="notebook-explorer"]',
		title: 'Notebook',
		bodyTemplate:
			'Click any cell to open a card. The Notebook panel lets you add rich notes directly to that record.',
		bodyFallback:
			'Click any cell to open a card. The Notebook panel lets you add rich notes directly to that record.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="command-palette-trigger"]',
		title: 'Command palette',
		bodyTemplate:
			'Press Cmd+K to open the command palette. Every action \u2014 switching views, applying presets, restarting this tour \u2014 lives here.',
		bodyFallback:
			'Press Cmd+K to open the command palette. Every action \u2014 switching views, applying presets, restarting this tour \u2014 lives here.',
		isLastStep: false,
	},
	{
		target: '[data-tour-target="supergrid"]',
		title: "You're ready",
		bodyTemplate: "That's Isometry. Press Cmd+K anytime, or explore on your own.",
		bodyFallback: "That's Isometry. Press Cmd+K anytime, or explore on your own.",
		isLastStep: true,
	},
];
