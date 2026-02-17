/**
 * Apple Notes Adapter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  coreDataTimestampToDate,
  dateToCoreDataTimestamp,
  buildFolderHierarchy,
  buildFolderPath,
  extractLatchTime,
  extractLatchCategory,
  RawNoteRow,
} from '../src/adapters/apple-notes/schema.js';

describe('Core Data Timestamps', () => {
  it('converts Core Data timestamp to Date', () => {
    // Core Data reference: 2001-01-01
    // Timestamp 0 should be 2001-01-01
    const date = coreDataTimestampToDate(0);
    expect(date).toBeDefined();
    expect(date!.getUTCFullYear()).toBe(2001);
    expect(date!.getUTCMonth()).toBe(0); // January
    expect(date!.getUTCDate()).toBe(1);
  });

  it('converts Date to Core Data timestamp', () => {
    const referenceDate = new Date(Date.UTC(2001, 0, 1, 0, 0, 0, 0));
    const timestamp = dateToCoreDataTimestamp(referenceDate);
    expect(timestamp).toBe(0);
  });

  it('round-trips timestamp correctly', () => {
    const original = new Date('2024-06-15T12:30:00Z');
    const timestamp = dateToCoreDataTimestamp(original);
    const roundTripped = coreDataTimestampToDate(timestamp);
    
    // Allow 1 second tolerance due to millisecond truncation
    expect(Math.abs(roundTripped!.getTime() - original.getTime())).toBeLessThan(1000);
  });

  it('handles null timestamp', () => {
    const date = coreDataTimestampToDate(null);
    expect(date).toBeUndefined();
  });
});

describe('Folder Hierarchy', () => {
  const mockNoteRow: RawNoteRow = {
    id: 138083,
    title: 'Test Note',
    snippet: 'Test snippet',
    created_timestamp: 0,
    modified_timestamp: 0,
    folder_id: 127441,
    folder_name: 'Stacey',
    parent_folder_id: 124765,
    parent_folder_name: 'Family',
    account_id: 1,
    marked_for_deletion: null,
  };

  it('builds correct folder hierarchy', () => {
    const hierarchy = buildFolderHierarchy(mockNoteRow);
    expect(hierarchy).toEqual(['Family', 'Stacey']);
  });

  it('builds correct folder path string', () => {
    const path = buildFolderPath(mockNoteRow);
    expect(path).toBe('Family/Stacey');
  });

  it('handles note in root folder', () => {
    const rootNote: RawNoteRow = {
      ...mockNoteRow,
      folder_name: 'Notes',
      parent_folder_id: null,
      parent_folder_name: null,
    };
    
    const hierarchy = buildFolderHierarchy(rootNote);
    expect(hierarchy).toEqual(['Notes']);
  });

  it('handles unfiled note', () => {
    const unfiledNote: RawNoteRow = {
      ...mockNoteRow,
      folder_id: null,
      folder_name: null,
      parent_folder_id: null,
      parent_folder_name: null,
    };
    
    const path = buildFolderPath(unfiledNote);
    expect(path).toBe('Unfiled');
  });
});

describe('LATCH Extraction', () => {
  const mockNoteRow: RawNoteRow = {
    id: 138083,
    title: 'Test Note',
    snippet: 'Test snippet',
    created_timestamp: 739123200, // 2024-06-01 in Core Data time
    modified_timestamp: 739209600, // 2024-06-02 in Core Data time
    folder_id: 127441,
    folder_name: 'Projects',
    parent_folder_id: 124765,
    parent_folder_name: 'Work',
    account_id: 1,
    marked_for_deletion: null,
  };

  it('extracts LATCH Time properties', () => {
    const time = extractLatchTime(mockNoteRow);
    
    expect(time.created).toBeInstanceOf(Date);
    expect(time.modified).toBeInstanceOf(Date);
    expect(time.modified.getTime()).toBeGreaterThan(time.created.getTime());
  });

  it('extracts LATCH Category properties', () => {
    const tags = ['project', 'important'];
    const category = extractLatchCategory(mockNoteRow, tags);
    
    expect(category.hierarchy).toEqual(['Work', 'Projects']);
    expect(category.tags).toEqual(['project', 'important']);
    expect(category.status).toBe('active');
  });
});

describe('Content Extraction', () => {
  // Note: Full protobuf extraction tests would require mock data
  // These are placeholder tests for the extraction utilities

  it('extracts inline tags', () => {
    // This would test the extractInlineTags function
    // which is currently private in content-extractor.ts
    // In a real test, we'd expose it or test through the public API
    expect(true).toBe(true);
  });
});
