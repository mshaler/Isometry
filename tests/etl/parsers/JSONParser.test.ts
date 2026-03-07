// Isometry v5 — JSONParser Tests
// TDD tests for JSON array parsing with field auto-detection

import { beforeEach, describe, expect, it } from 'vitest';
import { JSONParser } from '../../../src/etl/parsers/JSONParser';

describe('JSONParser', () => {
	let parser: JSONParser;

	beforeEach(() => {
		parser = new JSONParser();
	});

	// Test 1: Parses JSON array of objects into cards
	it('parses JSON array of objects into cards', () => {
		const input = JSON.stringify([
			{ title: 'First', content: 'Content 1' },
			{ title: 'Second', content: 'Content 2' },
		]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(2);
		expect(result.cards[0]?.name).toBe('First');
		expect(result.cards[0]?.content).toBe('Content 1');
		expect(result.cards[1]?.name).toBe('Second');
		expect(result.cards[1]?.content).toBe('Content 2');
		expect(result.errors).toHaveLength(0);
	});

	// Test 2: Single object wrapped in array for consistent processing
	it('wraps single object in array', () => {
		const input = JSON.stringify({ title: 'Single Note', content: 'Just one' });

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.name).toBe('Single Note');
		expect(result.cards[0]?.content).toBe('Just one');
	});

	// Test 3: Auto-detects common field names
	it('auto-detects field name synonyms', () => {
		const input = JSON.stringify([
			{ name: 'Note 1', body: 'Body text', labels: 'tag1,tag2', date: '2024-01-15T10:00:00Z' },
			{ subject: 'Note 2', description: 'Desc text', categories: 'cat1', timestamp: '2024-01-16T11:00:00Z' },
		]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(2);
		expect(result.cards[0]?.name).toBe('Note 1');
		expect(result.cards[0]?.content).toBe('Body text');
		expect(result.cards[0]?.tags).toEqual(['tag1', 'tag2']);
		expect(result.cards[0]?.created_at).toBe('2024-01-15T10:00:00Z');
		expect(result.cards[1]?.name).toBe('Note 2');
		expect(result.cards[1]?.content).toBe('Desc text');
		expect(result.cards[1]?.tags).toEqual(['cat1']);
		expect(result.cards[1]?.created_at).toBe('2024-01-16T11:00:00Z');
	});

	// Test 4: Explicit field mapping via options overrides auto-detection
	it('uses explicit field mapping over auto-detection', () => {
		const input = JSON.stringify([{ custom_title: 'Custom', custom_body: 'Body' }]);

		const result = parser.parse(input, {
			fieldMapping: {
				name: 'custom_title',
				content: 'custom_body',
			},
		});

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.name).toBe('Custom');
		expect(result.cards[0]?.content).toBe('Body');
	});

	// Test 5: Nested items/data/records keys auto-detected and extracted
	it('extracts nested items/data/records arrays', () => {
		const nestedItems = JSON.stringify({
			items: [{ title: 'Item 1' }, { title: 'Item 2' }],
		});
		const nestedData = JSON.stringify({
			data: [{ title: 'Data 1' }],
		});
		const nestedRecords = JSON.stringify({
			records: [{ title: 'Record 1' }],
		});

		const result1 = parser.parse(nestedItems);
		const result2 = parser.parse(nestedData);
		const result3 = parser.parse(nestedRecords);

		expect(result1.cards).toHaveLength(2);
		expect(result1.cards[0]?.name).toBe('Item 1');
		expect(result2.cards).toHaveLength(1);
		expect(result2.cards[0]?.name).toBe('Data 1');
		expect(result3.cards).toHaveLength(1);
		expect(result3.cards[0]?.name).toBe('Record 1');
	});

	// Test 6: Tags from array used directly; string split on comma/semicolon
	it('handles tags as array or delimited string', () => {
		const input = JSON.stringify([
			{ title: 'Note 1', tags: ['tag1', 'tag2'] },
			{ title: 'Note 2', tags: 'tag3,tag4' },
			{ title: 'Note 3', tags: 'tag5;tag6' },
			{ title: 'Note 4', tags: 'tag7, tag8 ; tag9' },
		]);

		const result = parser.parse(input);

		expect(result.cards[0]?.tags).toEqual(['tag1', 'tag2']);
		expect(result.cards[1]?.tags).toEqual(['tag3', 'tag4']);
		expect(result.cards[2]?.tags).toEqual(['tag5', 'tag6']);
		expect(result.cards[3]?.tags).toEqual(['tag7', 'tag8', 'tag9']);
	});

	// Test 7: Nested object values JSON.stringify'd for content
	it('stringifies nested objects to JSON', () => {
		const input = JSON.stringify([
			{
				title: 'Note with nested data',
				content: { key1: 'value1', key2: { nested: 'value2' } },
			},
		]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(1);
		expect(typeof result.cards[0]?.content).toBe('string');
		const parsed = JSON.parse(result.cards[0]?.content ?? '');
		expect(parsed.key1).toBe('value1');
		expect(parsed.key2.nested).toBe('value2');
	});

	// Test 8: null field values handled gracefully
	it('handles null values gracefully', () => {
		const input = JSON.stringify([{ title: 'Note', content: null, tags: null }]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.name).toBe('Note');
		expect(result.cards[0]?.content).toBeNull();
		expect(result.cards[0]?.tags).toEqual([]);
	});

	// Test 9: Invalid JSON throws ParseError
	it('returns error for invalid JSON', () => {
		const input = '{ invalid json }';

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.message).toContain('Invalid JSON');
	});

	// Test 10: source_id = array index as string
	it('assigns source_id as array index', () => {
		const input = JSON.stringify([{ title: 'First' }, { title: 'Second' }, { title: 'Third' }]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(3);
		expect(result.cards[0]?.source_id).toBe('0');
		expect(result.cards[1]?.source_id).toBe('1');
		expect(result.cards[2]?.source_id).toBe('2');
	});

	// Test: Deeply nested data extraction
	it('extracts deeply nested items (data.items)', () => {
		const input = JSON.stringify({
			data: {
				items: [{ name: 'Nested Item', description: 'Deep nesting' }],
			},
		});

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.name).toBe('Nested Item');
		expect(result.cards[0]?.content).toBe('Deep nesting');
	});

	// Test: Empty array returns no cards
	it('handles empty array', () => {
		const input = JSON.stringify([]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	// Test: Missing title field uses fallback
	it('uses fallback for missing title', () => {
		const input = JSON.stringify([{ content: 'Content without title' }]);

		const result = parser.parse(input);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]?.name).toMatch(/Row 0|Untitled|Item 0/i);
	});

	// Test: Card type defaults to 'note'
	it('sets card_type to note by default', () => {
		const input = JSON.stringify([{ title: 'Test' }]);

		const result = parser.parse(input);

		expect(result.cards[0]?.card_type).toBe('note');
	});

	// Test: Source is set to 'json'
	it('sets source to json', () => {
		const input = JSON.stringify([{ title: 'Test' }]);

		const result = parser.parse(input);

		expect(result.cards[0]?.source).toBe('json');
	});
});
