import initSqlJs, { Database } from 'sql.js';
import type { Node } from '../types/node';

export interface SQLiteSyncOptions {
  batchSize?: number;
  maxFileSize?: number; // in bytes
  enabledSources?: string[];
}

export interface SQLiteSyncResult {
  imported: number;
  failed: number;
  errors: string[];
  sources: string[];
}

/**
 * SQLite-to-SQLite sync manager for web environment
 * Handles imported SQLite databases from Apple apps and other sources
 */
export class SQLiteSyncManager {
  private sql: any;
  private options: Required<SQLiteSyncOptions>;

  constructor(options: SQLiteSyncOptions = {}) {
    this.options = {
      batchSize: options.batchSize ?? 500,
      maxFileSize: options.maxFileSize ?? 100 * 1024 * 1024, // 100MB
      enabledSources: options.enabledSources ?? ['notes', 'reminders', 'calendar', 'contacts', 'safari']
    };
  }

  /**
   * Initialize sql.js engine
   */
  async initialize(): Promise<void> {
    if (this.sql) return;

    this.sql = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  /**
   * Import SQLite database from file and extract Apple app data
   */
  async importSQLiteFile(file: File): Promise<SQLiteSyncResult> {
    await this.initialize();

    if (file.size > this.options.maxFileSize) {
      throw new Error(`File size ${file.size} exceeds maximum ${this.options.maxFileSize} bytes`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let db: Database;
    try {
      db = new this.sql.Database(uint8Array);
    } catch (error) {
      throw new Error(`Failed to open SQLite database: ${error}`);
    }

    try {
      return await this.extractDataFromDatabase(db, file.name);
    } finally {
      db.close();
    }
  }

  /**
   * Extract data from SQLite database based on detected schema
   */
  private async extractDataFromDatabase(db: Database, filename: string): Promise<SQLiteSyncResult> {
    const result: SQLiteSyncResult = {
      imported: 0,
      failed: 0,
      errors: [],
      sources: []
    };

    // Detect database type and schema
    const dbType = this.detectDatabaseType(db);
    result.sources.push(dbType);

    switch (dbType) {
      case 'notes':
        if (this.options.enabledSources.includes('notes')) {
          const notesResult = await this.extractNotesData(db);
          this.mergeResults(result, notesResult);
        }
        break;

      case 'reminders':
        if (this.options.enabledSources.includes('reminders')) {
          const remindersResult = await this.extractRemindersData(db);
          this.mergeResults(result, remindersResult);
        }
        break;

      case 'calendar':
        if (this.options.enabledSources.includes('calendar')) {
          const calendarResult = await this.extractCalendarData(db);
          this.mergeResults(result, calendarResult);
        }
        break;

      case 'contacts':
        if (this.options.enabledSources.includes('contacts')) {
          const contactsResult = await this.extractContactsData(db);
          this.mergeResults(result, contactsResult);
        }
        break;

      case 'safari':
        if (this.options.enabledSources.includes('safari')) {
          const safariResult = await this.extractSafariData(db);
          this.mergeResults(result, safariResult);
        }
        break;

      case 'generic':
        const genericResult = await this.extractGenericData(db, filename);
        this.mergeResults(result, genericResult);
        break;

      default:
        result.errors.push(`Unknown database type: ${dbType}`);
    }

    return result;
  }

  /**
   * Detect the type of Apple app database based on schema
   */
  private detectDatabaseType(db: Database): string {
    try {
      // Get list of tables
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0];
      if (!tables) return 'generic';

      const tableNames = tables.values.map(row => row[0] as string).map(name => name.toLowerCase());

      // Notes database detection
      if (tableNames.includes('ziccloudsyncingobject') || tableNames.includes('zicnotedata')) {
        return 'notes';
      }

      // Reminders database detection
      if (tableNames.includes('zreminder') || tableNames.includes('zlist')) {
        return 'reminders';
      }

      // Calendar database detection
      if (tableNames.includes('event') || tableNames.includes('calendar')) {
        return 'calendar';
      }

      // Contacts database detection
      if (tableNames.includes('abperson') || tableNames.includes('abmultivalue')) {
        return 'contacts';
      }

      // Safari database detection
      if (tableNames.includes('bookmarks') || tableNames.includes('reading_list_item')) {
        return 'safari';
      }

      return 'generic';
    } catch (error) {
      return 'generic';
    }
  }

  /**
   * Extract Notes app data
   */
  private async extractNotesData(db: Database): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      // Try modern Notes schema first
      const modernQuery = `
        SELECT
          z_pk as id,
          ztitle1 as title,
          zsnippet as snippet,
          zcreationdate1 as created_date,
          zmodificationdate1 as modified_date,
          zfolder as folder_id
        FROM ziccloudsyncingobject
        WHERE ztypeuti LIKE '%note%'
        AND zmarkedfordeletion = 0
        LIMIT ?
      `;

      let noteRows;
      try {
        const queryResult = db.exec(modernQuery, [this.options.batchSize]);
        noteRows = queryResult[0]?.values || [];
      } catch {
        // Try legacy schema
        const legacyQuery = `
          SELECT
            Z_PK as id,
            ZTITLE as title,
            ZSUMMARY as snippet,
            ZCREATIONDATE as created_date,
            ZMODIFICATIONDATE as modified_date
          FROM ZNOTE
          WHERE ZMARKEDFORDELETION = 0
          LIMIT ?
        `;
        const queryResult = db.exec(legacyQuery, [this.options.batchSize]);
        noteRows = queryResult[0]?.values || [];
      }

      for (const row of noteRows) {
        try {
          const node = this.createNoteNode(row);
          await this.saveNode(node);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process note: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Notes extraction failed: ${error}`);
    }

    return result;
  }

  /**
   * Extract Reminders app data
   */
  private async extractRemindersData(db: Database): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      const query = `
        SELECT
          Z_PK as id,
          ZTITLE as title,
          ZNOTES as notes,
          ZCREATIONDATE as created_date,
          ZLASTMODIFIEDDATE as modified_date,
          ZCOMPLETED as completed,
          ZDUEDATE as due_date
        FROM ZREMINDER
        WHERE ZMARKEDFORDELETION = 0
        ORDER BY ZLASTMODIFIEDDATE DESC
        LIMIT ?
      `;

      const queryResult = db.exec(query, [this.options.batchSize]);
      const reminderRows = queryResult[0]?.values || [];

      for (const row of reminderRows) {
        try {
          const node = this.createReminderNode(row);
          await this.saveNode(node);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process reminder: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Reminders extraction failed: ${error}`);
    }

    return result;
  }

  /**
   * Extract Calendar app data
   */
  private async extractCalendarData(db: Database): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      const query = `
        SELECT
          e.ROWID as id,
          e.summary as title,
          e.description as description,
          e.start_date,
          e.end_date,
          e.last_modified,
          c.title as calendar_title
        FROM Event e
        LEFT JOIN Calendar c ON e.calendar_id = c.ROWID
        ORDER BY e.start_date DESC
        LIMIT ?
      `;

      const queryResult = db.exec(query, [this.options.batchSize]);
      const eventRows = queryResult[0]?.values || [];

      for (const row of eventRows) {
        try {
          const node = this.createEventNode(row);
          await this.saveNode(node);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process event: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Calendar extraction failed: ${error}`);
    }

    return result;
  }

  /**
   * Extract Contacts app data
   */
  private async extractContactsData(db: Database): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      const query = `
        SELECT
          ROWID as id,
          First as first_name,
          Last as last_name,
          Organization as organization,
          Note as notes,
          CreationDate as created_date,
          ModificationDate as modified_date
        FROM ABPerson
        ORDER BY ModificationDate DESC
        LIMIT ?
      `;

      const queryResult = db.exec(query, [this.options.batchSize]);
      const contactRows = queryResult[0]?.values || [];

      for (const row of contactRows) {
        try {
          const node = this.createContactNode(row);
          await this.saveNode(node);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process contact: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Contacts extraction failed: ${error}`);
    }

    return result;
  }

  /**
   * Extract Safari app data
   */
  private async extractSafariData(db: Database): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      // Bookmarks
      try {
        const bookmarkQuery = `
          SELECT
            id,
            title,
            url,
            date_added,
            date_modified
          FROM bookmarks
          WHERE type = 0
          ORDER BY date_modified DESC
          LIMIT ?
        `;

        const bookmarkResult = db.exec(bookmarkQuery, [this.options.batchSize]);
        const bookmarkRows = bookmarkResult[0]?.values || [];

        for (const row of bookmarkRows) {
          try {
            const node = this.createBookmarkNode(row);
            await this.saveNode(node);
            result.imported++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to process bookmark: ${error}`);
          }
        }
      } catch {
        // Bookmarks table might not exist
      }

      // Reading List
      try {
        const readingListQuery = `
          SELECT
            id,
            title,
            url,
            date_added,
            preview_text
          FROM reading_list_item
          ORDER BY date_added DESC
          LIMIT ?
        `;

        const readingListResult = db.exec(readingListQuery, [this.options.batchSize]);
        const readingListRows = readingListResult[0]?.values || [];

        for (const row of readingListRows) {
          try {
            const node = this.createReadingListNode(row);
            await this.saveNode(node);
            result.imported++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to process reading list item: ${error}`);
          }
        }
      } catch {
        // Reading list table might not exist
      }
    } catch (error) {
      result.errors.push(`Safari extraction failed: ${error}`);
    }

    return result;
  }

  /**
   * Extract data from generic SQLite database
   */
  private async extractGenericData(db: Database, filename: string): Promise<Partial<SQLiteSyncResult>> {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      // Get all tables
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (!tablesResult[0]) return result;

      const tableNames = tablesResult[0].values.map(row => row[0] as string);

      for (const tableName of tableNames) {
        if (tableName.startsWith('sqlite_')) continue; // Skip system tables

        try {
          // Get table schema
          const schemaResult = db.exec(`PRAGMA table_info(${tableName})`);
          if (!schemaResult[0]) continue;

          const columns = schemaResult[0].values.map(row => row[1] as string);

          // Extract sample data
          const dataResult = db.exec(`SELECT * FROM ${tableName} LIMIT 10`);
          if (!dataResult[0]) continue;

          const node = this.createGenericTableNode(tableName, columns, dataResult[0].values, filename);
          await this.saveNode(node);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to process table ${tableName}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Generic extraction failed: ${error}`);
    }

    return result;
  }

  // MARK: - Node Creation Methods

  private createNoteNode(row: any[]): Node {
    const [id, title, snippet, createdDate, modifiedDate, folderId] = row;

    const createdAt = this.convertAppleTimestamp(createdDate as number);
    const modifiedAt = this.convertAppleTimestamp(modifiedDate as number);

    return {
      id: crypto.randomUUID(),
      nodeType: 'note',
      name: title as string || 'Untitled Note',
      content: snippet as string || 'No content available',
      summary: snippet ? String(snippet).substring(0, 100) : 'No preview available',
      createdAt: createdAt.toISOString(),
      modifiedAt: modifiedAt.toISOString(),
      folder: 'notes',
      tags: ['apple-notes', 'sqlite-import'],
      source: 'apple-notes-sqlite',
      sourceId: String(id),
      sourceUrl: null
    };
  }

  private createReminderNode(row: any[]): Node {
    const [id, title, notes, createdDate, modifiedDate, completed, dueDate] = row;

    const createdAt = this.convertAppleTimestamp(createdDate as number);
    const modifiedAt = this.convertAppleTimestamp(modifiedDate as number);

    const isCompleted = Boolean(completed);
    let content = `# ${title || 'Untitled Reminder'}\n\n`;
    if (notes) content += `${notes}\n\n`;
    content += `Status: ${isCompleted ? 'Completed' : 'Pending'}`;

    return {
      id: crypto.randomUUID(),
      nodeType: 'task',
      name: title as string || 'Untitled Reminder',
      content,
      summary: notes ? String(notes).substring(0, 100) : 'No description',
      createdAt: createdAt.toISOString(),
      modifiedAt: modifiedAt.toISOString(),
      folder: 'reminders',
      tags: ['apple-reminders', 'sqlite-import', isCompleted ? 'completed' : 'pending'],
      source: 'apple-reminders-sqlite',
      sourceId: String(id),
      sourceUrl: null
    };
  }

  private createEventNode(row: any[]): Node {
    const [id, title, description, startDate, endDate, lastModified, calendarTitle] = row;

    let content = `# ${title || 'Untitled Event'}\n\n`;
    if (description) content += `${description}\n\n`;
    if (calendarTitle) content += `Calendar: ${calendarTitle}`;

    return {
      id: crypto.randomUUID(),
      nodeType: 'event',
      name: title as string || 'Untitled Event',
      content,
      summary: description ? String(description).substring(0, 100) : 'No description',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: 'calendar',
      tags: ['apple-calendar', 'sqlite-import'],
      source: 'apple-calendar-sqlite',
      sourceId: String(id),
      sourceUrl: null
    };
  }

  private createContactNode(row: any[]): Node {
    const [id, firstName, lastName, organization, notes, createdDate, modifiedDate] = row;

    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const displayName = fullName || organization || 'Unknown Contact';

    let content = `# ${displayName}\n\n`;
    if (organization && fullName) content += `Organization: ${organization}\n\n`;
    if (notes) content += `Notes: ${notes}`;

    return {
      id: crypto.randomUUID(),
      nodeType: 'person',
      name: displayName,
      content,
      summary: organization as string || 'Contact',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: 'contacts',
      tags: ['apple-contacts', 'sqlite-import'],
      source: 'apple-contacts-sqlite',
      sourceId: String(id),
      sourceUrl: null
    };
  }

  private createBookmarkNode(row: any[]): Node {
    const [id, title, url, dateAdded, dateModified] = row;

    const content = `# ${title || 'Untitled Bookmark'}\n\n[Visit Link](${url || '#'})`;

    return {
      id: crypto.randomUUID(),
      nodeType: 'bookmark',
      name: title as string || 'Untitled Bookmark',
      content,
      summary: url as string || 'No URL',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: 'bookmarks',
      tags: ['apple-safari', 'bookmark', 'sqlite-import'],
      source: 'apple-safari-sqlite',
      sourceId: String(id),
      sourceUrl: url as string || null
    };
  }

  private createReadingListNode(row: any[]): Node {
    const [id, title, url, dateAdded, previewText] = row;

    let content = `# ${title || 'Untitled Article'}\n\n`;
    if (previewText) content += `${previewText}\n\n`;
    content += `[Read Article](${url || '#'})`;

    return {
      id: crypto.randomUUID(),
      nodeType: 'article',
      name: title as string || 'Untitled Article',
      content,
      summary: previewText ? String(previewText).substring(0, 100) : 'Reading list item',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: 'reading-list',
      tags: ['apple-safari', 'reading-list', 'sqlite-import'],
      source: 'apple-safari-sqlite',
      sourceId: String(id),
      sourceUrl: url as string || null
    };
  }

  private createGenericTableNode(tableName: string, columns: string[], rows: any[][], filename: string): Node {
    let content = `# ${tableName} (from ${filename})\n\n`;
    content += `Columns: ${columns.join(', ')}\n\n`;
    content += `Sample data (${rows.length} rows):\n\n`;

    // Create markdown table
    if (rows.length > 0) {
      content += `| ${columns.join(' | ')} |\n`;
      content += `| ${columns.map(() => '---').join(' | ')} |\n`;

      rows.slice(0, 5).forEach(row => {
        content += `| ${row.map(cell => String(cell || '')).join(' | ')} |\n`;
      });

      if (rows.length > 5) {
        content += `\n... and ${rows.length - 5} more rows`;
      }
    }

    return {
      id: crypto.randomUUID(),
      nodeType: 'database-table',
      name: `${tableName} (${filename})`,
      content,
      summary: `Table with ${columns.length} columns and ${rows.length} rows`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: 'sqlite-import',
      tags: ['sqlite-import', 'generic-data'],
      source: 'generic-sqlite',
      sourceId: tableName,
      sourceUrl: null
    };
  }

  // MARK: - Helper Methods

  private convertAppleTimestamp(timestamp: number): Date {
    // Apple Core Data timestamps are seconds since 2001-01-01
    const appleEpoch = new Date(2001, 0, 1).getTime() / 1000;
    return new Date((timestamp + appleEpoch) * 1000);
  }

  private async saveNode(node: Node): Promise<void> {
    // In a real implementation, this would save to the application database
    // For now, we'll store in localStorage or emit an event
    const event = new CustomEvent('node-imported', { detail: node });
    window.dispatchEvent(event);
  }

  private mergeResults(target: SQLiteSyncResult, source: Partial<SQLiteSyncResult>): void {
    target.imported += source.imported || 0;
    target.failed += source.failed || 0;
    target.errors.push(...(source.errors || []));
  }
}

// Export utility function for easy use
export async function importSQLiteDatabase(
  file: File,
  options?: SQLiteSyncOptions
): Promise<SQLiteSyncResult> {
  const manager = new SQLiteSyncManager(options);
  return await manager.importSQLiteFile(file);
}