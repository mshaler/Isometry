// Isometry v5 — Phase 8 ETL Type Validation Tests
// Ensures canonical ETL types satisfy integration contracts

import { describe, it, expect } from 'vitest';
import type {
  CanonicalCard,
  CanonicalConnection,
  ImportResult,
  ParseError,
  SourceType,
  AltoNoteFrontmatter,
  AltoAttachment,
} from '../../src/etl/types';

describe('ETL Type Contracts', () => {
  describe('CanonicalCard', () => {
    it('should satisfy required Card fields with tags as string array', () => {
      const card: CanonicalCard = {
        // Identity
        id: 'card-123',
        card_type: 'note',

        // Content
        name: 'Test Card',
        content: 'Test content',
        summary: null,

        // Location
        latitude: null,
        longitude: null,
        location_name: null,

        // Time
        created_at: '2026-03-01T00:00:00Z',
        modified_at: '2026-03-01T00:00:00Z',
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,

        // Category
        folder: 'Inbox',
        tags: ['etl', 'test'], // String array, not JSON string
        status: null,

        // Hierarchy
        priority: 0,
        sort_order: 0,

        // Resource
        url: null,
        mime_type: null,

        // Collection
        is_collective: false,

        // Source (required for ETL)
        source: 'apple_notes',
        source_id: 'note-123',
        source_url: 'notes://showNote?identifier=123',

        // Lifecycle
        deleted_at: null,
      };

      expect(card.tags).toBeInstanceOf(Array);
      expect(card.source).toBe('apple_notes');
      expect(card.source_id).toBe('note-123');
    });
  });

  describe('CanonicalConnection', () => {
    it('should have all required Connection fields', () => {
      const conn: CanonicalConnection = {
        id: 'conn-123',
        source_id: 'card-1',
        target_id: 'card-2',
        via_card_id: null,
        label: 'references',
        weight: 1.0,
        created_at: '2026-03-01T00:00:00Z',
      };

      expect(conn.source_id).toBe('card-1');
      expect(conn.target_id).toBe('card-2');
      expect(conn.weight).toBe(1.0);
    });
  });

  describe('ImportResult', () => {
    it('should accumulate import metrics correctly', () => {
      const result: ImportResult = {
        inserted: 5,
        updated: 3,
        unchanged: 2,
        skipped: 1,
        errors: 1,
        connections_created: 4,
        insertedIds: ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'],
        errors_detail: [
          {
            index: 10,
            source_id: 'failed-note',
            message: 'Invalid date format',
          },
        ],
      };

      expect(result.inserted).toBe(5);
      expect(result.insertedIds.length).toBe(5);
      expect(result.errors_detail.length).toBe(1);
      expect(result.connections_created).toBe(4);
    });
  });

  describe('ParseError', () => {
    it('should capture error context with nullable source_id', () => {
      const error: ParseError = {
        index: 5,
        source_id: null, // Source ID might not be available for parse errors
        message: 'Malformed frontmatter',
      };

      expect(error.index).toBe(5);
      expect(error.source_id).toBeNull();
      expect(error.message).toBe('Malformed frontmatter');
    });
  });

  describe('SourceType', () => {
    it('should include all supported source types', () => {
      const sources: SourceType[] = [
        'apple_notes',
        'markdown',
        'excel',
        'csv',
        'json',
        'html',
      ];

      sources.forEach((source) => {
        expect(typeof source).toBe('string');
      });
    });
  });

  describe('AltoNoteFrontmatter', () => {
    it('should match alto-index YAML structure', () => {
      const frontmatter: AltoNoteFrontmatter = {
        title: 'Meeting Notes',
        id: 12345,
        created: '2026-03-01T00:00:00Z',
        modified: '2026-03-01T12:00:00Z',
        folder: 'Work',
        attachments: [
          {
            id: 'att-1',
            type: 'com.apple.notes.inlinetextattachment.hashtag',
            content: '<span>#project</span>',
          },
        ],
        links: ['note-456'],
        source: 'notes://showNote?identifier=12345',
      };

      expect(frontmatter.id).toBe(12345);
      expect(frontmatter.attachments).toBeDefined();
      expect(frontmatter.attachments?.length).toBeGreaterThan(0);
      expect(frontmatter.attachments?.[0]?.type).toContain('hashtag');
    });
  });

  describe('AltoAttachment', () => {
    it('should support hashtag attachments with content', () => {
      const hashtag: AltoAttachment = {
        id: 'att-1',
        type: 'com.apple.notes.inlinetextattachment.hashtag',
        title: 'project',
        content: '<span>#project</span>',
      };

      expect(hashtag.type).toContain('hashtag');
      expect(hashtag.content).toBeDefined();
    });

    it('should support binary attachments with path', () => {
      const image: AltoAttachment = {
        id: 'att-2',
        type: 'public.jpeg',
        path: 'assets/image.jpg',
      };

      expect(image.type).toBe('public.jpeg');
      expect(image.path).toBeDefined();
    });
  });
});
