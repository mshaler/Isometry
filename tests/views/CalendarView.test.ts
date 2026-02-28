// @vitest-environment jsdom
// Isometry v5 — CalendarView Tests
// Tests for CalendarView: month grid, first-day offset, overflow, granularity switch, NULL filtering.
//
// Requirements: VIEW-04

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Task 1 — CardDatum expansion: due_at + body_text
// ---------------------------------------------------------------------------

describe('CardDatum expansion — due_at and body_text', () => {
  it('CardDatum interface includes due_at field', () => {
    const card: CardDatum = {
      id: 'test-1',
      name: 'Test Card',
      folder: null,
      status: null,
      card_type: 'note',
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
      priority: 0,
      sort_order: 0,
      due_at: '2026-03-15T10:00:00Z',
      body_text: 'Some body content',
    };
    expect(card.due_at).toBe('2026-03-15T10:00:00Z');
    expect(card.body_text).toBe('Some body content');
  });

  it('CardDatum accepts null for due_at and body_text', () => {
    const card: CardDatum = {
      id: 'test-2',
      name: 'No Date Card',
      folder: null,
      status: null,
      card_type: 'task',
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
      priority: 0,
      sort_order: 0,
      due_at: null,
      body_text: null,
    };
    expect(card.due_at).toBeNull();
    expect(card.body_text).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Placeholder for Task 2 — CalendarView implementation
// These will be filled in during the Task 2 RED phase.
// ---------------------------------------------------------------------------
