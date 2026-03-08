// Isometry v5 — Phase 37 AuditState Tests
// Validates session-only change tracking singleton with subscribe pattern

import { beforeEach, describe, expect, it } from 'vitest';
import { AuditState } from '../../src/audit/AuditState';
import { AUDIT_COLORS, getSourceColor, SOURCE_COLORS, SOURCE_LABELS } from '../../src/audit/audit-colors';
import { toCardDatum } from '../../src/views/types';

describe('AuditState', () => {
	let audit: AuditState;

	beforeEach(() => {
		audit = new AuditState();
	});

	describe('getChangeStatus', () => {
		it('returns "new" for inserted IDs', () => {
			audit.addImportResult({ insertedIds: ['card-1'], updatedIds: [], deletedIds: [] }, 'apple_notes');
			expect(audit.getChangeStatus('card-1')).toBe('new');
		});

		it('returns "modified" for updated IDs', () => {
			audit.addImportResult({ insertedIds: [], updatedIds: ['card-2'], deletedIds: [] }, 'apple_notes');
			expect(audit.getChangeStatus('card-2')).toBe('modified');
		});

		it('returns "deleted" for deleted IDs', () => {
			audit.addImportResult({ insertedIds: [], updatedIds: [], deletedIds: ['card-3'] }, 'apple_notes');
			expect(audit.getChangeStatus('card-3')).toBe('deleted');
		});

		it('returns null for unknown IDs', () => {
			expect(audit.getChangeStatus('unknown-id')).toBeNull();
		});

		it('priority: deleted > modified > new (deleted wins)', () => {
			audit.addImportResult({ insertedIds: ['card-x'], updatedIds: ['card-x'], deletedIds: ['card-x'] }, 'apple_notes');
			expect(audit.getChangeStatus('card-x')).toBe('deleted');
		});

		it('priority: modified > new', () => {
			audit.addImportResult({ insertedIds: ['card-y'], updatedIds: ['card-y'], deletedIds: [] }, 'apple_notes');
			expect(audit.getChangeStatus('card-y')).toBe('modified');
		});
	});

	describe('enabled state', () => {
		it('defaults to false', () => {
			expect(audit.enabled).toBe(false);
		});

		it('toggle() flips enabled', () => {
			audit.toggle();
			expect(audit.enabled).toBe(true);
			audit.toggle();
			expect(audit.enabled).toBe(false);
		});

		it('toggle() notifies subscribers', () => {
			let notified = false;
			audit.subscribe(() => {
				notified = true;
			});
			audit.toggle();
			expect(notified).toBe(true);
		});
	});

	describe('addImportResult', () => {
		it('accumulates across multiple imports (union, not replace)', () => {
			audit.addImportResult({ insertedIds: ['a'], updatedIds: ['b'], deletedIds: ['c'] }, 'apple_notes');
			audit.addImportResult({ insertedIds: ['d'], updatedIds: ['e'], deletedIds: ['f'] }, 'markdown');

			expect(audit.getChangeStatus('a')).toBe('new');
			expect(audit.getChangeStatus('d')).toBe('new');
			expect(audit.getChangeStatus('b')).toBe('modified');
			expect(audit.getChangeStatus('e')).toBe('modified');
			expect(audit.getChangeStatus('c')).toBe('deleted');
			expect(audit.getChangeStatus('f')).toBe('deleted');
		});

		it('notifies subscribers', () => {
			let count = 0;
			audit.subscribe(() => {
				count++;
			});
			audit.addImportResult({ insertedIds: ['a'], updatedIds: [], deletedIds: [] }, 'apple_notes');
			expect(count).toBe(1);
		});

		it('populates cardSourceMap for inserted and updated IDs', () => {
			audit.addImportResult({ insertedIds: ['a'], updatedIds: ['b'], deletedIds: ['c'] }, 'apple_notes');
			expect(audit.getCardSource('a')).toBe('apple_notes');
			expect(audit.getCardSource('b')).toBe('apple_notes');
			// deletedIds do NOT populate cardSourceMap (card is going away)
		});
	});

	describe('getCardSource', () => {
		it('returns source string for known card', () => {
			audit.addImportResult({ insertedIds: ['card-1'], updatedIds: [], deletedIds: [] }, 'markdown');
			expect(audit.getCardSource('card-1')).toBe('markdown');
		});

		it('returns null for unknown card', () => {
			expect(audit.getCardSource('unknown')).toBeNull();
		});
	});

	describe('getDominantSource', () => {
		it('returns the most common source among given IDs', () => {
			audit.addImportResult({ insertedIds: ['a', 'b', 'c'], updatedIds: [], deletedIds: [] }, 'apple_notes');
			audit.addImportResult({ insertedIds: ['d'], updatedIds: [], deletedIds: [] }, 'markdown');

			// 3 apple_notes vs 1 markdown -> apple_notes wins
			expect(audit.getDominantSource(['a', 'b', 'c', 'd'])).toBe('apple_notes');
		});

		it('returns null for empty input', () => {
			expect(audit.getDominantSource([])).toBeNull();
		});

		it('returns null when no IDs have a source', () => {
			expect(audit.getDominantSource(['unknown-1', 'unknown-2'])).toBeNull();
		});
	});

	describe('getDominantChangeStatus', () => {
		it('returns highest-priority status among IDs (deleted > modified > new)', () => {
			audit.addImportResult({ insertedIds: ['a'], updatedIds: ['b'], deletedIds: ['c'] }, 'apple_notes');

			expect(audit.getDominantChangeStatus(['a', 'b', 'c'])).toBe('deleted');
			expect(audit.getDominantChangeStatus(['a', 'b'])).toBe('modified');
			expect(audit.getDominantChangeStatus(['a'])).toBe('new');
		});

		it('returns null for IDs with no status', () => {
			expect(audit.getDominantChangeStatus(['unknown'])).toBeNull();
		});

		it('returns null for empty input', () => {
			expect(audit.getDominantChangeStatus([])).toBeNull();
		});
	});

	describe('subscribe', () => {
		it('returns unsubscribe function', () => {
			let count = 0;
			const unsub = audit.subscribe(() => {
				count++;
			});
			audit.toggle();
			expect(count).toBe(1);

			unsub();
			audit.toggle();
			expect(count).toBe(1); // should not increment after unsubscribe
		});
	});
});

describe('audit-colors', () => {
	it('AUDIT_COLORS has new, modified, deleted', () => {
		expect(AUDIT_COLORS.new).toBe('var(--audit-new)');
		expect(AUDIT_COLORS.modified).toBe('var(--audit-modified)');
		expect(AUDIT_COLORS.deleted).toBe('var(--audit-deleted)');
	});

	it('SOURCE_COLORS has all 9 source types', () => {
		const expected = [
			'apple_notes',
			'markdown',
			'csv',
			'json',
			'excel',
			'html',
			'native_reminders',
			'native_calendar',
			'native_notes',
		];
		for (const key of expected) {
			expect(SOURCE_COLORS[key]).toBeDefined();
			expect(typeof SOURCE_COLORS[key]).toBe('string');
		}
	});

	it('SOURCE_LABELS has human-readable names for all 9 source types', () => {
		expect(SOURCE_LABELS['apple_notes']).toBe('Apple Notes');
		expect(SOURCE_LABELS['markdown']).toBe('Markdown');
		expect(SOURCE_LABELS['csv']).toBe('CSV');
		expect(SOURCE_LABELS['json']).toBe('JSON');
		expect(SOURCE_LABELS['excel']).toBe('Excel');
		expect(SOURCE_LABELS['html']).toBe('HTML');
		expect(SOURCE_LABELS['native_reminders']).toBe('Reminders');
		expect(SOURCE_LABELS['native_calendar']).toBe('Calendar');
		expect(SOURCE_LABELS['native_notes']).toBe('Notes');
	});

	it('getSourceColor returns color for known source', () => {
		expect(getSourceColor('apple_notes')).toBe(SOURCE_COLORS['apple_notes']);
	});

	it('getSourceColor returns null for unknown source', () => {
		expect(getSourceColor('unknown_source')).toBeNull();
	});
});

describe('CardDatum.source', () => {
	it('toCardDatum maps source from row data', () => {
		const row = {
			id: 'test-id',
			name: 'Test',
			folder: null,
			status: null,
			card_type: 'note',
			created_at: '2026-01-01',
			modified_at: '2026-01-01',
			priority: 0,
			sort_order: 0,
			due_at: null,
			body_text: null,
			source: 'apple_notes',
		};

		const card = toCardDatum(row);
		expect(card.source).toBe('apple_notes');
	});

	it('toCardDatum returns null source when row has no source', () => {
		const row = {
			id: 'test-id',
			name: 'Test',
			folder: null,
			status: null,
			card_type: 'note',
			created_at: '2026-01-01',
			modified_at: '2026-01-01',
			priority: 0,
			sort_order: 0,
			due_at: null,
			body_text: null,
		};

		const card = toCardDatum(row);
		expect(card.source).toBeNull();
	});
});
