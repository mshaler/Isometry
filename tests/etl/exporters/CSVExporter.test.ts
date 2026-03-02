// Isometry v5 — CSVExporter Tests
// Phase 09-04 ETL-16: CSV export via PapaParse

import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { CSVExporter } from '../../../src/etl/exporters/CSVExporter';
import type { Card } from '../../../src/database/queries/types';

describe('CSVExporter', () => {
  const exporter = new CSVExporter();

  const sampleCard: Card = {
    id: 'card-001',
    card_type: 'note',
    name: 'Sample Note',
    content: 'This is the note content.',
    summary: 'A sample note',
    latitude: null,
    longitude: null,
    location_name: null,
    created_at: '2024-01-01T12:00:00Z',
    modified_at: '2024-01-02T15:30:00Z',
    due_at: null,
    completed_at: null,
    event_start: null,
    event_end: null,
    folder: 'Projects',
    tags: ['test', 'export'],
    status: 'active',
    priority: 5,
    sort_order: 0,
    url: null,
    mime_type: null,
    is_collective: false,
    source: 'test',
    source_id: 'test-001',
    source_url: null,
    deleted_at: null,
  };

  it('exports cards as CSV with header row', () => {
    const result = exporter.export([sampleCard]);

    // Should have header row
    const lines = result.split('\r\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('card_type');

    // Should have data row
    expect(lines[1]).toContain('card-001');
  });

  it('produces RFC 4180 compliant output (quoted fields)', () => {
    const cardWithCommas: Card = {
      ...sampleCard,
      name: 'Note with, commas, in title',
      content: 'Content with\nnewlines\nand, commas',
    };

    const result = exporter.export([cardWithCommas]);

    // Parse it back to verify compliance
    const parsed = Papa.parse(result, { header: true });
    expect(parsed.errors.length).toBe(0);

    // Name should be preserved correctly
    expect(parsed.data[0].name).toBe('Note with, commas, in title');
  });

  it('exports tags as semicolon-separated string', () => {
    const result = exporter.export([sampleCard]);

    // Parse the CSV
    const parsed = Papa.parse(result, { header: true });

    // Tags should be semicolon-separated
    expect(parsed.data[0].tags).toBe('test;export');
  });

  it('includes all card columns', () => {
    const result = exporter.export([sampleCard]);

    // Parse the CSV
    const parsed = Papa.parse(result, { header: true });
    const row = parsed.data[0];

    // Verify key columns are present
    expect(row.id).toBe('card-001');
    expect(row.name).toBe('Sample Note');
    expect(row.card_type).toBe('note');
    expect(row.content).toBe('This is the note content.');
    expect(row.folder).toBe('Projects');
    expect(row.status).toBe('active');
    expect(row.priority).toBe('5'); // CSV converts to string
    expect(row.source).toBe('test');
    expect(row.source_id).toBe('test-001');
  });

  it('uses Windows line endings (\\r\\n) for Excel compatibility', () => {
    const result = exporter.export([sampleCard]);

    // Should use \r\n, not just \n
    expect(result).toContain('\r\n');
    expect(result.split('\r\n').length).toBeGreaterThan(1);
  });

  it('returns empty string for empty cards array', () => {
    const result = exporter.export([]);

    // PapaParse returns empty string for empty arrays (no header)
    expect(result).toBe('');
  });
});
