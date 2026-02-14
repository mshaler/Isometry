import { describe, it, expect } from 'vitest';
import {
  isNote,
  isPerson,
  isEvent,
  isResource,
  isValidCardType,
  rowToCard,
  rowToConnection,
  cardToRow,
  type Card,
  type NoteCard,
  type PersonCard,
} from '../card';

describe('Card type guards', () => {
  const noteCard: Card = {
    id: 'n1',
    cardType: 'note',
    name: 'Test Note',
    content: 'Content',
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    createdAt: '2024-01-01',
    modifiedAt: '2024-01-02',
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'work',
    tags: ['tag1'],
    status: 'active',
    priority: 5,
    sortOrder: 0,
    source: null,
    sourceId: null,
    deletedAt: null,
    version: 1,
    syncStatus: 'pending',
    url: null,
    mimeType: null,
    isCollective: false,
  };

  const personCard: Card = {
    ...noteCard,
    id: 'p1',
    cardType: 'person',
    name: 'John Doe',
    isCollective: true,
  };

  const eventCard: Card = {
    ...noteCard,
    id: 'e1',
    cardType: 'event',
    name: 'Meeting',
    eventStart: '2024-02-01T10:00:00Z',
    eventEnd: '2024-02-01T11:00:00Z',
    isCollective: false,
  };

  const resourceCard: Card = {
    ...noteCard,
    id: 'r1',
    cardType: 'resource',
    name: 'Document',
    url: 'https://example.com/doc.pdf',
    mimeType: 'application/pdf',
    isCollective: false,
  };

  it('isNote returns true only for note cards', () => {
    expect(isNote(noteCard)).toBe(true);
    expect(isNote(personCard)).toBe(false);
    expect(isNote(eventCard)).toBe(false);
    expect(isNote(resourceCard)).toBe(false);
  });

  it('isPerson returns true only for person cards', () => {
    expect(isPerson(noteCard)).toBe(false);
    expect(isPerson(personCard)).toBe(true);
    expect(isPerson(eventCard)).toBe(false);
    expect(isPerson(resourceCard)).toBe(false);
  });

  it('isEvent returns true only for event cards', () => {
    expect(isEvent(noteCard)).toBe(false);
    expect(isEvent(personCard)).toBe(false);
    expect(isEvent(eventCard)).toBe(true);
    expect(isEvent(resourceCard)).toBe(false);
  });

  it('isResource returns true only for resource cards', () => {
    expect(isResource(noteCard)).toBe(false);
    expect(isResource(personCard)).toBe(false);
    expect(isResource(eventCard)).toBe(false);
    expect(isResource(resourceCard)).toBe(true);
  });

  it('isValidCardType validates card type strings', () => {
    expect(isValidCardType('note')).toBe(true);
    expect(isValidCardType('person')).toBe(true);
    expect(isValidCardType('event')).toBe(true);
    expect(isValidCardType('resource')).toBe(true);
    expect(isValidCardType('task')).toBe(false);
    expect(isValidCardType('project')).toBe(false);
    expect(isValidCardType('invalid')).toBe(false);
  });
});

describe('rowToCard converter', () => {
  it('converts note row correctly', () => {
    const row = {
      id: 'n1',
      card_type: 'note',
      name: 'Test',
      content: 'Content',
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2024-01-01',
      modified_at: '2024-01-02',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: 'work',
      tags: '["tag1", "tag2"]',
      status: 'active',
      priority: 3,
      sort_order: 1,
      source: null,
      source_id: null,
      deleted_at: null,
      version: 1,
      sync_status: 'synced',
      url: null,
      mime_type: null,
      is_collective: 0,
    };

    const card = rowToCard(row);

    expect(card.id).toBe('n1');
    expect(card.cardType).toBe('note');
    expect(card.tags).toEqual(['tag1', 'tag2']);
    expect(isNote(card)).toBe(true);
  });

  it('converts person row with isCollective', () => {
    const row = {
      id: 'p1',
      card_type: 'person',
      name: 'Acme Corp',
      is_collective: 1,
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2024-01-01',
      modified_at: '2024-01-02',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: null,
      status: null,
      priority: 0,
      sort_order: 0,
      source: null,
      source_id: null,
      deleted_at: null,
      version: 1,
      sync_status: 'pending',
    };

    const card = rowToCard(row);

    expect(card.cardType).toBe('person');
    expect(isPerson(card)).toBe(true);
    if (isPerson(card)) {
      expect(card.isCollective).toBe(true);
    }
  });

  it('converts resource row with url and mimeType', () => {
    const row = {
      id: 'r1',
      card_type: 'resource',
      name: 'Document',
      url: 'https://example.com/file.pdf',
      mime_type: 'application/pdf',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2024-01-01',
      modified_at: '2024-01-02',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: null,
      status: null,
      priority: 0,
      sort_order: 0,
      source: null,
      source_id: null,
      deleted_at: null,
      version: 1,
      sync_status: 'pending',
      is_collective: 0,
    };

    const card = rowToCard(row);

    expect(card.cardType).toBe('resource');
    expect(isResource(card)).toBe(true);
    if (isResource(card)) {
      expect(card.url).toBe('https://example.com/file.pdf');
      expect(card.mimeType).toBe('application/pdf');
    }
  });

  it('handles default card type as note', () => {
    const row = {
      id: 'x1',
      card_type: 'unknown_type',
      name: 'Unknown',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2024-01-01',
      modified_at: '2024-01-02',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: null,
      status: null,
      priority: 0,
      sort_order: 0,
      source: null,
      source_id: null,
      deleted_at: null,
      version: 1,
      sync_status: 'pending',
    };

    const card = rowToCard(row);
    expect(card.cardType).toBe('note');
    expect(isNote(card)).toBe(true);
  });
});

describe('rowToConnection converter', () => {
  it('converts connection row correctly', () => {
    const row = {
      id: 'c1',
      source_id: 'n1',
      target_id: 'n2',
      via_card_id: 'n3',
      label: 'references',
      weight: 0.8,
      created_at: '2024-01-01',
    };

    const conn = rowToConnection(row);

    expect(conn.id).toBe('c1');
    expect(conn.sourceId).toBe('n1');
    expect(conn.targetId).toBe('n2');
    expect(conn.viaCardId).toBe('n3');
    expect(conn.label).toBe('references');
    expect(conn.weight).toBe(0.8);
  });

  it('handles null via_card_id', () => {
    const row = {
      id: 'c2',
      source_id: 'n1',
      target_id: 'n2',
      via_card_id: null,
      label: 'link',
      weight: 1.0,
      created_at: '2024-01-01',
    };

    const conn = rowToConnection(row);

    expect(conn.viaCardId).toBeNull();
  });

  it('defaults weight to 1.0 if not provided', () => {
    const row = {
      id: 'c3',
      source_id: 'n1',
      target_id: 'n2',
      via_card_id: null,
      label: null,
      created_at: '2024-01-01',
    };

    const conn = rowToConnection(row);

    expect(conn.weight).toBe(1.0);
  });
});

describe('cardToRow converter', () => {
  it('converts note card to row format', () => {
    const card: NoteCard = {
      id: 'n1',
      cardType: 'note',
      name: 'Test',
      content: 'Content',
      summary: null,
      latitude: null,
      longitude: null,
      locationName: null,
      createdAt: '2024-01-01',
      modifiedAt: '2024-01-02',
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: 'work',
      tags: ['tag1', 'tag2'],
      status: 'active',
      priority: 3,
      sortOrder: 1,
      source: null,
      sourceId: null,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
      url: null,
      mimeType: null,
      isCollective: false,
    };

    const row = cardToRow(card);

    expect(row.id).toBe('n1');
    expect(row.card_type).toBe('note');
    expect(row.tags).toBe('["tag1","tag2"]');
    expect(row.is_collective).toBe(0);
  });

  it('converts person card with isCollective', () => {
    const card: PersonCard = {
      id: 'p1',
      cardType: 'person',
      name: 'Acme Corp',
      isCollective: true,
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      locationName: null,
      createdAt: '2024-01-01',
      modifiedAt: '2024-01-02',
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: null,
      tags: [],
      status: null,
      priority: 0,
      sortOrder: 0,
      source: null,
      sourceId: null,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
      url: null,
      mimeType: null,
    };

    const row = cardToRow(card);

    expect(row.card_type).toBe('person');
    expect(row.is_collective).toBe(1);
  });

  it('converts resource card with url and mimeType', () => {
    const card: Card = {
      id: 'r1',
      cardType: 'resource',
      name: 'Document',
      url: 'https://example.com/file.pdf',
      mimeType: 'application/pdf',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      locationName: null,
      createdAt: '2024-01-01',
      modifiedAt: '2024-01-02',
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: null,
      tags: [],
      status: null,
      priority: 0,
      sortOrder: 0,
      source: null,
      sourceId: null,
      deletedAt: null,
      version: 1,
      syncStatus: 'pending',
      isCollective: false,
    };

    const row = cardToRow(card);

    expect(row.card_type).toBe('resource');
    expect(row.url).toBe('https://example.com/file.pdf');
    expect(row.mime_type).toBe('application/pdf');
  });
});
