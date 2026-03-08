// Isometry v5 -- Phase 50 Plan 03: Keyboard Navigation + Combobox Contract Tests
//
// Tests:
//   1. WAI-ARIA combobox contract has required attributes and follows ARIA 1.2 pattern
//   2. Combobox keyboard interactions are documented
//   3. Barrel export includes COMBOBOX_ATTRS

import { describe, expect, it } from 'vitest';
import { COMBOBOX_ATTRS } from '../../src/accessibility/combobox-contract';
import { COMBOBOX_ATTRS as BarrelComboboxAttrs } from '../../src/accessibility/index';

// ---------------------------------------------------------------------------
// WAI-ARIA Combobox Contract Tests
// ---------------------------------------------------------------------------

describe('COMBOBOX_ATTRS', () => {
	describe('input attributes', () => {
		it('has role="combobox" on the input (ARIA 1.2 pattern: role on input, not wrapper)', () => {
			expect(COMBOBOX_ATTRS.input.role).toBe('combobox');
		});

		it('has aria-expanded defaulting to "false"', () => {
			expect(COMBOBOX_ATTRS.input['aria-expanded']).toBe('false');
		});

		it('has aria-controls pointing to listbox id', () => {
			expect(COMBOBOX_ATTRS.input['aria-controls']).toBe('palette-listbox');
		});

		it('has aria-autocomplete="list" for manual selection pattern', () => {
			expect(COMBOBOX_ATTRS.input['aria-autocomplete']).toBe('list');
		});

		it('has aria-activedescendant initialized to empty string', () => {
			expect(COMBOBOX_ATTRS.input['aria-activedescendant']).toBe('');
		});
	});

	describe('listbox attributes', () => {
		it('has role="listbox"', () => {
			expect(COMBOBOX_ATTRS.listbox.role).toBe('listbox');
		});

		it('has id matching aria-controls from input', () => {
			expect(COMBOBOX_ATTRS.listbox.id).toBe(COMBOBOX_ATTRS.input['aria-controls']);
		});
	});

	describe('option attributes', () => {
		it('has role="option"', () => {
			expect(COMBOBOX_ATTRS.option.role).toBe('option');
		});
	});

	describe('keyboard interactions', () => {
		it('defines Cmd+K to open the palette', () => {
			expect(COMBOBOX_ATTRS.keyboard.open).toBe('Cmd+K');
		});

		it('defines Escape to close the palette', () => {
			expect(COMBOBOX_ATTRS.keyboard.close).toBe('Escape');
		});

		it('defines ArrowDown/ArrowUp to navigate options', () => {
			expect(COMBOBOX_ATTRS.keyboard.navigate).toContain('ArrowDown');
			expect(COMBOBOX_ATTRS.keyboard.navigate).toContain('ArrowUp');
		});

		it('defines Enter to select the focused option', () => {
			expect(COMBOBOX_ATTRS.keyboard.select).toBe('Enter');
		});
	});

	describe('ARIA 1.2 compliance', () => {
		it('follows ARIA 1.2 pattern: role=combobox on input element (not on a wrapper)', () => {
			// ARIA 1.2 requires role="combobox" on the input element itself,
			// not on a parent wrapper div (which was the ARIA 1.0 pattern)
			expect(COMBOBOX_ATTRS.input.role).toBe('combobox');
			// Verify there is no wrapper-level role defined
			expect(COMBOBOX_ATTRS).not.toHaveProperty('wrapper');
		});

		it('aria-controls on input matches id on listbox', () => {
			expect(COMBOBOX_ATTRS.input['aria-controls']).toBe(COMBOBOX_ATTRS.listbox.id);
		});

		it('has all required ARIA attributes for a combobox input', () => {
			const input = COMBOBOX_ATTRS.input;
			expect(input).toHaveProperty('role');
			expect(input).toHaveProperty('aria-expanded');
			expect(input).toHaveProperty('aria-controls');
			expect(input).toHaveProperty('aria-autocomplete');
			expect(input).toHaveProperty('aria-activedescendant');
		});

		it('contract is readonly (as const)', () => {
			// TypeScript enforces this at compile time, but we can verify
			// the structure matches the expected readonly pattern
			expect(typeof COMBOBOX_ATTRS).toBe('object');
			expect(typeof COMBOBOX_ATTRS.input).toBe('object');
			expect(typeof COMBOBOX_ATTRS.listbox).toBe('object');
			expect(typeof COMBOBOX_ATTRS.option).toBe('object');
			expect(typeof COMBOBOX_ATTRS.keyboard).toBe('object');
		});
	});
});

// ---------------------------------------------------------------------------
// Barrel Export Verification
// ---------------------------------------------------------------------------

describe('Accessibility barrel export', () => {
	it('re-exports COMBOBOX_ATTRS from index.ts', () => {
		expect(BarrelComboboxAttrs).toBe(COMBOBOX_ATTRS);
	});

	it('barrel COMBOBOX_ATTRS has the same input role', () => {
		expect(BarrelComboboxAttrs.input.role).toBe('combobox');
	});
});
