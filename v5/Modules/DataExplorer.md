# Isometry v5 Data Explorer Specification

## Overview

Data Explorer is Isometry's ETL (Extract, Transform, Load) subsystem. It handles import, export, sync, and the Data Catalog. All data flows through a canonical schema before reaching SQLite.

**Design Principle:** Data arrives with whatever properties it naturally carries. Data Explorer maps heterogeneous sources to a unified card schema without forcing schema-on-write.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Data Explorer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Import Pipeline                                   ││
│  │                                                                          ││
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ││
│  │  │ Sources │ → │ Parsers │ → │ Mapper  │ → │ Deduper │ → │ Writer  │   ││
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Export Pipeline                                   ││
│  │                                                                          ││
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐                                ││
│  │  │ Reader  │ → │ Encoder │ → │ Writer  │                                ││
│  │  └─────────┘   └─────────┘   └─────────┘                                ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Data Catalog                                      ││
│  │  • Sources registry   • Import history   • Schema mappings              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Supported Sources

| Source | Format | Parser | Primary Use |
|--------|--------|--------|-------------|
| **Apple Notes** | alto-index JSON | `AppleNotesParser` | Primary data source |
| **Markdown** | `.md` with frontmatter | `MarkdownParser` | Obsidian, Bear, etc. |
| **Excel** | `.xlsx`, `.xls` | `ExcelParser` | Spreadsheet data |
| **CSV** | `.csv`, `.tsv` | `CSVParser` | Tabular data |
| **JSON** | `.json` | `JSONParser` | API exports |
| **HTML** | `.html` | `HTMLParser` | Web clippings |

---

## 2. Canonical Schema

All imports map to this unified structure:

```typescript
interface CanonicalCard {
  // Identity
  id: string;
  card_type: 'note' | 'person' | 'event' | 'resource';
  
  // Content
  name: string;
  content: string | null;
  summary: string | null;
  
  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  
  // LATCH: Time
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;
  
  // LATCH: Category
  folder: string | null;
  tags: string[];
  status: string | null;
  
  // LATCH: Hierarchy
  priority: number;
  sort_order: number;
  
  // Type-specific
  url: string | null;
  mime_type: string | null;
  is_collective: boolean;
  
  // Source tracking
  source: string;
  source_id: string;
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

## 3. Apple Notes Parser

Primary import source via [alto-index](https://github.com/nickvidal/alto-index).

### 3.1 Alto-Index Input Format

```typescript
interface AltoExport {
  version: string;
  exported_at: string;
  notes: AltoNote[];
}

interface AltoNote {
  id: string;
  title: string;
  content: string;              // HTML or Markdown
  folder: string;
  created: string;
  modified: string;
  attachments?: AltoAttachment[];
  checklist_items?: AltoChecklistItem[];
  tags?: string[];
  mentions?: AltoMention[];
  links?: AltoLink[];
}

interface AltoAttachment {
  id: string;
  type: 'image' | 'pdf' | 'scan' | 'drawing' | 'file';
  filename: string;
  mime_type: string;
  data?: string;                // Base64
}

interface AltoChecklistItem {
  text: string;
  checked: boolean;
  indent_level: number;
}

interface AltoMention {
  name: string;
  range: [number, number];
}

interface AltoLink {
  url: string;
  title?: string;
  type: 'external' | 'note';
  target_note_id?: string;
}
```

### 3.2 Parser Implementation

```typescript
// src/etl/parsers/AppleNotesParser.ts

export class AppleNotesParser {
  
  parse(data: AltoExport): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    for (const note of data.notes) {
      // Main note card
      const noteCard = this.parseNote(note);
      cards.push(noteCard);
      
      // Checklist items → task cards
      if (note.checklist_items?.length) {
        const tasks = this.parseChecklist(note, noteCard.id);
        cards.push(...tasks.cards);
        connections.push(...tasks.connections);
      }
      
      // Attachments → resource cards
      if (note.attachments?.length) {
        const resources = this.parseAttachments(note, noteCard.id);
        cards.push(...resources.cards);
        connections.push(...resources.connections);
      }
      
      // Internal links → connections
      if (note.links?.length) {
        connections.push(...this.parseLinks(note, noteCard.id));
      }
      
      // Mentions → person cards + connections
      if (note.mentions?.length) {
        const people = this.parseMentions(note, noteCard.id);
        cards.push(...people.cards);
        connections.push(...people.connections);
      }
    }
    
    return { cards, connections };
  }
  
  private parseNote(note: AltoNote): CanonicalCard {
    const content = this.normalizeContent(note.content);
    const tags = note.tags?.length ? note.tags : this.extractTags(content);
    
    return {
      id: this.generateId(),
      card_type: 'note',
      name: note.title || this.extractTitle(content),
      content,
      summary: this.generateSummary(content),
      
      latitude: null,
      longitude: null,
      location_name: null,
      
      created_at: note.created,
      modified_at: note.modified,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      
      folder: this.normalizeFolder(note.folder),
      tags,
      status: null,
      
      priority: 0,
      sort_order: 0,
      
      url: null,
      mime_type: null,
      is_collective: false,
      
      source: 'apple_notes',
      source_id: note.id,
      source_url: `applenotes://note/${note.id}`
    };
  }
  
  private parseChecklist(
    note: AltoNote, 
    parentId: string
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    note.checklist_items?.forEach((item, index) => {
      const taskId = this.generateId();
      
      cards.push({
        id: taskId,
        card_type: 'event',
        name: item.text,
        content: null,
        summary: null,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: note.created,
        modified_at: note.modified,
        due_at: null,
        completed_at: item.checked ? note.modified : null,
        event_start: null,
        event_end: null,
        
        folder: note.folder,
        tags: [],
        status: item.checked ? 'done' : 'todo',
        
        priority: 0,
        sort_order: index,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_notes',
        source_id: `${note.id}:task:${index}`,
        source_url: null
      });
      
      connections.push({
        id: this.generateId(),
        source_id: parentId,
        target_id: taskId,
        via_card_id: null,
        label: 'contains',
        weight: 1.0
      });
    });
    
    return { cards, connections };
  }
  
  private parseAttachments(
    note: AltoNote, 
    parentId: string
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    note.attachments?.forEach(att => {
      const resourceId = this.generateId();
      
      cards.push({
        id: resourceId,
        card_type: 'resource',
        name: att.filename,
        content: null,
        summary: null,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: note.created,
        modified_at: note.modified,
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: note.folder,
        tags: [],
        status: null,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: att.mime_type,
        is_collective: false,
        
        source: 'apple_notes',
        source_id: att.id,
        source_url: null
      });
      
      connections.push({
        id: this.generateId(),
        source_id: parentId,
        target_id: resourceId,
        via_card_id: null,
        label: 'attachment',
        weight: 1.0
      });
    });
    
    return { cards, connections };
  }
  
  private parseLinks(note: AltoNote, sourceId: string): CanonicalConnection[] {
    return (note.links || [])
      .filter(link => link.type === 'note' && link.target_note_id)
      .map(link => ({
        id: this.generateId(),
        source_id: sourceId,
        target_id: link.target_note_id!,  // Resolved in dedup phase
        via_card_id: null,
        label: 'links_to',
        weight: 1.0
      }));
  }
  
  private parseMentions(
    note: AltoNote, 
    sourceId: string
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    // Deduplicate by name
    const uniqueNames = new Set(note.mentions?.map(m => m.name.toLowerCase()));
    
    uniqueNames.forEach(name => {
      const personId = this.generateId();
      
      cards.push({
        id: personId,
        card_type: 'person',
        name: name,
        content: null,
        summary: null,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: note.created,
        modified_at: note.modified,
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: null,
        tags: [],
        status: null,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_notes',
        source_id: `mention:${name}`,
        source_url: null
      });
      
      connections.push({
        id: this.generateId(),
        source_id: sourceId,
        target_id: personId,
        via_card_id: null,
        label: 'mentions',
        weight: 0.5
      });
    });
    
    return { cards, connections };
  }
  
  // --- Utilities ---
  
  private generateId(): string {
    return crypto.randomUUID();
  }
  
  private normalizeContent(content: string): string {
    // Convert HTML to Markdown if needed
    if (content.trim().startsWith('<')) {
      return this.htmlToMarkdown(content);
    }
    return content;
  }
  
  private htmlToMarkdown(html: string): string {
    // Simplified conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
  
  private extractTitle(content: string): string {
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length <= 100) {
      return firstLine.replace(/^#+ /, '');
    }
    return content.slice(0, 50) + '...';
  }
  
  private extractTags(content: string): string[] {
    const matches = content.match(/#[\w-]+/g) || [];
    return [...new Set(matches.map(t => t.slice(1)))];
  }
  
  private generateSummary(content: string): string | null {
    if (content.length <= 200) return null;
    const truncated = content.slice(0, 200);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace) + '...';
  }
  
  private normalizeFolder(folder: string): string {
    return folder
      .replace(/^Notes\//, '')
      .replace(/\\/g, '/')
      .trim();
  }
}
```

---

## 4. Markdown Parser

```typescript
// src/etl/parsers/MarkdownParser.ts

import matter from 'gray-matter';

interface MarkdownFile {
  path: string;
  content: string;
}

export class MarkdownParser {
  
  parse(files: MarkdownFile[]): CanonicalCard[] {
    return files.map(file => this.parseFile(file));
  }
  
  private parseFile(file: MarkdownFile): CanonicalCard {
    const { data: fm, content } = matter(file.content);
    
    const pathParts = file.path.split('/');
    const filename = pathParts.pop() || '';
    const folder = pathParts.join('/');
    
    const title = fm.title 
      || this.extractHeading(content) 
      || filename.replace(/\.md$/, '');
    
    const now = new Date().toISOString();
    const created = this.parseDate(fm.date || fm.created) || now;
    
    const tags = Array.isArray(fm.tags) ? fm.tags 
      : typeof fm.tags === 'string' ? [fm.tags] 
      : this.extractTags(content);
    
    return {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: title,
      content: content.trim(),
      summary: this.generateSummary(content),
      
      latitude: fm.latitude ?? null,
      longitude: fm.longitude ?? null,
      location_name: fm.location ?? null,
      
      created_at: created,
      modified_at: this.parseDate(fm.modified) || created,
      due_at: this.parseDate(fm.due) || null,
      completed_at: null,
      event_start: null,
      event_end: null,
      
      folder: fm.folder || fm.category || folder || null,
      tags,
      status: fm.status || null,
      
      priority: fm.priority ?? 0,
      sort_order: 0,
      
      url: null,
      mime_type: 'text/markdown',
      is_collective: false,
      
      source: 'markdown',
      source_id: file.path,
      source_url: null
    };
  }
  
  private extractHeading(content: string): string | null {
    const match = content.match(/^#+ (.+)$/m);
    return match?.[1]?.trim() || null;
  }
  
  private extractTags(content: string): string[] {
    const matches = content.match(/#[\w-]+/g) || [];
    return [...new Set(matches.map(t => t.slice(1)))];
  }
  
  private generateSummary(content: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.length <= 200 ? trimmed : trimmed.slice(0, 200) + '...';
      }
    }
    return null;
  }
  
  private parseDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  }
}
```

---

## 5. Excel/CSV Parser

```typescript
// src/etl/parsers/ExcelParser.ts

import * as XLSX from 'xlsx';

interface ParseOptions {
  sheet?: string | number;
  titleColumn?: string;
  contentColumn?: string;
  folderColumn?: string;
  tagsColumn?: string;
  dateColumn?: string;
}

export class ExcelParser {
  
  parse(data: ArrayBuffer, options: ParseOptions = {}): CanonicalCard[] {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    
    const sheetName = typeof options.sheet === 'number'
      ? workbook.SheetNames[options.sheet]
      : options.sheet || workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
    
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    return rows.map((row, i) => this.rowToCard(row, i, options));
  }
  
  private rowToCard(
    row: Record<string, unknown>, 
    index: number,
    options: ParseOptions
  ): CanonicalCard {
    const titleCol = options.titleColumn || this.findColumn(row, ['title', 'name', 'subject']);
    const contentCol = options.contentColumn || this.findColumn(row, ['content', 'body', 'description']);
    const folderCol = options.folderColumn || this.findColumn(row, ['folder', 'category', 'type']);
    const tagsCol = options.tagsColumn || this.findColumn(row, ['tags', 'labels']);
    const dateCol = options.dateColumn || this.findColumn(row, ['date', 'created']);
    
    const title = titleCol ? String(row[titleCol] ?? '') : `Row ${index + 1}`;
    const content = contentCol ? String(row[contentCol] ?? '') : null;
    
    const tagsValue = tagsCol ? row[tagsCol] : null;
    const tags = typeof tagsValue === 'string'
      ? tagsValue.split(/[,;]/).map(t => t.trim()).filter(Boolean)
      : [];
    
    const dateValue = dateCol ? row[dateCol] : null;
    const created = dateValue instanceof Date
      ? dateValue.toISOString()
      : new Date().toISOString();
    
    return {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: title,
      content,
      summary: content?.slice(0, 200) || null,
      
      latitude: null,
      longitude: null,
      location_name: null,
      
      created_at: created,
      modified_at: created,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      
      folder: folderCol ? String(row[folderCol] ?? '') : null,
      tags,
      status: null,
      
      priority: 0,
      sort_order: index,
      
      url: null,
      mime_type: null,
      is_collective: false,
      
      source: 'excel',
      source_id: `row:${index}`,
      source_url: null
    };
  }
  
  private findColumn(row: Record<string, unknown>, candidates: string[]): string | null {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const found = keys.find(k => k.toLowerCase().includes(candidate));
      if (found) return found;
    }
    return null;
  }
}
```

---

## 6. Deduplication Engine

Prevents duplicate imports using source tracking.

```typescript
// src/etl/DedupEngine.ts

export interface DedupResult {
  toInsert: CanonicalCard[];
  toUpdate: CanonicalCard[];
  toSkip: CanonicalCard[];
  connections: CanonicalConnection[];
  sourceIdMap: Map<string, string>;
}

export class DedupEngine {
  
  constructor(private bridge: WorkerBridge) {}
  
  async process(
    cards: CanonicalCard[],
    connections: CanonicalConnection[]
  ): Promise<DedupResult> {
    const toInsert: CanonicalCard[] = [];
    const toUpdate: CanonicalCard[] = [];
    const toSkip: CanonicalCard[] = [];
    const sourceIdMap = new Map<string, string>();
    
    // Batch lookup existing cards
    const sourceKeys = cards.map(c => `'${c.source}:${c.source_id}'`).join(',');
    const existing = await this.bridge.query<{
      id: string;
      source: string;
      source_id: string;
      modified_at: string;
    }>(`
      SELECT id, source, source_id, modified_at FROM cards
      WHERE source || ':' || source_id IN (${sourceKeys})
    `);
    
    const existingMap = new Map(
      existing.map(e => [`${e.source}:${e.source_id}`, e])
    );
    
    for (const card of cards) {
      const key = `${card.source}:${card.source_id}`;
      const existing = existingMap.get(key);
      
      if (!existing) {
        toInsert.push(card);
        sourceIdMap.set(card.source_id, card.id);
      } else {
        sourceIdMap.set(card.source_id, existing.id);
        
        if (card.modified_at > existing.modified_at) {
          toUpdate.push({ ...card, id: existing.id });
        } else {
          toSkip.push(card);
        }
      }
    }
    
    // Resolve connection references
    const resolvedConnections = connections.map(conn => ({
      ...conn,
      source_id: sourceIdMap.get(conn.source_id) || conn.source_id,
      target_id: sourceIdMap.get(conn.target_id) || conn.target_id,
      via_card_id: conn.via_card_id 
        ? sourceIdMap.get(conn.via_card_id) || conn.via_card_id 
        : null
    }));
    
    return { toInsert, toUpdate, toSkip, connections: resolvedConnections, sourceIdMap };
  }
}
```

---

## 7. SQLite Writer

```typescript
// src/etl/SQLiteWriter.ts

export class SQLiteWriter {
  
  constructor(private bridge: WorkerBridge) {}
  
  async writeCards(cards: CanonicalCard[]): Promise<void> {
    if (!cards.length) return;
    
    const BATCH = 100;
    for (let i = 0; i < cards.length; i += BATCH) {
      const batch = cards.slice(i, i + BATCH);
      await this.bridge.transaction(
        batch.map(card => ({
          sql: `
            INSERT INTO cards (
              id, card_type, name, content, summary,
              latitude, longitude, location_name,
              created_at, modified_at, due_at, completed_at, event_start, event_end,
              folder, tags, status, priority, sort_order,
              url, mime_type, is_collective,
              source, source_id, source_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            card.id, card.card_type, card.name, card.content, card.summary,
            card.latitude, card.longitude, card.location_name,
            card.created_at, card.modified_at, card.due_at, card.completed_at, 
            card.event_start, card.event_end,
            card.folder, JSON.stringify(card.tags), card.status, 
            card.priority, card.sort_order,
            card.url, card.mime_type, card.is_collective ? 1 : 0,
            card.source, card.source_id, card.source_url
          ]
        }))
      );
    }
  }
  
  async updateCards(cards: CanonicalCard[]): Promise<void> {
    if (!cards.length) return;
    
    await this.bridge.transaction(
      cards.map(card => ({
        sql: `
          UPDATE cards SET
            card_type = ?, name = ?, content = ?, summary = ?,
            latitude = ?, longitude = ?, location_name = ?,
            modified_at = ?, due_at = ?, completed_at = ?, event_start = ?, event_end = ?,
            folder = ?, tags = ?, status = ?, priority = ?, sort_order = ?,
            url = ?, mime_type = ?, sync_status = 'pending'
          WHERE id = ?
        `,
        params: [
          card.card_type, card.name, card.content, card.summary,
          card.latitude, card.longitude, card.location_name,
          card.modified_at, card.due_at, card.completed_at, card.event_start, card.event_end,
          card.folder, JSON.stringify(card.tags), card.status, card.priority, card.sort_order,
          card.url, card.mime_type,
          card.id
        ]
      }))
    );
  }
  
  async writeConnections(connections: CanonicalConnection[]): Promise<void> {
    if (!connections.length) return;
    
    await this.bridge.transaction(
      connections.map(conn => ({
        sql: `
          INSERT OR IGNORE INTO connections (id, source_id, target_id, via_card_id, label, weight)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [conn.id, conn.source_id, conn.target_id, conn.via_card_id, conn.label, conn.weight]
      }))
    );
  }
}
```

---

## 8. Import Orchestrator

Ties the pipeline together.

```typescript
// src/etl/ImportOrchestrator.ts

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  connections: number;
  errors: string[];
}

export class ImportOrchestrator {
  private parsers: Map<string, any>;
  private dedup: DedupEngine;
  private writer: SQLiteWriter;
  
  constructor(private bridge: WorkerBridge) {
    this.dedup = new DedupEngine(bridge);
    this.writer = new SQLiteWriter(bridge);
    
    this.parsers = new Map([
      ['apple_notes', new AppleNotesParser()],
      ['markdown', new MarkdownParser()],
      ['excel', new ExcelParser()],
    ]);
  }
  
  async import(
    data: ArrayBuffer | string,
    source: string,
    options?: Record<string, unknown>
  ): Promise<ImportResult> {
    const errors: string[] = [];
    
    const parser = this.parsers.get(source);
    if (!parser) throw new Error(`Unknown source: ${source}`);
    
    // Parse
    let cards: CanonicalCard[];
    let connections: CanonicalConnection[] = [];
    
    try {
      if (source === 'apple_notes') {
        const json = typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));
        const result = parser.parse(json);
        cards = result.cards;
        connections = result.connections;
      } else if (source === 'excel') {
        cards = parser.parse(data, options);
      } else if (source === 'markdown') {
        const files = typeof data === 'string' ? JSON.parse(data) : data;
        cards = parser.parse(files);
      } else {
        throw new Error(`Parser not implemented: ${source}`);
      }
    } catch (e) {
      errors.push(`Parse error: ${(e as Error).message}`);
      return { inserted: 0, updated: 0, skipped: 0, connections: 0, errors };
    }
    
    // Deduplicate
    const dedupResult = await this.dedup.process(cards, connections);
    
    // Write
    await this.writer.writeCards(dedupResult.toInsert);
    await this.writer.updateCards(dedupResult.toUpdate);
    await this.writer.writeConnections(dedupResult.connections);
    
    return {
      inserted: dedupResult.toInsert.length,
      updated: dedupResult.toUpdate.length,
      skipped: dedupResult.toSkip.length,
      connections: dedupResult.connections.length,
      errors
    };
  }
}
```

---

## 9. Export Pipeline

```typescript
// src/etl/ExportOrchestrator.ts

export class ExportOrchestrator {
  
  constructor(private bridge: WorkerBridge) {}
  
  async export(
    format: 'markdown' | 'json' | 'csv',
    cardIds?: string[]
  ): Promise<string> {
    const where = cardIds?.length
      ? `id IN (${cardIds.map(() => '?').join(',')})`
      : 'deleted_at IS NULL';
    
    const cards = await this.bridge.query<any>(
      `SELECT * FROM cards WHERE ${where}`,
      cardIds
    );
    
    switch (format) {
      case 'markdown':
        return this.toMarkdown(cards);
      case 'json':
        return this.toJSON(cards);
      case 'csv':
        return this.toCSV(cards);
    }
  }
  
  private toMarkdown(cards: any[]): string {
    return cards.map(card => {
      const fm = [
        '---',
        `title: "${card.name.replace(/"/g, '\\"')}"`,
        `created: ${card.created_at}`,
        card.folder ? `folder: ${card.folder}` : null,
        card.tags ? `tags: [${JSON.parse(card.tags).join(', ')}]` : null,
        '---',
        ''
      ].filter(Boolean).join('\n');
      
      return fm + (card.content || '');
    }).join('\n\n---\n\n');
  }
  
  private toJSON(cards: any[]): string {
    return JSON.stringify(cards, null, 2);
  }
  
  private toCSV(cards: any[]): string {
    const headers = ['id', 'type', 'name', 'folder', 'tags', 'status', 'priority', 'created', 'modified'];
    const rows = cards.map(c => [
      c.id,
      c.card_type,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.folder || '',
      c.tags || '',
      c.status || '',
      c.priority,
      c.created_at,
      c.modified_at
    ].join(','));
    
    return [headers.join(','), ...rows].join('\n');
  }
}
```

---

## 10. Data Catalog Schema

```sql
-- Import history
CREATE TABLE import_history (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  filename TEXT,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  cards_inserted INTEGER NOT NULL DEFAULT 0,
  cards_updated INTEGER NOT NULL DEFAULT 0,
  cards_skipped INTEGER NOT NULL DEFAULT 0,
  connections_created INTEGER NOT NULL DEFAULT 0,
  errors TEXT
);

-- Source registry
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT,
  last_sync TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
```

---

## 11. Worker Handler Integration

```typescript
// In worker: src/worker/handlers/etl.ts

async function handleETLImport(payload: {
  data: ArrayBuffer | string;
  source: string;
  options?: Record<string, unknown>;
}): Promise<ImportResult> {
  const orchestrator = new ImportOrchestrator(workerDB);
  return orchestrator.import(payload.data, payload.source, payload.options);
}

function handleETLExport(payload: {
  format: 'markdown' | 'json' | 'csv';
  cardIds?: string[];
}): Promise<string> {
  const orchestrator = new ExportOrchestrator(workerDB);
  return orchestrator.export(payload.format, payload.cardIds);
}
```

---

## 12. Usage Examples

### Import Apple Notes

```typescript
// From Native Shell: Swift reads alto-index export, passes to Worker
const altoExport = await fs.readFile('notes-export.json');
const result = await workerBridge.importFile(altoExport, 'apple_notes');

console.log(`Imported: ${result.inserted} new, ${result.updated} updated`);
```

### Import Markdown Folder

```typescript
const files = [
  { path: 'notes/meeting.md', content: '# Meeting Notes\n...' },
  { path: 'notes/ideas.md', content: '---\ntags: [idea]\n---\n...' }
];

const result = await workerBridge.importFile(
  JSON.stringify(files), 
  'markdown'
);
```

### Export to JSON

```typescript
const json = await workerBridge.exportFile('json');
await fs.writeFile('backup.json', json);
```

---

## Key Principles

1. **Source tracking** — Every card remembers its origin for deduplication
2. **Idempotent imports** — Re-importing the same data updates, doesn't duplicate
3. **Canonical schema** — All sources map to unified CanonicalCard
4. **Batch operations** — Transactions for performance
5. **Connection extraction** — Links, mentions, attachments become graph edges
