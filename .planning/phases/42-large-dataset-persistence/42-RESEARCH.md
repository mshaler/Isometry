# Phase 42: Large Dataset Persistence & UnifiedApp Integration - Research

**Researched:** 2026-02-09
**Domain:** Browser-based SQLite persistence, IndexedDB/OPFS storage, large dataset management
**Confidence:** HIGH

## Summary

Phase 42 requires replacing localStorage-based database persistence with a solution that supports 50MB+ datasets. Current implementation fails with QuotaExceededError when storing alto-index data (82MB JSON, 17,226 nodes). Research identifies three viable approaches: (1) wa-sqlite with OPFS VFS (best performance, Worker-only), (2) IndexedDB via idb wrapper (broader compatibility, simpler), and (3) absurd-sql (deprecated, avoid). The recommended path is a two-tier strategy: IndexedDB for immediate relief and broad compatibility, with optional wa-sqlite OPFS upgrade for performance-critical scenarios.

**Primary recommendation:** Migrate from localStorage to IndexedDB using the `idb` npm package (Jake Archibald's promise-based wrapper) for immediate relief, then implement wa-sqlite's OPFSCoopSyncVFS in a Worker for production-scale performance once core functionality is proven.

## Current State Analysis

### Existing Implementation

The codebase currently uses:
- **sql.js v1.13.0** with **sql.js-fts5 v1.4.0** for SQLite in browser
- **localStorage** for database backup/persistence (see `src/db/SQLiteProvider.tsx:343`)
- **Direct export/import pattern**: `db.export()` → base64 → localStorage
- **82MB alto-index.json** file with 17,226 nodes (successful import, failed persistence)

### The Problem

localStorage has hard limits:
- **5-10MB maximum** across all browsers
- **Synchronous API** blocks main thread
- **Strings only** requires base64 encoding (adds ~33% overhead)
- **QuotaExceededError** thrown when limit exceeded

From grep results, 65+ files use localStorage for various features:
- Tag colors, filter presets, view state, feature flags, templates
- Database backup is the largest consumer (would be 82MB+ base64 encoded)

### Success Criteria from Prior Session

✅ Alto-index import works: 17,226 nodes in 33.06s
✅ FTS5 search works: 1.2ms query time
✅ PAFV projection works: 38.5ms for 15K+ nodes, 3215 cells
❌ Persistence fails: QuotaExceededError on save

## Standard Stack

### Core: Browser-Based SQLite Persistence

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **idb** | ^8.0.3 | Promise-based IndexedDB wrapper | Jake Archibald's library, 1.19kB, mirrors IndexedDB API with usability improvements |
| **wa-sqlite** | ^1.3.1 | WebAssembly SQLite with VFS support | First OPFS implementation, multiple VFS options, excellent performance |
| **sql.js** | ^1.13.0 | Current implementation | Already in use, works but needs persistence backend |
| **sql.js-fts5** | ^1.4.0 | FTS5 extension for sql.js | Already in use, proven working |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@subframe7536/sqlite-wasm** | Latest | Simplified SQLite WASM wrapper | Alternative to wa-sqlite, supports both IndexedDB and OPFS |
| **absurd-sql** | DEPRECATED | IndexedDB VFS for sql.js | Do NOT use - no longer maintained, superseded by wa-sqlite |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| wa-sqlite OPFS | Official SQLite WASM OPFS | Better official support but requires SharedArrayBuffer + COOP/COEP headers |
| wa-sqlite OPFS | wa-sqlite IndexedDB VFS | Broader compatibility but 5x slower on 100MB+ databases |
| idb wrapper | Raw IndexedDB API | More control but verbose, promise handling complexity |

**Installation:**
```bash
# Option 1: IndexedDB path (recommended for immediate implementation)
npm install idb

# Option 2: wa-sqlite path (for production performance)
npm install @journeyapps/wa-sqlite

# No new sql.js packages needed - already installed
```

## Architecture Patterns

### Recommended Approach: Two-Tier Strategy

**Tier 1: IndexedDB Backend (Immediate Relief)**
- Store sql.js database exports in IndexedDB via `idb`
- Debounced auto-save every 5-10 seconds after changes
- 50MB+ capacity, no QuotaExceededError
- Works in all contexts (main thread, workers)
- Simple migration from localStorage pattern

**Tier 2: OPFS VFS (Performance Optimization)**
- Implement wa-sqlite OPFSCoopSyncVFS in Worker
- Block-level persistence (no full export/import)
- Excellent performance with large databases (100MB+)
- Requires Worker context (async communication)
- Migration path once IndexedDB proves stable

### Pattern 1: IndexedDB Export/Import (Recommended First Step)

**What:** Replace localStorage with IndexedDB for storing sql.js database exports

**When to use:** Immediate solution to QuotaExceededError, minimal code changes

**Example:**
```typescript
// Source: https://github.com/jakearchibald/idb + sql.js patterns
import { openDB } from 'idb';
import initSqlJs from 'sql.js';

const DB_NAME = 'isometry-db';
const DB_VERSION = 1;
const STORE_NAME = 'database';

// Initialize IndexedDB
const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME);
  }
});

// Save sql.js database to IndexedDB
async function saveDatabase(sqlDb: Database): Promise<void> {
  const data = sqlDb.export();
  const db = await dbPromise;
  await db.put(STORE_NAME, data, 'main');
}

// Load sql.js database from IndexedDB
async function loadDatabase(SQL: SqlJsStatic): Promise<Database> {
  const db = await dbPromise;
  const data = await db.get(STORE_NAME, 'main');

  if (data) {
    return new SQL.Database(data);
  }
  return new SQL.Database();
}

// Debounced auto-save (prevent excessive writes)
let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave(sqlDb: Database) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDatabase(sqlDb);
  }, 5000); // 5 second debounce
}
```

### Pattern 2: wa-sqlite OPFS VFS (Future Optimization)

**What:** Use wa-sqlite with OPFSCoopSyncVFS for block-level persistence

**When to use:** After IndexedDB proves stable, for production performance with 100MB+ databases

**Example:**
```typescript
// Source: https://github.com/rhashimoto/wa-sqlite + PowerSync recommendations
// Must run in Worker context

import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import { OPFSCoopSyncVFS } from 'wa-sqlite/src/examples/OPFSCoopSyncVFS.js';

// In Worker context only
const module = await SQLiteESMFactory();
const sqlite3 = SQLite.Factory(module);

// Register OPFS VFS
const vfs = await OPFSCoopSyncVFS.create('isometry-vfs', module);
sqlite3.vfs_register(vfs, true);

// Open database with OPFS persistence
const db = await sqlite3.open_v2('isometry.db');

// Queries work directly, persistence is automatic
const stmt = await sqlite3.prepare_v2(db, 'SELECT * FROM nodes LIMIT 10');
// ... use statement

// Note: Requires Worker<->Main communication layer
```

### Pattern 3: Hybrid Approach (Production Recommendation)

**What:** IndexedDB for metadata/small data, OPFS for large database

**When to use:** Production deployment with both compatibility and performance

**Example:**
```typescript
// Feature detection and fallback
async function initPersistence() {
  // Try OPFS first (best performance)
  if (typeof FileSystemSyncAccessHandle !== 'undefined') {
    return await initOPFSPersistence();
  }

  // Fallback to IndexedDB (broad compatibility)
  return await initIndexedDBPersistence();
}

// Progressive enhancement based on capability
```

### Anti-Patterns to Avoid

- **❌ Continuing with localStorage for large datasets**: Hard 5-10MB limits cause failures
- **❌ Using absurd-sql**: No longer maintained, superseded by wa-sqlite
- **❌ Exporting entire database on every write**: Use debouncing, minimum 5 second intervals
- **❌ Synchronous IndexedDB access**: Always use promises/async-await via `idb` wrapper
- **❌ Blocking main thread with large operations**: Use Workers for OPFS, async for IndexedDB
- **❌ No storage quota monitoring**: Always check `navigator.storage.estimate()` before large writes
- **❌ Missing error handling for QuotaExceededError**: Always catch and provide user feedback

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promises | Custom promise wrappers | `idb` by Jake Archibald | Handles transaction gotchas, 1.19kB, battle-tested |
| SQLite persistence | Custom VFS implementation | wa-sqlite VFS classes | Complex edge cases handled (locking, caching, block management) |
| Debounce utilities | Custom timers | Existing utility or library | Race conditions, memory leaks, cancellation edge cases |
| Storage quota checks | Ad-hoc checks | `navigator.storage.estimate()` | Standard API, accurate, cross-browser |
| OPFS file handling | Raw File System Access API | wa-sqlite OPFSCoopSyncVFS | Handles concurrent access, corruption prevention, performance |
| Database schema migrations | Manual SQL versioning | Versioned upgrade handlers in `openDB` | Transactional, rollback on failure |

**Key insight:** Browser storage persistence is deceptively complex. IndexedDB has transaction isolation gotchas, OPFS requires Worker context and handle management, and SQLite VFS implementations need careful locking. Use proven libraries that handle the 20% of edge cases that cause 80% of production issues.

## Common Pitfalls

### Pitfall 1: QuotaExceededError Without User Feedback

**What goes wrong:** localStorage.setItem() throws QuotaExceededError, app crashes or silently fails

**Why it happens:** No quota checking before write, no error boundaries catching storage errors

**How to avoid:**
```typescript
async function checkStorageQuota(sizeNeeded: number): Promise<boolean> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const available = (estimate.quota ?? 0) - (estimate.usage ?? 0);
    return available > sizeNeeded;
  }
  return true; // Assume okay if API unavailable
}

// Before saving
if (await checkStorageQuota(exportSize)) {
  await saveDatabase(db);
} else {
  // Show user: "Storage full, cannot save"
}
```

**Warning signs:** Users report "data not saving", console shows QuotaExceededError

### Pitfall 2: Export-Every-Write Performance Death

**What goes wrong:** Calling db.export() after every INSERT/UPDATE kills performance

**Why it happens:** Full database export is O(n) on database size, not change size

**How to avoid:** Debounce saves with 5-10 second window
```typescript
// From research: debounce recommended for auto-save
// But CAUTION: user might navigate away before save completes
let saveTimer: NodeJS.Timeout | null = null;
let hasPendingChanges = false;

function notifyDataChanged() {
  hasPendingChanges = true;
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(async () => {
    if (hasPendingChanges) {
      await saveDatabase(db);
      hasPendingChanges = false;
    }
  }, 5000);
}

// On page unload, force immediate save if pending
window.addEventListener('beforeunload', () => {
  if (hasPendingChanges) {
    // Synchronous save or flag to user
    console.warn('Pending changes, save may be lost');
  }
});
```

**Warning signs:** UI freezes after data changes, CPU spikes, battery drain on mobile

### Pitfall 3: OPFS in Main Thread

**What goes wrong:** Attempt to use OPFS SyncAccessHandle outside Worker, crashes

**Why it happens:** FileSystemSyncAccessHandle only available in Worker contexts

**How to avoid:** Always feature detect and use Workers
```typescript
// Wrong: in main thread
const handle = await fileHandle.createSyncAccessHandle(); // ERROR

// Right: in Worker
// main.ts
const worker = new Worker('./db-worker.ts', { type: 'module' });
worker.postMessage({ action: 'init' });

// db-worker.ts
const vfs = await OPFSCoopSyncVFS.create('db', module);
// ... use sync access handle safely
```

**Warning signs:** "createSyncAccessHandle is not defined" errors

### Pitfall 4: Safari Incognito Mode OPFS Failure

**What goes wrong:** OPFS not available in Safari Private Browsing, app breaks

**Why it happens:** Safari disables OPFS in private mode for privacy

**How to avoid:** Always have IndexedDB fallback
```typescript
async function getPersistenceBackend() {
  try {
    if (navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory();
      // OPFS available
      return 'opfs';
    }
  } catch {
    // OPFS not available (Safari incognito, etc.)
  }

  // Fallback to IndexedDB
  return 'indexeddb';
}
```

**Warning signs:** Works in normal browsing, fails in incognito/private mode

### Pitfall 5: IndexedDB Transaction Auto-Commit

**What goes wrong:** Async operations between IndexedDB calls cause transaction to auto-commit prematurely

**Why it happens:** IndexedDB transactions auto-commit when event loop returns and no pending operations

**How to avoid:** Use `idb` library or keep transaction active
```typescript
// Wrong: transaction auto-commits between awaits
const tx = db.transaction('store', 'readwrite');
const data1 = await someAsyncOperation(); // Transaction commits here!
await tx.store.put(data1, 'key'); // ERROR: Transaction already committed

// Right: use idb wrapper
const db = await openDB('mydb', 1);
await db.put('store', data, 'key'); // Handles transaction automatically

// Or: perform all operations in same transaction
const tx = db.transaction('store', 'readwrite');
tx.store.put(data1, 'key1'); // Don't await yet
tx.store.put(data2, 'key2');
await tx.done; // Await transaction completion once
```

**Warning signs:** "TransactionInactiveError" in console

## Code Examples

Verified patterns from official sources:

### IndexedDB Persistence for sql.js

```typescript
// Source: https://github.com/jakearchibald/idb + sql.js documentation
import { openDB, IDBPDatabase } from 'idb';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

interface IsometryDB {
  'database': {
    key: string;
    value: Uint8Array;
  };
  'metadata': {
    key: string;
    value: {
      version: number;
      lastSaved: string;
      nodeCount: number;
    };
  };
}

class SQLitePersistence {
  private idb: IDBPDatabase<IsometryDB> | null = null;
  private sqlDb: Database | null = null;
  private SQL: SqlJsStatic | null = null;

  async init(): Promise<void> {
    // Initialize IndexedDB
    this.idb = await openDB<IsometryDB>('isometry-db', 1, {
      upgrade(db) {
        db.createObjectStore('database');
        db.createObjectStore('metadata');
      },
    });

    // Initialize sql.js
    this.SQL = await initSqlJs({
      locateFile: file => `/wasm/${file}`
    });

    // Try to load existing database
    const data = await this.idb.get('database', 'main');
    if (data) {
      this.sqlDb = new this.SQL.Database(data);
    } else {
      this.sqlDb = new this.SQL.Database();
      await this.initSchema(this.sqlDb);
    }
  }

  async save(): Promise<void> {
    if (!this.sqlDb || !this.idb) return;

    const data = this.sqlDb.export();
    await this.idb.put('database', data, 'main');

    // Save metadata for diagnostics
    await this.idb.put('metadata', {
      version: 1,
      lastSaved: new Date().toISOString(),
      nodeCount: this.getNodeCount()
    }, 'main');
  }

  private getNodeCount(): number {
    if (!this.sqlDb) return 0;
    const result = this.sqlDb.exec('SELECT COUNT(*) FROM nodes');
    return result[0]?.values[0]?.[0] as number ?? 0;
  }

  private async initSchema(db: Database): Promise<void> {
    // Load schema from schema.sql
    const response = await fetch('/db/schema.sql');
    const schema = await response.text();
    db.exec(schema);
  }
}
```

### Debounced Auto-Save Pattern

```typescript
// Source: Multiple JavaScript performance optimization resources
class AutoSaveManager {
  private saveTimer: NodeJS.Timeout | null = null;
  private hasPendingChanges = false;
  private readonly DEBOUNCE_MS = 5000; // 5 seconds
  private readonly persistence: SQLitePersistence;

  constructor(persistence: SQLitePersistence) {
    this.persistence = persistence;
    this.setupBeforeUnload();
  }

  notifyDataChanged(): void {
    this.hasPendingChanges = true;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.executeSave();
    }, this.DEBOUNCE_MS);
  }

  private async executeSave(): Promise<void> {
    if (!this.hasPendingChanges) return;

    try {
      await this.persistence.save();
      this.hasPendingChanges = false;
      console.log('Auto-save completed');
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Retry logic could go here
    }
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasPendingChanges) {
        // Modern browsers ignore custom messages
        e.preventDefault();
        e.returnValue = '';

        // Try to save immediately (may not complete)
        this.executeSave();
      }
    });
  }

  forceImmediateSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    return this.executeSave();
  }
}
```

### Storage Quota Monitoring

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API
async function getStorageInfo() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return {
      available: null,
      used: null,
      quota: null,
      percentUsed: null
    };
  }

  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const available = quota - usage;
  const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

  return {
    available,
    used: usage,
    quota,
    percentUsed
  };
}

// Usage
const storage = await getStorageInfo();
console.log(`Storage: ${(storage.used / 1024 / 1024).toFixed(2)}MB / ${(storage.quota / 1024 / 1024).toFixed(2)}MB (${storage.percentUsed.toFixed(1)}%)`);

if (storage.percentUsed > 90) {
  console.warn('Storage nearly full!');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for everything | IndexedDB/OPFS for large data | 2020-2024 | Enables 100MB+ datasets in browser |
| sql.js export/import only | wa-sqlite with VFS backends | 2021-2024 | 10x faster persistence, block-level writes |
| absurd-sql | wa-sqlite OPFSCoopSyncVFS | 2023-2025 | Better performance, active maintenance |
| Manual IndexedDB API | `idb` promise wrapper | 2015-present | Eliminates transaction gotchas |
| Web SQL | SQLite WASM (sql.js, wa-sqlite) | 2019-2022 | Standard SQL, FTS5, modern browsers |
| File System Access API | OPFS (Origin Private File System) | 2022-2024 | Faster, Worker-compatible, private by default |

**Deprecated/outdated:**
- **absurd-sql**: Last updated 2021, superseded by wa-sqlite OPFS implementations
- **Web SQL**: Removed from browsers 2022, replaced by SQLite WASM
- **Direct IDBRequest API**: Use `idb` wrapper instead for promise-based access

**Emerging (2025-2026):**
- **Official SQLite WASM with OPFS**: As of SQLite 3.43.0, official OPFS VFS available
- **StorageManager.persist()**: Request persistent storage (prevents eviction)
- **File System Observer API**: Watch for file changes (proposed, not yet standard)

## Open Questions

1. **Worker communication architecture for OPFS**
   - What we know: OPFS requires Worker context, main thread needs query results
   - What's unclear: Optimal message passing pattern (SharedArrayBuffer? Comlink? Postmate?)
   - Recommendation: Start with simple postMessage, consider Comlink if complexity grows

2. **Migration path from IndexedDB to OPFS**
   - What we know: Can run both backends, feature detect OPFS support
   - What's unclear: When to migrate existing users, how to handle migration failures
   - Recommendation: New users get OPFS (if supported), existing users stay IndexedDB unless opt-in

3. **Performance targets for 15K+ node datasets**
   - What we know: Current 38.5ms PAFV projection, 1.2ms FTS5 queries
   - What's unclear: Do these hold with IndexedDB persistence overhead?
   - Recommendation: Benchmark before/after, maintain <50ms budget per success criteria

4. **ViewEngine integration verification scope**
   - What we know: IsometryViewEngine exists, Canvas uses it, alto-index import works
   - What's unclear: Full PAFV axis switching needs testing with real calendar/contacts/notes
   - Recommendation: Create integration test suite covering all LATCH dimensions on alto data

5. **Error recovery for persistence failures**
   - What we know: QuotaExceededError, transaction failures can occur
   - What's unclear: Should we keep in-memory only mode? Export to file? Clear old data?
   - Recommendation: Offer user choice: (1) export to file, (2) delete old data, (3) continue without save

## Sources

### Primary (HIGH confidence)
- [Storage quotas and eviction criteria - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - Official browser storage documentation
- [idb - npm by Jake Archibald](https://github.com/jakearchibald/idb) - IndexedDB promise wrapper
- [wa-sqlite - GitHub](https://github.com/rhashimoto/wa-sqlite) - WebAssembly SQLite with VFS support
- [The Current State Of SQLite Persistence On The Web: November 2025](https://www.powersync.com/blog/sqlite-persistence-on-the-web) - Comprehensive 2025 review
- [SQLite WASM Persistence Options](https://sqlite.org/wasm/doc/trunk/persistence.md) - Official SQLite WASM documentation

### Secondary (MEDIUM confidence)
- [SQLite Wasm in the browser backed by OPFS - Chrome Developers](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system) - OPFS implementation guide
- [Offline-first frontend apps in 2025 - LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Current best practices
- [LocalStorage vs IndexedDB - DEV Community](https://dev.to/tene/localstorage-vs-indexeddb-javascript-guide-storage-limits-best-practices-fl5) - Storage comparison
- [RxDB: LocalStorage vs IndexedDB vs OPFS vs WASM-SQLite](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html) - Detailed benchmark comparison
- [SQLite FTS5 Performance Optimization - DEV Community](https://dev.to/labex/sqlite-performance-tuning-3-practical-labs-for-pragma-indexing-and-fts5-full-text-search-4gmk) - FTS5 best practices

### Tertiary (LOW confidence, needs validation)
- [absurd-sql GitHub](https://github.com/jlongster/absurd-sql) - Historical reference, DO NOT USE (deprecated)
- Various Stack Overflow discussions on debounce timing (no single authoritative source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `idb` and wa-sqlite are industry standard, well-documented
- Architecture: HIGH - IndexedDB→OPFS migration path is proven pattern from multiple sources
- Pitfalls: HIGH - Verified from official MDN docs, real-world bug reports, library FAQs
- Performance: MEDIUM - FTS5 optimization verified, but IndexedDB overhead needs measurement
- OPFS implementation: MEDIUM - Worker architecture needs project-specific design

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - browser APIs stable, libraries actively maintained)

**Key findings:**
1. localStorage QuotaExceededError is blocking issue - IndexedDB solves immediately
2. wa-sqlite OPFSCoopSyncVFS recommended by PowerSync (Nov 2025) for production scale
3. Two-tier approach (IndexedDB first, OPFS later) balances stability and performance
4. Alto-index data proves sql.js + FTS5 works, only persistence layer needs replacement
5. ViewEngine integration already exists, needs verification with real-world axis switching