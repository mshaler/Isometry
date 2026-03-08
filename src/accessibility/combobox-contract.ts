// Isometry v5 -- Phase 50 WAI-ARIA Combobox Contract
// Establishes the accessibility pattern that Phase 51's command palette MUST follow.
//
// This contract defines the ARIA attributes, roles, and keyboard interactions
// required by the WAI-ARIA 1.2 Combobox pattern (APG).
//
// Requirements: A11Y-11

/**
 * WAI-ARIA combobox attribute constants for Phase 51 command palette.
 *
 * Usage: Phase 51 applies these attributes when building the command palette:
 *   - Input element: spread COMBOBOX_ATTRS.input onto the text input
 *   - Listbox element: spread COMBOBOX_ATTRS.listbox onto the results container
 *   - Option elements: spread COMBOBOX_ATTRS.option onto each result item
 *   - Keyboard: implement the interactions described in COMBOBOX_ATTRS.keyboard
 *
 * Pattern: ARIA 1.2 Combobox with manual selection (aria-autocomplete="list")
 *   - role="combobox" is on the INPUT element (not a wrapper div)
 *   - aria-expanded toggles between 'false' and 'true' when listbox visibility changes
 *   - aria-activedescendant updates to the id of the focused option on ArrowDown/ArrowUp
 *   - aria-controls points to the listbox element's id
 */
export const COMBOBOX_ATTRS = {
	input: {
		role: 'combobox',
		'aria-expanded': 'false', // 'true' when listbox visible
		'aria-controls': 'palette-listbox',
		'aria-autocomplete': 'list',
		'aria-activedescendant': '', // updated to focused option id
	},
	listbox: {
		role: 'listbox',
		id: 'palette-listbox',
	},
	option: {
		role: 'option',
		// id: `palette-option-${index}` (dynamic, set per-item)
	},
	keyboard: {
		open: 'Cmd+K',
		close: 'Escape',
		navigate: 'ArrowDown / ArrowUp',
		select: 'Enter',
	},
} as const;
