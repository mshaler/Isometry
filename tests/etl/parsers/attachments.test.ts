// Isometry v5 — Phase 8 Attachment Parser Tests
// Tests for extracting data from alto-index attachment types

import { describe, expect, it } from 'vitest';
import {
	extractHashtags,
	extractMentions,
	extractNoteLinks,
	parseTableToMarkdown,
} from '../../../src/etl/parsers/attachments';
import type { AltoAttachment } from '../../../src/etl/types';

describe('extractHashtags', () => {
	it('extracts hashtag names from hashtag attachments', () => {
		const attachments: AltoAttachment[] = [
			{
				id: 'att-1',
				type: 'com.apple.notes.inlinetextattachment.hashtag',
				content: '<a class="tag link" href="/tags/ai">#ai</a>',
			},
			{
				id: 'att-2',
				type: 'com.apple.notes.inlinetextattachment.hashtag',
				content: '<a class="tag link" href="/tags/learning">#learning</a>',
			},
		];

		const result = extractHashtags(attachments);

		expect(result).toEqual(['ai', 'learning']);
	});

	it('skips non-hashtag attachments', () => {
		const attachments: AltoAttachment[] = [
			{
				id: 'att-1',
				type: 'public.jpeg',
				path: '/path/to/image.jpg',
			},
			{
				id: 'att-2',
				type: 'com.apple.notes.inlinetextattachment.hashtag',
				content: '<a class="tag link" href="/tags/photo">#photo</a>',
			},
		];

		const result = extractHashtags(attachments);

		expect(result).toEqual(['photo']);
	});

	it('handles attachments with no content', () => {
		const attachments: AltoAttachment[] = [
			{
				id: 'att-1',
				type: 'com.apple.notes.inlinetextattachment.hashtag',
			},
		];

		const result = extractHashtags(attachments);

		expect(result).toEqual([]);
	});

	it('returns empty array for empty input', () => {
		const result = extractHashtags([]);

		expect(result).toEqual([]);
	});
});

describe('extractNoteLinks', () => {
	it('extracts note IDs from link attachments', () => {
		const attachments: AltoAttachment[] = [
			{
				id: 'link-to-12345',
				type: 'com.apple.notes.inlinetextattachment.link',
			},
			{
				id: 'link-to-67890',
				type: 'com.apple.notes.inlinetextattachment.link',
			},
		];

		const result = extractNoteLinks(attachments);

		expect(result).toEqual(['12345', '67890']);
	});

	it('skips non-link attachments', () => {
		const attachments: AltoAttachment[] = [
			{
				id: 'att-1',
				type: 'com.apple.notes.inlinetextattachment.hashtag',
				content: '#test',
			},
			{
				id: 'link-to-99999',
				type: 'com.apple.notes.inlinetextattachment.link',
			},
		];

		const result = extractNoteLinks(attachments);

		expect(result).toEqual(['99999']);
	});

	it('returns empty array for empty input', () => {
		const result = extractNoteLinks([]);

		expect(result).toEqual([]);
	});
});

describe('parseTableToMarkdown', () => {
	it('converts HTML table to Markdown syntax', () => {
		const html = `
      <table>
        <tr>
          <th>Name</th>
          <th>Age</th>
        </tr>
        <tr>
          <td>Alice</td>
          <td>30</td>
        </tr>
        <tr>
          <td>Bob</td>
          <td>25</td>
        </tr>
      </table>
    `;

		const result = parseTableToMarkdown(html);

		expect(result).toBe('| Name | Age |\n' + '| --- | --- |\n' + '| Alice | 30 |\n' + '| Bob | 25 |');
	});

	it('handles single row table', () => {
		const html = `
      <table>
        <tr>
          <td>Solo</td>
        </tr>
      </table>
    `;

		const result = parseTableToMarkdown(html);

		expect(result).toBe('| Solo |\n| --- |');
	});

	it('returns empty string for empty table', () => {
		const html = '<table></table>';

		const result = parseTableToMarkdown(html);

		expect(result).toBe('');
	});

	it('strips nested HTML tags from cells', () => {
		const html = `
      <table>
        <tr>
          <td><strong>Bold</strong></td>
          <td><em>Italic</em></td>
        </tr>
      </table>
    `;

		const result = parseTableToMarkdown(html);

		expect(result).toBe('| Bold | Italic |\n| --- | --- |');
	});
});

describe('extractMentions', () => {
	it('extracts two-word @mentions', () => {
		const content = 'Meeting with @John Smith today.';

		const result = extractMentions(content);

		expect(result).toEqual(['john smith']);
	});

	it('extracts single-word @mentions', () => {
		const content = 'Ask @Alice about the report.';

		const result = extractMentions(content);

		expect(result).toEqual(['alice']);
	});

	it('extracts multiple mentions', () => {
		const content = '@John Smith and @Alice discussed it with @Bob.';

		const result = extractMentions(content);

		expect(result).toEqual(['john smith', 'alice', 'bob']);
	});

	it('deduplicates mentions', () => {
		const content = '@Alice mentioned it. Later, @Alice confirmed.';

		const result = extractMentions(content);

		expect(result).toEqual(['alice']);
	});

	it('returns empty array when no mentions', () => {
		const content = 'This is a note without mentions.';

		const result = extractMentions(content);

		expect(result).toEqual([]);
	});

	it('handles mentions at start and end of content', () => {
		const content = '@Start mentioned something. Something mentioned @End';

		const result = extractMentions(content);

		expect(result).toEqual(['start', 'end']);
	});
});
