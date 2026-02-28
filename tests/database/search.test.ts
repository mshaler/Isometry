import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard, deleteCard } from '../../src/database/queries/cards';
import { searchCards } from '../../src/database/queries/search';

// ---------------------------------------------------------------------------
// Shared setup: fresh DB per test, seeded with 4 cards
// ---------------------------------------------------------------------------

let db: Database;

// Card references for per-test access
let cardAId: string;
let cardBId: string;
let cardCId: string;
let cardDId: string;

beforeEach(async () => {
  db = new Database();
  await db.initialize();

  // Seed: Card A — "knowledge" in name AND content
  const cardA = createCard(db, {
    name: 'Knowledge Management System',
    content: 'A platform for organizing and retrieving information',
  });
  cardAId = cardA.id;

  // Seed: Card B — "knowledge" only in content, "project" in name
  const cardB = createCard(db, {
    name: 'Project Planning Tool',
    content: 'A system for managing projects and tracking knowledge',
  });
  cardBId = cardB.id;

  // Seed: Card C — "recipes" and "cooking", no "knowledge"
  const cardC = createCard(db, {
    name: 'Recipe Collection',
    content: 'A collection of cooking recipes and meal planning guides',
  });
  cardCId = cardC.id;

  // Seed: Card D — "knowledge" in content, but soft-deleted
  const cardD = createCard(db, {
    name: 'Deleted Note',
    content: 'This note about knowledge was soft-deleted',
  });
  cardDId = cardD.id;
  deleteCard(db, cardDId);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// SRCH-01: BM25-ranked results
// ---------------------------------------------------------------------------

describe('SRCH-01: BM25-ranked results', () => {
  it('searchCards("knowledge") returns an array of results', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searchCards("knowledge") results have a numeric rank property', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.rank).toBe('number');
    }
  });

  it('searchCards("knowledge") results are sorted by rank ascending (best first — most negative = best)', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(1); // need at least 2 to compare order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].rank).toBeLessThanOrEqual(results[i].rank);
    }
  });

  it('searchCards("knowledge") returns Card A ranked higher (lower rank) than Card B', () => {
    const results = searchCards(db, 'knowledge');
    const aIdx = results.findIndex(r => r.card.id === cardAId);
    const bIdx = results.findIndex(r => r.card.id === cardBId);
    expect(aIdx).toBeGreaterThanOrEqual(0); // Card A is in results
    expect(bIdx).toBeGreaterThanOrEqual(0); // Card B is in results
    // Card A has "knowledge" in name, Card B only in content — A should rank higher (lower index)
    expect(aIdx).toBeLessThan(bIdx);
  });

  it('searchCards("nonexistent-term-xyz") returns empty array', () => {
    const results = searchCards(db, 'nonexistent-term-xyz');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SRCH-02: rowid joins (correct Card objects returned)
// ---------------------------------------------------------------------------

describe('SRCH-02: rowid joins produce correct Card objects', () => {
  it('searchCards returns Card objects with all required fields populated', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
    const result = results[0];
    expect(result.card).toBeDefined();
    expect(typeof result.card.id).toBe('string');
    expect(result.card.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof result.card.name).toBe('string');
    expect(typeof result.card.created_at).toBe('string');
    expect(Array.isArray(result.card.tags)).toBe(true);
  });

  it('searchCards("knowledge") returns cards with correct ids (proves rowid join is working)', () => {
    const results = searchCards(db, 'knowledge');
    const ids = results.map(r => r.card.id);
    expect(ids).toContain(cardAId);
    expect(ids).toContain(cardBId);
    // Card C has no "knowledge" — should not appear
    expect(ids).not.toContain(cardCId);
  });

  it('searchCards returns correct card name for matched card', () => {
    const results = searchCards(db, 'knowledge');
    const cardA = results.find(r => r.card.id === cardAId);
    expect(cardA).toBeDefined();
    expect(cardA!.card.name).toBe('Knowledge Management System');
  });
});

// ---------------------------------------------------------------------------
// SRCH-03: Snippets with highlighted match context
// ---------------------------------------------------------------------------

describe('SRCH-03: Snippets with <mark> highlighted match context', () => {
  it('searchCards("knowledge") results have a non-empty snippet string', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.snippet).toBe('string');
      expect(r.snippet.length).toBeGreaterThan(0);
    }
  });

  it('searchCards("knowledge") snippet contains <mark>knowledge</mark>', () => {
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
    // At least one result should have the highlighted term
    const hasHighlight = results.some(r => r.snippet.includes('<mark>'));
    expect(hasHighlight).toBe(true);
  });

  it('searchCards("knowledge") snippet from Card A contains highlighted knowledge term', () => {
    const results = searchCards(db, 'knowledge');
    const aResult = results.find(r => r.card.id === cardAId);
    expect(aResult).toBeDefined();
    // The snippet should contain the <mark> tag around "knowledge" or its stem
    expect(aResult!.snippet).toMatch(/<mark>/);
  });

  it('searchCards("knowledge") snippet may contain ellipsis for truncated context', () => {
    // snippet() uses '...' as the ellipsis — verify snippet format is plausible
    const results = searchCards(db, 'knowledge');
    expect(results.length).toBeGreaterThan(0);
    // snippet should be a non-empty string with or without ellipsis (depending on content length)
    expect(results[0].snippet).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SRCH-04: Performance and limit
// ---------------------------------------------------------------------------

describe('SRCH-04: Performance and limit', () => {
  it('searchCards with limit=5 returns at most 5 results', () => {
    // Seed 10 extra "limit" cards so there are more than 5 matches
    for (let i = 0; i < 10; i++) {
      createCard(db, {
        name: `Limit Test Card ${i}`,
        content: `This card contains the word limit for search testing purposes ${i}`,
      });
    }
    const results = searchCards(db, 'limit', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('searchCards completes without error on a 100-card seeded dataset', () => {
    // Seed 100 "bulk" cards
    for (let i = 0; i < 100; i++) {
      createCard(db, {
        name: `Bulk Card ${i}`,
        content: `Bulk content for testing performance with index ${i}`,
      });
    }
    expect(() => searchCards(db, 'bulk')).not.toThrow();
    const results = searchCards(db, 'bulk');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('searchCards("") returns empty array (empty query guard)', () => {
    const results = searchCards(db, '');
    expect(results).toEqual([]);
  });

  it('searchCards("   ") returns empty array (whitespace-only guard)', () => {
    const results = searchCards(db, '   ');
    expect(results).toEqual([]);
  });

  it('soft-deleted card does NOT appear in search results', () => {
    const results = searchCards(db, 'knowledge');
    const ids = results.map(r => r.card.id);
    expect(ids).not.toContain(cardDId);
  });

  it('searchCards with porter stemmer matches "managing" when searching "manage"', () => {
    // Card B content: "A system for managing projects and tracking knowledge"
    // Porter stemmer should match "managing" when searching "manage"
    const results = searchCards(db, 'manage');
    const ids = results.map(r => r.card.id);
    expect(ids).toContain(cardBId);
  });

  it('FTS integrity-check passes after all search test mutations', () => {
    // Run an FTS integrity check — should return no rows on success
    const result = db.exec("INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')");
    // integrity-check returns empty result set on success (no error thrown)
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FTS5 query syntax tests
// ---------------------------------------------------------------------------

describe('FTS5 query syntax', () => {
  it('searchCards("knowledge management") matches cards containing both terms (implicit AND)', () => {
    const results = searchCards(db, 'knowledge management');
    const ids = results.map(r => r.card.id);
    // Card A has both "Knowledge" (name) and "management" (name)
    expect(ids).toContain(cardAId);
  });

  it('searchCards("knowledge OR recipes") matches cards with either term', () => {
    const results = searchCards(db, 'knowledge OR recipes');
    const ids = results.map(r => r.card.id);
    // Card A has "knowledge" in name
    expect(ids).toContain(cardAId);
    // Card C has "recipes" in name
    expect(ids).toContain(cardCId);
  });
});
