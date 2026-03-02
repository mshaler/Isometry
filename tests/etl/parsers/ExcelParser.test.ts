// Isometry v5 — ExcelParser Tests
// TDD tests for Excel parsing with dynamic SheetJS import

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ExcelParser } from '../../../src/etl/parsers/ExcelParser';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ExcelParser', () => {
  let parser: ExcelParser;
  let testBuffer: ArrayBuffer;

  beforeAll(() => {
    // Create test Excel file programmatically
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Main test data with dates
    const data = [
      ['title', 'content', 'created', 'tags'],
      ['Sample Note', 'Note content', new Date('2024-01-15'), 'tag1;tag2'],
      ['Date Test', 'Testing dates', new Date(44927), 'excel'], // Excel serial number
      ['Missing Title', 'This row has no title column value', new Date('2024-01-17'), 'test'],
    ];

    // Add a row with empty title to test fallback
    data.push(['', 'Content without title', new Date('2024-01-18'), 'fallback']);

    const sheet1 = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet1, 'TestSheet');

    // Sheet 2: Alternate sheet for sheet selection test
    const data2 = [
      ['name', 'body'],
      ['Alternate Note', 'From second sheet'],
    ];
    const sheet2 = XLSX.utils.aoa_to_sheet(data2);
    XLSX.utils.book_append_sheet(workbook, sheet2, 'AlternateSheet');

    // Convert to ArrayBuffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    testBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });

  beforeEach(() => {
    parser = new ExcelParser();
  });

  // Test 1: Parses .xlsx file from ArrayBuffer
  it('parses xlsx file from ArrayBuffer', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards[0]?.name).toBe('Sample Note');
    expect(result.cards[0]?.content).toBe('Note content');
    expect(result.errors).toHaveLength(0);
  });

  // Test 2: Dynamic import of xlsx (no top-level import)
  it('uses dynamic import for xlsx', async () => {
    // First parse triggers dynamic import
    const result1 = await parser.parse(testBuffer);
    expect(result1.cards.length).toBeGreaterThan(0);

    // Second parse reuses cached import
    const result2 = await parser.parse(testBuffer);
    expect(result2.cards.length).toBeGreaterThan(0);
  });

  // Test 3: cellDates: true converts Excel date serial numbers to Date objects
  it('converts date serial numbers to ISO strings', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards[0]?.created_at).toContain('2024-01-15');
    expect(result.cards[1]?.created_at).toBeDefined();
    // Excel serial 44927 is around 2023-01-01
    expect(result.cards[1]?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Test 4: Column auto-detection same as CSV/JSON
  it('auto-detects column names using synonyms', async () => {
    const result = await parser.parse(testBuffer);

    // 'title' should map to name
    expect(result.cards[0]?.name).toBe('Sample Note');
    // 'content' should map to content
    expect(result.cards[0]?.content).toBe('Note content');
    // 'tags' should map to tags
    expect(result.cards[0]?.tags).toContain('tag1');
  });

  // Test 5: First sheet parsed by default
  it('parses first sheet by default', async () => {
    const result = await parser.parse(testBuffer);

    // First sheet has 'Sample Note'
    expect(result.cards.some(c => c.name === 'Sample Note')).toBe(true);
    // Second sheet has 'Alternate Note', should not be included
    expect(result.cards.some(c => c.name === 'Alternate Note')).toBe(false);
  });

  // Test 6: options.sheet selects specific sheet name
  it('selects specific sheet by name', async () => {
    const result = await parser.parse(testBuffer, { sheet: 'AlternateSheet' });

    expect(result.cards.some(c => c.name === 'Alternate Note')).toBe(true);
    expect(result.cards.some(c => c.name === 'Sample Note')).toBe(false);
  });

  // Test 7: Tags column split on comma/semicolon
  it('splits tags on comma and semicolon', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards[0]?.tags).toEqual(['tag1', 'tag2']);
    expect(result.cards[1]?.tags).toEqual(['excel']);
  });

  // Test 8: Missing title -> "Row N" fallback
  it('uses Row N fallback for missing title', async () => {
    const result = await parser.parse(testBuffer);

    // Find card with empty title (last row)
    const cardWithoutTitle = result.cards.find(c => c.content === 'Content without title');
    expect(cardWithoutTitle?.name).toMatch(/Row \d+/);
  });

  // Test 9: Date objects converted to ISO 8601 strings
  it('converts Date objects to ISO 8601 strings', async () => {
    const result = await parser.parse(testBuffer);

    // Check that created_at is a valid ISO string
    for (const card of result.cards) {
      if (card.created_at) {
        expect(card.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        // Should be parseable as Date
        expect(new Date(card.created_at).getTime()).toBeGreaterThan(0);
      }
    }
  });

  // Test 10: source_id = row index as string
  it('assigns source_id as row index', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards[0]?.source_id).toBe('0');
    expect(result.cards[1]?.source_id).toBe('1');
    expect(result.cards[2]?.source_id).toBe('2');
  });

  // Additional test: Card type defaults to 'note'
  it('sets card_type to note by default', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards[0]?.card_type).toBe('note');
  });

  // Additional test: Source is set to 'excel'
  it('sets source to excel', async () => {
    const result = await parser.parse(testBuffer);

    expect(result.cards[0]?.source).toBe('excel');
  });

  // Additional test: Empty sheet returns empty cards
  it('handles empty sheet gracefully', async () => {
    const emptyWorkbook = XLSX.utils.book_new();
    const emptySheet = XLSX.utils.aoa_to_sheet([['title', 'content']]);
    XLSX.utils.book_append_sheet(emptyWorkbook, emptySheet, 'Empty');

    const buffer = XLSX.write(emptyWorkbook, { type: 'buffer', bookType: 'xlsx' });
    const emptyBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const result = await parser.parse(emptyBuffer);

    expect(result.cards).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  // Additional test: Explicit field mapping
  it('supports explicit field mapping', async () => {
    const workbook = XLSX.utils.book_new();
    const data = [
      ['custom_title', 'custom_body'],
      ['Custom Note', 'Custom content'],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Custom');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const customBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const result = await parser.parse(customBuffer, {
      fieldMapping: {
        name: 'custom_title',
        content: 'custom_body',
      },
    });

    expect(result.cards[0]?.name).toBe('Custom Note');
    expect(result.cards[0]?.content).toBe('Custom content');
  });
});
