// Isometry v5 — Phase 8 ETL Integration Tests
// Full pipeline tests: import -> search -> re-import idempotency

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import { searchCards } from '../../src/database/queries/search';
import { listCards } from '../../src/database/queries/cards';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';

describe('ETL Integration - Apple Notes Round Trip', () => {
  let db: Database;

  const sampleNote: ParsedFile = {
    path: 'Learning/ClaudeAI/sample.md',
    content: `---
title: Test Note
id: 12345
created: "2026-02-01T10:30:00Z"
modified: "2026-02-15T14:45:00Z"
folder: Learning/ClaudeAI
attachments:
  - id: "att-1"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: '<a class="tag link" href="/tags/ai">#ai</a>'
links:
  - "https://anthropic.com"
source: "notes://showNote?identifier=12345"
---

# Test Note

This is a test note about @John Smith and AI.

Also mentions @Alice.
`,
  };

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
  });

  afterEach(() => {
    db.close();
  });

  it('should import Apple Notes and make them searchable via FTS', async () => {
    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([sampleNote]);

    const result = await orchestrator.import('apple_notes', data, {
      filename: 'test-export',
    });

    // Verify counts
    expect(result.inserted).toBeGreaterThan(0);
    expect(result.errors).toBe(0);
    expect(result.insertedIds.length).toBeGreaterThan(0);

    // Verify FTS search works
    const searchResults = searchCards(db, 'AI');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(r => r.card.name === 'Test Note')).toBe(true);
  });

  it('should extract hashtags as tags', async () => {
    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([sampleNote]);

    await orchestrator.import('apple_notes', data);

    const cards = listCards(db, { folder: 'Learning/ClaudeAI' });
    const noteCard = cards.find(c => c.name === 'Test Note');

    expect(noteCard).toBeDefined();
    expect(noteCard!.tags).toContain('ai');
  });

  it('should create person cards for @mentions', async () => {
    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([sampleNote]);

    await orchestrator.import('apple_notes', data);

    const personCards = listCards(db, { card_type: 'person' });

    // Should have john smith and alice
    expect(personCards.length).toBe(2);
    expect(personCards.map(c => c.name.toLowerCase())).toContain('john smith');
    expect(personCards.map(c => c.name.toLowerCase())).toContain('alice');
  });

  it('should create resource cards for external URLs', async () => {
    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([sampleNote]);

    await orchestrator.import('apple_notes', data);

    const resourceCards = listCards(db, { card_type: 'resource' });

    expect(resourceCards.length).toBeGreaterThan(0);
    expect(resourceCards.some(c => c.url === 'https://anthropic.com')).toBe(true);
  });

  it('should be idempotent - re-import of main note produces no new note cards', async () => {
    const orchestrator = new ImportOrchestrator(db);

    // Use a simple note without @mentions or URLs to avoid auxiliary card creation
    const simpleNote: ParsedFile = {
      path: 'simple.md',
      content: `---
title: Simple Note
id: 999
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=999"
---

# Simple Note

Just simple content.
`,
    };

    const data = JSON.stringify([simpleNote]);

    // First import
    const firstResult = await orchestrator.import('apple_notes', data);
    expect(firstResult.inserted).toBe(1); // Just the note

    // Second import (same data)
    const secondResult = await orchestrator.import('apple_notes', data);

    // Should have zero inserts, unchanged instead
    expect(secondResult.inserted).toBe(0);
    expect(secondResult.unchanged).toBe(1);
  });

  it('should update cards when modified_at is newer', async () => {
    const orchestrator = new ImportOrchestrator(db);

    // Use simple note without auxiliary cards to avoid FK issues
    const originalNote: ParsedFile = {
      path: 'update-test.md',
      content: `---
title: Original Title
id: 888
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=888"
---

# Original Title

Original content.
`,
    };

    // First import
    const data1 = JSON.stringify([originalNote]);
    await orchestrator.import('apple_notes', data1);

    // Second import with updated modified_at
    const updatedNote: ParsedFile = {
      path: 'update-test.md',
      content: `---
title: Updated Title
id: 888
created: "2026-02-01T10:00:00Z"
modified: "2026-02-02T15:00:00Z"
source: "notes://showNote?identifier=888"
---

# Updated Title

UPDATED content.
`,
    };
    const data2 = JSON.stringify([updatedNote]);

    const result = await orchestrator.import('apple_notes', data2);

    // Should have updates, not inserts
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);

    // Verify content was updated
    const cards = listCards(db);
    const noteCard = cards.find(c => c.source_id === '888');
    expect(noteCard?.name).toBe('Updated Title');
    expect(noteCard?.content).toContain('UPDATED');
  });

  it('should record import run in catalog', async () => {
    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([sampleNote]);

    await orchestrator.import('apple_notes', data, {
      filename: 'test-export.zip',
    });

    // Query import_runs table directly
    const stmt = db.prepare<{ id: string }>('SELECT id FROM import_runs ORDER BY completed_at DESC LIMIT 1');
    const runs = stmt.all();
    stmt.free();

    expect(runs.length).toBe(1);
    expect(runs[0]?.id).toBeDefined();
  });

  it('should handle multiple notes with cross-references', async () => {
    const note1: ParsedFile = {
      path: 'note1.md',
      content: `---
title: Note One
id: 111
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
attachments:
  - id: "link-222"
    type: "com.apple.notes.inlinetextattachment.link"
source: "notes://showNote?identifier=111"
---

# Note One

Links to note two.
`,
    };

    const note2: ParsedFile = {
      path: 'note2.md',
      content: `---
title: Note Two
id: 222
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=222"
---

# Note Two

Target note.
`,
    };

    const orchestrator = new ImportOrchestrator(db);
    const data = JSON.stringify([note1, note2]);

    const result = await orchestrator.import('apple_notes', data);

    expect(result.inserted).toBe(2);
    expect(result.connections_created).toBeGreaterThan(0);
  });
});
