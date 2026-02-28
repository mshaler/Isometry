# Isometry v5 Contracts

**This document is the single source of truth for core type definitions.**

All other specs MUST reference this document. If a module spec conflicts with Contracts.md, Contracts.md wins.

---

## 1. Card Schema

Cards are the atomic data units in Isometry. There are five card types.

### 1.1 Card Types (Enum)

```typescript
type CardType = 'note' | 'task' | 'event' | 'resource' | 'person';
```

| Type | Purpose | Examples |
|------|---------|----------|
| `note` | Unstructured content | Apple Notes, Slack messages, emails |
| `task` | Actionable items | Reminders, todos |
| `event` | Time-bound occurrences | Calendar events, meetings |
| `resource` | External references | URLs, files, photos |
| `person` | Contacts/entities | People, organizations |

### 1.2 Card Table Schema

```sql
CREATE TABLE cards (
    -- Identity
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note',
    
    -- Content
    name TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    
    -- LATCH: Location
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    
    -- LATCH: Time
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    due_at TEXT,
    completed_at TEXT,
    event_start TEXT,
    event_end TEXT,
    
    -- LATCH: Category
    folder TEXT,
    tags TEXT,  -- JSON array: ["tag1", "tag2"]
    status TEXT,
    
    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Resource-specific
    url TEXT,
    mime_type TEXT,
    
    -- Collection flag
    is_collective INTEGER NOT NULL DEFAULT 0,
    
    -- Source tracking (ETL deduplication)
    source TEXT,
    source_id TEXT,
    source_url TEXT,
    
    -- Lifecycle
    deleted_at TEXT,
    
    -- Constraints
    CHECK (card_type IN ('note', 'task', 'event', 'resource', 'person'))
);

-- Indexes
CREATE INDEX idx_cards_type ON cards(card_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_folder ON cards(folder) WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_created ON cards(created_at);
CREATE INDEX idx_cards_modified ON cards(modified_at);
CREATE INDEX idx_cards_status ON cards(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_cards_source ON cards(source, source_id) 
    WHERE source IS NOT NULL AND source_id IS NOT NULL;
```

### 1.3 TypeScript Card Interface

```typescript
interface Card {
  id: string;
  card_type: CardType;
  
  // Content
  name: string;
  content: string | null;
  summary: string | null;
  
  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  
  // LATCH: Time
  created_at: string;  // ISO 8601
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;
  
  // LATCH: Category
  folder: string | null;
  tags: string[];  // Parsed from JSON
  status: string | null;
  
  // LATCH: Hierarchy
  priority: number;
  sort_order: number;
  
  // Resource-specific
  url: string | null;
  mime_type: string | null;
  
  // Collection
  is_collective: boolean;
  
  // Source
  source: string | null;
  source_id: string | null;
  source_url: string | null;
  
  // Lifecycle
  deleted_at: string | null;
}
```

---

## 2. Connection Schema

Connections are lightweight relations between cards. **Connections are NOT cards.**

The richness of a relationship comes from the `via_card_id` pattern: a connection *through* another card (e.g., two people connected via a meeting note).

### 2.1 Connection Table Schema

```sql
CREATE TABLE connections (
    id TEXT PRIMARY KEY NOT NULL,
    
    -- Endpoints
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Via card (optional): the card that mediates this connection
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
    
    -- Properties
    label TEXT,                    -- Freeform label (NOT a predefined type)
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Prevent exact duplicates
    UNIQUE(source_id, target_id, via_card_id, label)
);

-- Indexes for graph traversal
CREATE INDEX idx_conn_source ON connections(source_id);
CREATE INDEX idx_conn_target ON connections(target_id);
CREATE INDEX idx_conn_via ON connections(via_card_id) WHERE via_card_id IS NOT NULL;
```

### 2.2 TypeScript Connection Interface

```typescript
interface Connection {
  id: string;
  source_id: string;
  target_id: string;
  via_card_id: string | null;
  label: string | null;
  weight: number;
  created_at: string;
}
```

### 2.3 Connection Labels

Labels are **freeform strings**, not predefined enums. Common patterns:

| Label | Meaning | Example |
|-------|---------|---------|
| `sent` | Message sender | Email/Slack message → Person |
| `mentions` | Reference | Note mentions Person |
| `contains` | Hierarchy | Folder contains Note |
| `related` | General association | User-created link |
| `thread_reply` | Thread structure | Reply → Parent message |
| `contains_face` | Photo recognition | Photo → Person |

**Do NOT create an enum for edge types.** Labels emerge from data, not schema.

---

## 3. View Types

### 3.1 ViewType Enum

```typescript
type ViewType = 
  | 'list'
  | 'grid'
  | 'gallery'
  | 'kanban'
  | 'calendar'
  | 'timeline'
  | 'table'
  | 'supergrid'
  | 'graph'
  | 'map'
  | 'charts';
```

### 3.2 View Family

Views belong to one of two families:

```typescript
type ViewFamily = 'latch' | 'graph';

function getViewFamily(viewType: ViewType): ViewFamily {
  return viewType === 'graph' ? 'graph' : 'latch';
}
```

### 3.3 View Capabilities by Tier

| View | Family | Free | Pro | Workbench |
|------|--------|------|-----|-----------|
| `list` | LATCH | ✅ | ✅ | ✅ |
| `grid` | LATCH | ✅ | ✅ | ✅ |
| `gallery` | LATCH | ❌ | ✅ | ✅ |
| `kanban` | LATCH | ❌ | ✅ | ✅ |
| `calendar` | LATCH | ❌ | ✅ | ✅ |
| `timeline` | LATCH | ❌ | ✅ | ✅ |
| `table` | LATCH | ❌ | ✅ | ✅ |
| `supergrid` | LATCH | ❌ | ✅ | ✅ |
| `graph` | GRAPH | ❌ | ✅ | ✅ |
| `map` | LATCH | ❌ | ❌ | ✅ |
| `charts` | LATCH | ❌ | ❌ | ✅ |

---

## 4. WorkerBridge Protocol

### 4.1 Message Envelope

All messages use a consistent envelope:

```typescript
interface WorkerMessage {
  id: string;        // UUID for request/response correlation
  type: MessageType;
  payload: unknown;
}

interface WorkerResponse {
  id: string;        // Matches request id
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### 4.2 Message Types

```typescript
type MessageType =
  // Database lifecycle
  | 'db:init'
  | 'db:import'
  | 'db:export'
  
  // Query operations
  | 'query'          // SELECT → returns rows
  | 'exec'           // INSERT/UPDATE/DELETE → returns changes count
  
  // ETL operations
  | 'etl:importNotes'
  | 'etl:importReminders'
  | 'etl:importCalendar'
  | 'etl:importContacts'
  | 'etl:importMail'
  | 'etl:importMessages'
  | 'etl:importSafari'
  | 'etl:importPhotos'
  | 'etl:importFreeform'
  | 'etl:importSlack'
  | 'etl:importMarkdown'
  | 'etl:importExcel';
```

### 4.3 Core Operations

#### query (SELECT)

```typescript
// Request
{ id: '...', type: 'query', payload: { sql: string, params: any[] } }

// Response
{ id: '...', success: true, data: Row[] }
```

#### exec (INSERT/UPDATE/DELETE)

```typescript
// Request
{ id: '...', type: 'exec', payload: { sql: string, params: any[] } }

// Response
{ id: '...', success: true, data: { changes: number, lastInsertRowId: number } }
```

### 4.4 WorkerBridge API

```typescript
class WorkerBridge {
  // Singleton
  static readonly instance: WorkerBridge;
  
  // Lifecycle
  async init(): Promise<void>;
  async importDatabase(data: ArrayBuffer): Promise<void>;
  async exportDatabase(): Promise<ArrayBuffer>;
  
  // Queries (SELECT)
  async query<T>(sql: string, params?: any[]): Promise<T[]>;
  
  // Mutations (INSERT/UPDATE/DELETE)
  async exec(sql: string, params?: any[]): Promise<{ changes: number }>;
  
  // ETL
  async importSource(source: string, data: ArrayBuffer): Promise<ImportResult>;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  connections: number;
  errors: string[];
}
```

---

## 5. FTS5 Full-Text Search

### 5.1 FTS Table Schema

```sql
CREATE VIRTUAL TABLE cards_fts USING fts5(
    name,
    content,
    folder,
    tags,
    content='cards',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);
```

**Critical:** FTS uses `rowid`, not `id`. Joins must account for this:

```sql
-- ✅ Correct FTS join
SELECT c.* 
FROM cards_fts fts
JOIN cards c ON c.rowid = fts.rowid
WHERE cards_fts MATCH ?
AND c.deleted_at IS NULL;

-- ❌ Wrong (id is TEXT, rowid is INTEGER)
SELECT c.* 
FROM cards_fts fts
JOIN cards c ON c.id = fts.rowid  -- TYPE MISMATCH
WHERE cards_fts MATCH ?;
```

### 5.2 FTS Triggers

```sql
-- Keep FTS in sync with cards table
CREATE TRIGGER cards_fts_insert AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;

CREATE TRIGGER cards_fts_delete AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
END;

CREATE TRIGGER cards_fts_update AFTER UPDATE OF name, content, folder, tags ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;
```

---

## 6. State Persistence Tiers

### 6.1 Three-Tier Model

| Tier | Persists | Location | Examples |
|------|----------|----------|----------|
| **Tier 1: Global** | Always | SQLite `app_state` | Filters, density, sort |
| **Tier 2: Family** | Per LATCH/GRAPH | SQLite `view_state` | Axis assignments, collapsed headers |
| **Tier 3: Ephemeral** | Never | Memory only | Selection, hover, drag, viewport |

### 6.2 Provider Persistence Mapping

| Provider | Tier | Persists |
|----------|------|----------|
| FilterProvider | 1 | ✅ Yes |
| DensityProvider | 1 | ✅ Yes |
| PAFVProvider | 2 | ✅ Yes (per family) |
| SelectionProvider | 3 | ❌ No |

### 6.3 Persistence Schema

```sql
CREATE TABLE app_state (
    id TEXT PRIMARY KEY DEFAULT 'current',
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE view_state (
    id TEXT PRIMARY KEY,
    family TEXT NOT NULL,  -- 'latch' or 'graph'
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(family)
);
```

---

## 7. SQL Safety Rules

### 7.1 Allowed Columns (Allowlist)

Only these columns may be used in dynamic filter compilation:

```typescript
const ALLOWED_FILTER_COLUMNS = new Set([
  // Identity
  'id', 'card_type',
  
  // Content
  'name',
  
  // LATCH: Location
  'latitude', 'longitude', 'location_name',
  
  // LATCH: Time
  'created_at', 'modified_at', 'due_at', 'completed_at',
  'event_start', 'event_end',
  
  // LATCH: Category
  'folder', 'status',
  
  // LATCH: Hierarchy
  'priority', 'sort_order',
  
  // Source
  'source'
]);
```

### 7.2 Validation Function

```typescript
function validateColumn(column: string): void {
  if (!ALLOWED_FILTER_COLUMNS.has(column)) {
    throw new Error(`SQL safety violation: "${column}" is not an allowed filter column`);
  }
}

// Usage in FilterProvider
function compileFilters(state: FilterState): CompiledSQL {
  if (state.filters.category?.field) {
    validateColumn(state.filters.category.field);
  }
  // ... rest of compilation
}
```

### 7.3 Parameterization Rules

- **Values:** Always use `?` placeholders, never interpolate
- **Column names:** Allowlist only, never from user input
- **Table names:** Hardcoded only (`cards`, `connections`, `cards_fts`)

---

## 8. Credential Storage

### 8.1 Rule: Never Store Secrets in SQLite

Credentials (OAuth tokens, API keys) are stored in **platform Keychain only**.

### 8.2 Native Bridge Contract

```typescript
// JavaScript requests credential via bridge
interface CredentialRequest {
  kind: 'getCredential';
  service: string;  // e.g., 'slack', 'google'
}

interface CredentialResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
}

// Usage
const { token } = await nativeBridge.requestNativeAction({
  kind: 'getCredential',
  service: 'slack'
});
```

### 8.3 Swift Implementation

```swift
class CredentialManager {
    func store(token: String, service: String) throws {
        // Store in Keychain with kSecAttrService = service
    }
    
    func retrieve(service: String) throws -> String? {
        // Retrieve from Keychain
    }
    
    func delete(service: String) throws {
        // Delete from Keychain
    }
}
```

---

## 9. ETL Canonical Card Format

All ETL parsers output this format before writing to SQLite:

```typescript
interface CanonicalCard {
  id: string;
  card_type: CardType;
  name: string;
  content: string | null;
  summary: string | null;
  
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;
  
  folder: string | null;
  tags: string[];
  status: string | null;
  
  priority: number;
  sort_order: number;
  
  url: string | null;
  mime_type: string | null;
  is_collective: boolean;
  
  source: string;       // Required for ETL
  source_id: string;    // Required for ETL
  source_url: string | null;
}

interface CanonicalConnection {
  id: string;
  source_id: string;
  target_id: string;
  via_card_id: string | null;
  label: string | null;
  weight: number;
}
```

---

## 10. Summary: What This Document Defines

| Contract | Definition |
|----------|------------|
| **CardType** | `'note' \| 'task' \| 'event' \| 'resource' \| 'person'` |
| **Card schema** | 25 columns, `cards` table |
| **Connection schema** | Lightweight, `via_card_id` pattern, no edge types enum |
| **ViewType** | 11 views, 2 families (LATCH/GRAPH) |
| **WorkerBridge** | `query()` returns rows, `exec()` returns changes |
| **FTS5** | Uses `rowid`, not `id` |
| **Persistence tiers** | Selection is Tier 3 (ephemeral) |
| **SQL safety** | Column allowlist, parameterized values |
| **Credentials** | Keychain only, never SQLite |

**All module specs must conform to these contracts.**
