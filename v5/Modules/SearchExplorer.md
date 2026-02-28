# SearchExplorer

> Full-text search with faceted navigation

## Purpose

SearchExplorer provides instant full-text search across all card content using SQLite FTS5, with faceted refinement through LATCH categories.

## Architecture

```
┌─────────────────────────────────────────────┐
│              SearchExplorer                  │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │  Search Input                        │    │
│  │  [🔍 Search cards...              ]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  Facets (from results)               │    │
│  │  ┌─────────┐ ┌─────────┐ ┌───────┐  │    │
│  │  │Type: 12 │ │Tag: 8   │ │Year: 5│  │    │
│  │  └─────────┘ └─────────┘ └───────┘  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  Results (ranked by relevance)       │    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │    │
│  │  Card Title          ★★★★☆ 0.92     │    │
│  │  ...matching snippet...              │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## FTS5 Schema

```sql
-- Full-text search index
CREATE VIRTUAL TABLE cards_fts USING fts5(
  title,
  content,
  tags,
  source_name,
  content='cards',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Keep FTS in sync via triggers
CREATE TRIGGER cards_ai AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts(rowid, title, content, tags, source_name)
  VALUES (new.id, new.title, new.content, new.tags, new.source_name);
END;
```

## Search Queries

**Basic search**:
```sql
SELECT c.*,
       bm25(cards_fts) as rank,
       snippet(cards_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
FROM cards_fts
JOIN cards c ON c.id = cards_fts.rowid
WHERE cards_fts MATCH ?
ORDER BY rank
LIMIT 50;
```

**Phrase search**: `"exact phrase"`
**Field search**: `title:kubernetes`
**Boolean**: `react AND NOT angular`
**Prefix**: `deploy*`

## Faceted Search

Extract facets from search results:

```sql
-- Category facet counts
SELECT
  json_extract(c.raw_import, '$.type') as facet_value,
  COUNT(*) as count
FROM cards_fts
JOIN cards c ON c.id = cards_fts.rowid
WHERE cards_fts MATCH ?
GROUP BY facet_value
ORDER BY count DESC;
```

**Facet types** (LATCH-aligned):
| Facet | Source |
|-------|--------|
| Type | `$.type` from raw_import |
| Source | `source_name` |
| Year | EXTRACT from `created_at` |
| Tags | `tags` array |
| Author | `$.author` from raw_import |

## Interactions

| Action | Result |
|--------|--------|
| Type query | Live results (debounced 150ms) |
| Click facet chip | Add filter, refine results |
| Click result | Select card in main view |
| Enter key | Execute search |
| Escape | Clear search |
| ↑/↓ arrows | Navigate results |

## Result Ranking

FTS5 BM25 scoring with optional boosts:

```javascript
// Title matches weighted higher
const query = `
  SELECT *, bm25(cards_fts, 2.0, 1.0, 1.5, 0.5) as rank
  FROM cards_fts
  WHERE cards_fts MATCH ?
  ORDER BY rank
`;
// Weights: title=2.0, content=1.0, tags=1.5, source=0.5
```

## Search History

Recent searches stored locally:

```javascript
const searchHistory = {
  recent: ['kubernetes', 'deploy pipeline', 'auth flow'],
  frequent: [
    { query: 'kubernetes', count: 12 },
    { query: 'api design', count: 8 }
  ]
};
```

## Integration with Views

Search results can drive any view:

```javascript
// Search becomes a filter predicate
const searchFilter = {
  type: 'fts_match',
  query: userQuery,
  fields: ['title', 'content', 'tags']
};

// Main view receives filtered card IDs
filterChain.add(searchFilter);
```

## Performance

| Dataset Size | Search Time |
|--------------|-------------|
| 10K cards | < 10ms |
| 100K cards | < 50ms |
| 1M cards | < 200ms |

FTS5 is optimized for instant search at any scale.

## State

| State | Stored In |
|-------|-----------|
| Current query | Local component state |
| Active facets | Filter chain |
| Search history | localStorage |
| Result set | Derived from query |

## Not Building

- Fuzzy/typo-tolerant search (FTS5 doesn't support)
- Semantic/vector search (would need external embedding)
- Search analytics dashboard
- Saved searches UI
