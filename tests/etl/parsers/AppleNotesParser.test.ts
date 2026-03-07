// Isometry v5 — Phase 8 AppleNotesParser Tests
// Tests for alto-index Markdown parsing

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppleNotesParser } from '../../../src/etl/parsers/AppleNotesParser';

describe('AppleNotesParser', () => {
	const parser = new AppleNotesParser();

	it('parses alto-index Markdown with YAML frontmatter', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		expect(result.errors).toEqual([]);
		expect(result.cards.length).toBeGreaterThan(0);
	});

	it('creates note card with correct fields', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const noteCard = result.cards.find((c) => c.card_type === 'note');
		expect(noteCard).toBeDefined();
		expect(noteCard?.name).toBe('Sample Note');
		expect(noteCard?.source).toBe('apple_notes');
		expect(noteCard?.source_id).toBe('12345');
		expect(noteCard?.source_url).toBe('notes://showNote?identifier=12345');
		expect(noteCard?.folder).toBe('Learning/ClaudeAI');
		expect(noteCard?.created_at).toBe('2026-02-01T10:30:00Z');
		expect(noteCard?.modified_at).toBe('2026-02-15T14:45:00Z');
	});

	it('extracts hashtags from attachments', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const noteCard = result.cards.find((c) => c.card_type === 'note');
		expect(noteCard?.tags).toEqual(['ai', 'learning']);
	});

	it('creates person cards for @mentions', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const personCards = result.cards.filter((c) => c.card_type === 'person');
		expect(personCards.length).toBe(2);

		const names = personCards.map((c) => c.name).sort();
		expect(names).toEqual(['alice', 'john smith']);
	});

	it('creates mentions connections', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const mentionsConnections = result.connections.filter((c) => c.label === 'mentions');
		expect(mentionsConnections.length).toBe(2);
	});

	it('creates resource cards for external URLs', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const resourceCards = result.cards.filter((c) => c.card_type === 'resource');
		expect(resourceCards.length).toBe(2);

		const urls = resourceCards.map((c) => c.url).sort();
		expect(urls).toEqual(['https://anthropic.com', 'mailto:contact@example.com']);
	});

	it('creates links_to connections for URLs', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const urlConnections = result.connections.filter(
			(c) =>
				c.label === 'links_to' && result.cards.find((card) => card.id === c.target_id && card.card_type === 'resource'),
		);
		expect(urlConnections.length).toBe(2);
	});

	it('creates links_to connections for internal note links', () => {
		const content = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const result = parser.parse([{ path: 'sample.md', content }]);

		const noteLinks = result.connections.filter((c) => c.label === 'links_to' && c.target_id === '67890');
		expect(noteLinks.length).toBe(1);
	});

	it('handles parse errors without aborting', () => {
		const validContent = readFileSync(join(__dirname, '../fixtures/apple-notes-sample.md'), 'utf-8');

		const invalidContent = 'invalid markdown without frontmatter';

		const result = parser.parse([
			{ path: 'valid.md', content: validContent },
			{ path: 'invalid.md', content: invalidContent },
		]);

		expect(result.errors.length).toBe(1);
		expect(result.errors[0]?.index).toBe(1);
		expect(result.cards.length).toBeGreaterThan(0); // Should still have cards from valid file
	});

	it('deduplicates person cards within parse session', () => {
		const content1 = `---
title: Note 1
id: 1
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
source: "notes://showNote?identifier=1"
---
@Alice mentioned.`;

		const content2 = `---
title: Note 2
id: 2
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
source: "notes://showNote?identifier=2"
---
@Alice mentioned again.`;

		const result = parser.parse([
			{ path: 'note1.md', content: content1 },
			{ path: 'note2.md', content: content2 },
		]);

		const personCards = result.cards.filter((c) => c.card_type === 'person' && c.name === 'alice');
		expect(personCards.length).toBe(1); // Should be deduplicated
	});

	it('falls back to first heading for title when frontmatter title missing', () => {
		const content = `---
id: 999
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
source: "notes://showNote?identifier=999"
---

# My Heading

Content here.`;

		const result = parser.parse([{ path: 'test.md', content }]);

		const noteCard = result.cards.find((c) => c.card_type === 'note');
		expect(noteCard?.name).toBe('My Heading');
	});

	it('falls back to first line for title when no heading', () => {
		const content = `---
id: 999
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
source: "notes://showNote?identifier=999"
---

This is the first line of content.
More content follows.`;

		const result = parser.parse([{ path: 'test.md', content }]);

		const noteCard = result.cards.find((c) => c.card_type === 'note');
		expect(noteCard?.name).toBe('This is the first line of content.');
	});

	it('uses "Untitled Note" when no title available', () => {
		const content = `---
id: 999
created: "2026-01-01T00:00:00Z"
modified: "2026-01-01T00:00:00Z"
source: "notes://showNote?identifier=999"
---

`;

		const result = parser.parse([{ path: 'test.md', content }]);

		const noteCard = result.cards.find((c) => c.card_type === 'note');
		expect(noteCard?.name).toBe('Untitled Note');
	});
});
