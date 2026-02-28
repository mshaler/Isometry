# Isometry v5 Apple Apps ETL Specification

## Overview

This specification covers SQLite-to-SQLite import from Apple's first-party apps: **Reminders**, **Calendar**, and **Contacts**. These three apps map directly to Isometry's core card types (Event, Person) and form the foundation of a personal information dashboard.

**Design Principle:** Read-only access to Apple's SQLite databases. No modifications. Isometry maintains its own copy with source tracking for deduplication.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Apple Apps ETL Pipeline                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  Reminders  │  │  Calendar   │  │  Contacts   │                          │
│  │   SQLite    │  │   SQLite    │  │   SQLite    │                          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                          │
│         │                │                │                                  │
│         ▼                ▼                ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Native Shell (Swift)                             │    │
│  │  • Sandbox permission requests                                       │    │
│  │  • Database file access                                              │    │
│  │  • Pass ArrayBuffer to Worker                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Web Worker (sql.js)                              │    │
│  │  • Open source DB read-only                                          │    │
│  │  • Parse → CanonicalCard                                             │    │
│  │  • Dedup against existing                                            │    │
│  │  • Write to Isometry DB                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Sandbox & Permissions

### 1.1 Required Entitlements (macOS)

```xml
<!-- Isometry.entitlements -->
<key>com.apple.security.personal-information.calendars</key>
<true/>

<key>com.apple.security.personal-information.addressbook</key>
<true/>

<!-- Reminders requires Full Disk Access or automation -->
<key>com.apple.security.automation.apple-events</key>
<true/>
```

### 1.2 Database Locations

| App | Database Path | Access Method |
|-----|---------------|---------------|
| **Reminders** | `~/Library/Reminders/Container_v1/Stores/*.sqlite` | Full Disk Access |
| **Calendar** | `~/Library/Calendars/Calendar.sqlitedb` | Calendar entitlement |
| **Contacts** | `~/Library/Application Support/AddressBook/AddressBook-v22.abcddb` | Contacts entitlement |

### 1.3 Swift: Database Access

```swift
// Sources/Native/AppleDataAccess.swift

import Foundation

enum AppleDataSource: String, CaseIterable {
    case reminders
    case calendar
    case contacts
    
    var databasePath: URL? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        
        switch self {
        case .reminders:
            let container = home
                .appendingPathComponent("Library/Reminders/Container_v1/Stores")
            // Find the first .sqlite file
            let files = try? FileManager.default.contentsOfDirectory(at: container, includingPropertiesForKeys: nil)
            return files?.first { $0.pathExtension == "sqlite" }
            
        case .calendar:
            return home.appendingPathComponent("Library/Calendars/Calendar.sqlitedb")
            
        case .contacts:
            return home.appendingPathComponent("Library/Application Support/AddressBook/AddressBook-v22.abcddb")
        }
    }
    
    func readDatabase() throws -> Data {
        guard let path = databasePath else {
            throw AppleDataError.databaseNotFound(self)
        }
        
        // Check access
        guard FileManager.default.isReadableFile(atPath: path.path) else {
            throw AppleDataError.accessDenied(self)
        }
        
        return try Data(contentsOf: path)
    }
}

enum AppleDataError: LocalizedError {
    case databaseNotFound(AppleDataSource)
    case accessDenied(AppleDataSource)
    
    var errorDescription: String? {
        switch self {
        case .databaseNotFound(let source):
            return "\(source.rawValue.capitalized) database not found"
        case .accessDenied(let source):
            return "Access denied to \(source.rawValue). Grant Full Disk Access in System Preferences."
        }
    }
}
```

---

## 2. Apple Reminders

### 2.1 Source Schema

```sql
-- Key tables in Reminders SQLite database
-- Table: ZREMCDREMINDER (reminders)
-- Table: ZREMCDLIST (lists)

-- ZREMCDREMINDER columns of interest:
Z_PK                    -- Primary key
ZCOMPLETED              -- 0 or 1
ZCOMPLETIONDATE         -- Timestamp (Core Data format)
ZCREATIONDATE           -- Timestamp
ZDUEDATE                -- Timestamp (optional)
ZDUEDATEHASTIME         -- 0 or 1
ZFLAGGED                -- 0 or 1
ZLIST                   -- FK to ZREMCDLIST
ZMODIFICATIONDATE       -- Timestamp
ZPRIORITY               -- 0=none, 1=high, 5=medium, 9=low
ZTITLE                  -- Reminder title
ZNOTES                  -- Notes/description

-- ZREMCDLIST columns:
Z_PK                    -- Primary key
ZNAME                   -- List name
ZCOLOR                  -- List color (integer)
```

### 2.2 Parser Implementation

```typescript
// src/etl/parsers/AppleRemindersParser.ts

import { Database } from 'sql.js';

// Core Data timestamp: seconds since 2001-01-01
const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

function coreDataToISO(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const ms = (timestamp + CORE_DATA_EPOCH) * 1000;
  return new Date(ms).toISOString();
}

export class AppleRemindersParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Get lists for folder mapping
      const lists = this.parseLists(db);
      
      // Get reminders
      const reminders = this.parseReminders(db, lists);
      cards.push(...reminders);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseLists(db: Database): Map<number, string> {
    const lists = new Map<number, string>();
    
    const stmt = db.prepare(`
      SELECT Z_PK, ZNAME FROM ZREMCDLIST WHERE ZNAME IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { Z_PK: number; ZNAME: string };
      lists.set(row.Z_PK, row.ZNAME);
    }
    stmt.free();
    
    return lists;
  }
  
  private parseReminders(db: Database, lists: Map<number, string>): CanonicalCard[] {
    const cards: CanonicalCard[] = [];
    
    const stmt = db.prepare(`
      SELECT 
        Z_PK,
        ZTITLE,
        ZNOTES,
        ZCOMPLETED,
        ZCOMPLETIONDATE,
        ZCREATIONDATE,
        ZMODIFICATIONDATE,
        ZDUEDATE,
        ZDUEDATEHASTIME,
        ZFLAGGED,
        ZPRIORITY,
        ZLIST
      FROM ZREMCDREMINDER
      WHERE ZTITLE IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        Z_PK: number;
        ZTITLE: string;
        ZNOTES: string | null;
        ZCOMPLETED: number;
        ZCOMPLETIONDATE: number | null;
        ZCREATIONDATE: number;
        ZMODIFICATIONDATE: number;
        ZDUEDATE: number | null;
        ZDUEDATEHASTIME: number;
        ZFLAGGED: number;
        ZPRIORITY: number;
        ZLIST: number;
      };
      
      const listName = lists.get(row.ZLIST) || 'Reminders';
      
      // Map Apple priority (1=high, 5=med, 9=low, 0=none) to Isometry (0-5)
      let priority = 0;
      if (row.ZPRIORITY === 1) priority = 5;
      else if (row.ZPRIORITY === 5) priority = 3;
      else if (row.ZPRIORITY === 9) priority = 1;
      if (row.ZFLAGGED) priority = Math.max(priority, 4);
      
      cards.push({
        id: crypto.randomUUID(),
        card_type: 'event',
        name: row.ZTITLE,
        content: row.ZNOTES,
        summary: row.ZNOTES?.slice(0, 200) || null,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: coreDataToISO(row.ZCREATIONDATE) || new Date().toISOString(),
        modified_at: coreDataToISO(row.ZMODIFICATIONDATE) || new Date().toISOString(),
        due_at: coreDataToISO(row.ZDUEDATE),
        completed_at: row.ZCOMPLETED ? coreDataToISO(row.ZCOMPLETIONDATE) : null,
        event_start: null,  // Reminders don't have start times
        event_end: null,
        
        folder: listName,
        tags: row.ZFLAGGED ? ['flagged'] : [],
        status: row.ZCOMPLETED ? 'done' : 'todo',
        
        priority,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_reminders',
        source_id: String(row.Z_PK),
        source_url: `x-apple-reminderkit://reminder/${row.Z_PK}`
      });
    }
    stmt.free();
    
    return cards;
  }
}
```

---

## 3. Apple Calendar

### 3.1 Source Schema

```sql
-- Key tables in Calendar SQLite database
-- Table: ZCALENDARITEM (events)
-- Table: ZCALENDAR (calendars)

-- ZCALENDARITEM columns of interest:
Z_PK                    -- Primary key
ZCALENDAR               -- FK to ZCALENDAR
ZTITLE                  -- Event title
ZNOTES                  -- Event notes
ZLOCATION               -- Location string
ZSTARTDATE              -- Start timestamp
ZENDDATE                -- End timestamp
ZALLDAY                 -- 0 or 1
ZCREATIONDATE           -- Creation timestamp
ZLASTMODIFIEDDATE       -- Modified timestamp
ZSTATUS                 -- 0=none, 1=confirmed, 2=tentative, 3=cancelled
ZRECURRENCERULE         -- Recurrence data (binary plist)
ZXATTRIBUTES            -- Extended attributes (binary plist)

-- ZCALENDAR columns:
Z_PK                    -- Primary key
ZTITLE                  -- Calendar name
ZCOLOR                  -- Calendar color
ZTYPE                   -- Calendar type
```

### 3.2 Parser Implementation

```typescript
// src/etl/parsers/AppleCalendarParser.ts

import { Database } from 'sql.js';

const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

function coreDataToISO(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const ms = (timestamp + CORE_DATA_EPOCH) * 1000;
  return new Date(ms).toISOString();
}

export class AppleCalendarParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Get calendars for folder mapping
      const calendars = this.parseCalendars(db);
      
      // Get events
      const events = this.parseEvents(db, calendars);
      cards.push(...events);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseCalendars(db: Database): Map<number, { name: string; color: string | null }> {
    const calendars = new Map<number, { name: string; color: string | null }>();
    
    const stmt = db.prepare(`
      SELECT Z_PK, ZTITLE, ZCOLOR FROM ZCALENDAR WHERE ZTITLE IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { Z_PK: number; ZTITLE: string; ZCOLOR: string | null };
      calendars.set(row.Z_PK, { name: row.ZTITLE, color: row.ZCOLOR });
    }
    stmt.free();
    
    return calendars;
  }
  
  private parseEvents(
    db: Database, 
    calendars: Map<number, { name: string; color: string | null }>
  ): CanonicalCard[] {
    const cards: CanonicalCard[] = [];
    
    const stmt = db.prepare(`
      SELECT 
        Z_PK,
        ZCALENDAR,
        ZTITLE,
        ZNOTES,
        ZLOCATION,
        ZSTARTDATE,
        ZENDDATE,
        ZALLDAY,
        ZCREATIONDATE,
        ZLASTMODIFIEDDATE,
        ZSTATUS
      FROM ZCALENDARITEM
      WHERE ZTITLE IS NOT NULL
        AND ZSTARTDATE IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        Z_PK: number;
        ZCALENDAR: number;
        ZTITLE: string;
        ZNOTES: string | null;
        ZLOCATION: string | null;
        ZSTARTDATE: number;
        ZENDDATE: number | null;
        ZALLDAY: number;
        ZCREATIONDATE: number;
        ZLASTMODIFIEDDATE: number;
        ZSTATUS: number;
      };
      
      const calendar = calendars.get(row.ZCALENDAR);
      const calendarName = calendar?.name || 'Calendar';
      
      // Map status
      let status: string | null = null;
      switch (row.ZSTATUS) {
        case 1: status = 'confirmed'; break;
        case 2: status = 'tentative'; break;
        case 3: status = 'cancelled'; break;
      }
      
      // Build tags
      const tags: string[] = [];
      if (row.ZALLDAY) tags.push('all-day');
      if (calendar?.color) tags.push(`color:${calendar.color}`);
      
      cards.push({
        id: crypto.randomUUID(),
        card_type: 'event',
        name: row.ZTITLE,
        content: row.ZNOTES,
        summary: row.ZNOTES?.slice(0, 200) || null,
        
        latitude: null,
        longitude: null,
        location_name: row.ZLOCATION,
        
        created_at: coreDataToISO(row.ZCREATIONDATE) || new Date().toISOString(),
        modified_at: coreDataToISO(row.ZLASTMODIFIEDDATE) || new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: coreDataToISO(row.ZSTARTDATE),
        event_end: coreDataToISO(row.ZENDDATE),
        
        folder: calendarName,
        tags,
        status,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_calendar',
        source_id: String(row.Z_PK),
        source_url: `ical://event/${row.Z_PK}`
      });
    }
    stmt.free();
    
    return cards;
  }
}
```

---

## 4. Apple Contacts

### 4.1 Source Schema

```sql
-- Key tables in AddressBook SQLite database
-- Table: ZABCDRECORD (contacts)
-- Table: ZABCDEMAILADDRESS (emails)
-- Table: ZABCDPHONENUMBER (phones)
-- Table: ZABCDPOSTALADDRESS (addresses)
-- Table: ZABCDNOTE (notes)

-- ZABCDRECORD columns of interest:
Z_PK                    -- Primary key
ZFIRSTNAME              -- First name
ZLASTNAME               -- Last name
ZORGANIZATION           -- Company name
ZJOBTITLE               -- Job title
ZBIRTHDAY               -- Birthday (Core Data timestamp)
ZCREATIONDATE           -- Creation timestamp
ZMODIFICATIONDATE       -- Modified timestamp
ZIMAGESTODISPLAY        -- Has image flag
ZKIND                   -- 0=person, 1=organization

-- ZABCDEMAILADDRESS columns:
Z_PK
ZOWNER                  -- FK to ZABCDRECORD
ZADDRESS                -- Email address
ZLABEL                  -- Label (work, home, etc.)

-- ZABCDPHONENUMBER columns:
Z_PK
ZOWNER                  -- FK to ZABCDRECORD
ZFULLNUMBER             -- Phone number
ZLABEL                  -- Label
```

### 4.2 Parser Implementation

```typescript
// src/etl/parsers/AppleContactsParser.ts

import { Database } from 'sql.js';

const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

function coreDataToISO(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const ms = (timestamp + CORE_DATA_EPOCH) * 1000;
  return new Date(ms).toISOString();
}

interface ContactDetails {
  emails: Array<{ label: string; value: string }>;
  phones: Array<{ label: string; value: string }>;
  addresses: Array<{ label: string; value: string }>;
}

export class AppleContactsParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Get contact details (emails, phones)
      const emailsByOwner = this.parseEmails(db);
      const phonesByOwner = this.parsePhones(db);
      const addressesByOwner = this.parseAddresses(db);
      const notesByOwner = this.parseNotes(db);
      
      // Get contacts
      const contacts = this.parseContacts(
        db, 
        emailsByOwner, 
        phonesByOwner, 
        addressesByOwner,
        notesByOwner
      );
      cards.push(...contacts);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseEmails(db: Database): Map<number, Array<{ label: string; value: string }>> {
    const emails = new Map<number, Array<{ label: string; value: string }>>();
    
    const stmt = db.prepare(`
      SELECT ZOWNER, ZADDRESS, ZLABEL 
      FROM ZABCDEMAILADDRESS 
      WHERE ZADDRESS IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { ZOWNER: number; ZADDRESS: string; ZLABEL: string | null };
      const list = emails.get(row.ZOWNER) || [];
      list.push({ label: this.normalizeLabel(row.ZLABEL), value: row.ZADDRESS });
      emails.set(row.ZOWNER, list);
    }
    stmt.free();
    
    return emails;
  }
  
  private parsePhones(db: Database): Map<number, Array<{ label: string; value: string }>> {
    const phones = new Map<number, Array<{ label: string; value: string }>>();
    
    const stmt = db.prepare(`
      SELECT ZOWNER, ZFULLNUMBER, ZLABEL 
      FROM ZABCDPHONENUMBER 
      WHERE ZFULLNUMBER IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { ZOWNER: number; ZFULLNUMBER: string; ZLABEL: string | null };
      const list = phones.get(row.ZOWNER) || [];
      list.push({ label: this.normalizeLabel(row.ZLABEL), value: row.ZFULLNUMBER });
      phones.set(row.ZOWNER, list);
    }
    stmt.free();
    
    return phones;
  }
  
  private parseAddresses(db: Database): Map<number, Array<{ label: string; value: string }>> {
    const addresses = new Map<number, Array<{ label: string; value: string }>>();
    
    // Note: ZABCDPOSTALADDRESS has multiple columns for street, city, etc.
    // We'll concatenate them into a single string
    const stmt = db.prepare(`
      SELECT 
        ZOWNER, 
        ZLABEL,
        COALESCE(ZSTREET, '') || 
        CASE WHEN ZCITY IS NOT NULL THEN ', ' || ZCITY ELSE '' END ||
        CASE WHEN ZSTATE IS NOT NULL THEN ', ' || ZSTATE ELSE '' END ||
        CASE WHEN ZPOSTALCODE IS NOT NULL THEN ' ' || ZPOSTALCODE ELSE '' END ||
        CASE WHEN ZCOUNTRYNAME IS NOT NULL THEN ', ' || ZCOUNTRYNAME ELSE '' END
        AS full_address
      FROM ZABCDPOSTALADDRESS 
      WHERE ZSTREET IS NOT NULL OR ZCITY IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { ZOWNER: number; ZLABEL: string | null; full_address: string };
      if (row.full_address.trim()) {
        const list = addresses.get(row.ZOWNER) || [];
        list.push({ label: this.normalizeLabel(row.ZLABEL), value: row.full_address.trim() });
        addresses.set(row.ZOWNER, list);
      }
    }
    stmt.free();
    
    return addresses;
  }
  
  private parseNotes(db: Database): Map<number, string> {
    const notes = new Map<number, string>();
    
    const stmt = db.prepare(`
      SELECT ZCONTACT, ZTEXT FROM ZABCDNOTE WHERE ZTEXT IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { ZCONTACT: number; ZTEXT: string };
      notes.set(row.ZCONTACT, row.ZTEXT);
    }
    stmt.free();
    
    return notes;
  }
  
  private parseContacts(
    db: Database,
    emails: Map<number, Array<{ label: string; value: string }>>,
    phones: Map<number, Array<{ label: string; value: string }>>,
    addresses: Map<number, Array<{ label: string; value: string }>>,
    notes: Map<number, string>
  ): CanonicalCard[] {
    const cards: CanonicalCard[] = [];
    
    const stmt = db.prepare(`
      SELECT 
        Z_PK,
        ZFIRSTNAME,
        ZLASTNAME,
        ZORGANIZATION,
        ZJOBTITLE,
        ZBIRTHDAY,
        ZCREATIONDATE,
        ZMODIFICATIONDATE,
        ZKIND
      FROM ZABCDRECORD
      WHERE ZFIRSTNAME IS NOT NULL OR ZLASTNAME IS NOT NULL OR ZORGANIZATION IS NOT NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        Z_PK: number;
        ZFIRSTNAME: string | null;
        ZLASTNAME: string | null;
        ZORGANIZATION: string | null;
        ZJOBTITLE: string | null;
        ZBIRTHDAY: number | null;
        ZCREATIONDATE: number;
        ZMODIFICATIONDATE: number;
        ZKIND: number;
      };
      
      // Build display name
      const nameParts = [row.ZFIRSTNAME, row.ZLASTNAME].filter(Boolean);
      const displayName = nameParts.length > 0 
        ? nameParts.join(' ')
        : row.ZORGANIZATION || 'Unknown Contact';
      
      // Build content as structured JSON
      const contactEmails = emails.get(row.Z_PK) || [];
      const contactPhones = phones.get(row.Z_PK) || [];
      const contactAddresses = addresses.get(row.Z_PK) || [];
      const contactNote = notes.get(row.Z_PK);
      
      const content: Record<string, any> = {};
      if (row.ZORGANIZATION) content.organization = row.ZORGANIZATION;
      if (row.ZJOBTITLE) content.jobTitle = row.ZJOBTITLE;
      if (contactEmails.length) content.emails = contactEmails;
      if (contactPhones.length) content.phones = contactPhones;
      if (contactAddresses.length) content.addresses = contactAddresses;
      if (contactNote) content.notes = contactNote;
      if (row.ZBIRTHDAY) content.birthday = coreDataToISO(row.ZBIRTHDAY);
      
      // Build tags
      const tags: string[] = [];
      if (row.ZORGANIZATION) tags.push(row.ZORGANIZATION);
      
      // Build summary
      const summaryParts: string[] = [];
      if (row.ZJOBTITLE) summaryParts.push(row.ZJOBTITLE);
      if (row.ZORGANIZATION && nameParts.length > 0) summaryParts.push(`at ${row.ZORGANIZATION}`);
      if (contactEmails.length) summaryParts.push(contactEmails[0].value);
      
      cards.push({
        id: crypto.randomUUID(),
        card_type: 'person',
        name: displayName,
        content: JSON.stringify(content),
        summary: summaryParts.join(' • ') || null,
        
        latitude: null,
        longitude: null,
        location_name: contactAddresses[0]?.value || null,
        
        created_at: coreDataToISO(row.ZCREATIONDATE) || new Date().toISOString(),
        modified_at: coreDataToISO(row.ZMODIFICATIONDATE) || new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: row.ZKIND === 1 ? 'Organizations' : 'People',
        tags,
        status: null,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: row.ZKIND === 1,  // Organization = collective
        
        source: 'apple_contacts',
        source_id: String(row.Z_PK),
        source_url: `addressbook://${row.Z_PK}`
      });
    }
    stmt.free();
    
    return cards;
  }
  
  private normalizeLabel(label: string | null): string {
    if (!label) return 'other';
    // Apple stores labels like "_$!<Work>!$_" — extract the readable part
    const match = label.match(/<(.+)>/);
    return match ? match[1].toLowerCase() : label.toLowerCase();
  }
}
```

---

## 5. Worker Integration

### 5.1 Message Types

```typescript
// Add to WorkerBridge message types
type MessageType =
  // ... existing types ...
  | 'etl:importReminders'
  | 'etl:importCalendar'
  | 'etl:importContacts'
  | 'etl:importAppleApps';  // All three at once
```

### 5.2 Worker Handlers

```typescript
// src/worker/handlers/appleApps.ts

import { AppleRemindersParser } from '../parsers/AppleRemindersParser';
import { AppleCalendarParser } from '../parsers/AppleCalendarParser';
import { AppleContactsParser } from '../parsers/AppleContactsParser';

const parsers = {
  reminders: new AppleRemindersParser(),
  calendar: new AppleCalendarParser(),
  contacts: new AppleContactsParser()
};

export async function handleAppleImport(
  payload: { source: 'reminders' | 'calendar' | 'contacts'; data: ArrayBuffer },
  db: Database
): Promise<ImportResult> {
  const parser = parsers[payload.source];
  const { cards, connections } = parser.parse(payload.data);
  
  // Use existing dedup and writer
  const dedup = new DedupEngine(db);
  const writer = new SQLiteWriter(db);
  
  const dedupResult = await dedup.process(cards, connections);
  
  await writer.writeCards(dedupResult.toInsert);
  await writer.updateCards(dedupResult.toUpdate);
  await writer.writeConnections(dedupResult.connections);
  
  return {
    inserted: dedupResult.toInsert.length,
    updated: dedupResult.toUpdate.length,
    skipped: dedupResult.toSkip.length,
    connections: dedupResult.connections.length,
    errors: []
  };
}

export async function handleAppleImportAll(
  payload: { 
    reminders?: ArrayBuffer; 
    calendar?: ArrayBuffer; 
    contacts?: ArrayBuffer 
  },
  db: Database
): Promise<{
  reminders?: ImportResult;
  calendar?: ImportResult;
  contacts?: ImportResult;
}> {
  const results: Record<string, ImportResult> = {};
  
  if (payload.reminders) {
    results.reminders = await handleAppleImport(
      { source: 'reminders', data: payload.reminders }, 
      db
    );
  }
  
  if (payload.calendar) {
    results.calendar = await handleAppleImport(
      { source: 'calendar', data: payload.calendar }, 
      db
    );
  }
  
  if (payload.contacts) {
    results.contacts = await handleAppleImport(
      { source: 'contacts', data: payload.contacts }, 
      db
    );
  }
  
  return results;
}
```

### 5.3 WorkerBridge API

```typescript
// Add to WorkerBridge class

async importReminders(data: ArrayBuffer): Promise<ImportResult> {
  return this.send('etl:importReminders', { source: 'reminders', data });
}

async importCalendar(data: ArrayBuffer): Promise<ImportResult> {
  return this.send('etl:importCalendar', { source: 'calendar', data });
}

async importContacts(data: ArrayBuffer): Promise<ImportResult> {
  return this.send('etl:importContacts', { source: 'contacts', data });
}

async importAppleApps(sources: {
  reminders?: ArrayBuffer;
  calendar?: ArrayBuffer;
  contacts?: ArrayBuffer;
}): Promise<{
  reminders?: ImportResult;
  calendar?: ImportResult;
  contacts?: ImportResult;
}> {
  return this.send('etl:importAppleApps', sources);
}
```

---

## 6. Native Shell Integration

### 6.1 Swift: Import Coordinator

```swift
// Sources/Native/AppleImportCoordinator.swift

import Foundation
import WebKit

@MainActor
class AppleImportCoordinator {
    private let webView: WKWebView
    
    init(webView: WKWebView) {
        self.webView = webView
    }
    
    func importAllAppleData() async throws -> [String: Any] {
        var databases: [String: Data] = [:]
        
        // Read each database
        for source in AppleDataSource.allCases {
            do {
                let data = try source.readDatabase()
                databases[source.rawValue] = data
            } catch AppleDataError.accessDenied {
                // Log warning, continue with other sources
                print("Warning: Access denied for \(source.rawValue)")
            } catch {
                print("Error reading \(source.rawValue): \(error)")
            }
        }
        
        guard !databases.isEmpty else {
            throw AppleDataError.accessDenied(.reminders)
        }
        
        // Convert to base64 for JavaScript
        var payload: [String: String] = [:]
        for (key, data) in databases {
            payload[key] = data.base64EncodedString()
        }
        
        // Call JavaScript import function
        let js = """
            (async () => {
                const payload = {
                    \(payload.map { "\($0.key): Uint8Array.from(atob('\($0.value)'), c => c.charCodeAt(0)).buffer" }.joined(separator: ",\n"))
                };
                return await workerBridge.importAppleApps(payload);
            })()
        """
        
        let result = try await webView.evaluateJavaScript(js)
        return result as? [String: Any] ?? [:]
    }
    
    func importReminders() async throws -> [String: Any] {
        let data = try AppleDataSource.reminders.readDatabase()
        return try await importSingle(source: "reminders", data: data)
    }
    
    func importCalendar() async throws -> [String: Any] {
        let data = try AppleDataSource.calendar.readDatabase()
        return try await importSingle(source: "calendar", data: data)
    }
    
    func importContacts() async throws -> [String: Any] {
        let data = try AppleDataSource.contacts.readDatabase()
        return try await importSingle(source: "contacts", data: data)
    }
    
    private func importSingle(source: String, data: Data) async throws -> [String: Any] {
        let base64 = data.base64EncodedString()
        let js = """
            (async () => {
                const data = Uint8Array.from(atob('\(base64)'), c => c.charCodeAt(0)).buffer;
                return await workerBridge.import\(source.capitalized)(data);
            })()
        """
        
        let result = try await webView.evaluateJavaScript(js)
        return result as? [String: Any] ?? [:]
    }
}
```

### 6.2 SwiftUI: Import UI

```swift
// Sources/Views/ImportView.swift

import SwiftUI

struct ImportView: View {
    @State private var isImporting = false
    @State private var results: [String: ImportResult] = [:]
    @State private var error: String?
    
    let coordinator: AppleImportCoordinator
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Import Apple Data")
                .font(.title)
            
            if isImporting {
                ProgressView("Importing...")
            } else {
                VStack(spacing: 12) {
                    ImportButton(title: "Import All", icon: "square.and.arrow.down.on.square") {
                        await importAll()
                    }
                    
                    Divider()
                    
                    ImportButton(title: "Reminders", icon: "checklist") {
                        await importReminders()
                    }
                    
                    ImportButton(title: "Calendar", icon: "calendar") {
                        await importCalendar()
                    }
                    
                    ImportButton(title: "Contacts", icon: "person.crop.circle") {
                        await importContacts()
                    }
                }
            }
            
            if !results.isEmpty {
                ImportResultsView(results: results)
            }
            
            if let error {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
        .padding()
    }
    
    private func importAll() async {
        isImporting = true
        error = nil
        
        do {
            let rawResults = try await coordinator.importAllAppleData()
            // Parse results...
        } catch {
            self.error = error.localizedDescription
        }
        
        isImporting = false
    }
    
    private func importReminders() async {
        isImporting = true
        do {
            _ = try await coordinator.importReminders()
        } catch {
            self.error = error.localizedDescription
        }
        isImporting = false
    }
    
    private func importCalendar() async {
        isImporting = true
        do {
            _ = try await coordinator.importCalendar()
        } catch {
            self.error = error.localizedDescription
        }
        isImporting = false
    }
    
    private func importContacts() async {
        isImporting = true
        do {
            _ = try await coordinator.importContacts()
        } catch {
            self.error = error.localizedDescription
        }
        isImporting = false
    }
}
```

---

## 7. Deduplication Strategy

### 7.1 Source ID Mapping

| Source | source_id Format | Example |
|--------|------------------|---------|
| Apple Reminders | `{Z_PK}` | `42` |
| Apple Calendar | `{Z_PK}` | `1337` |
| Apple Contacts | `{Z_PK}` | `99` |

### 7.2 Cross-Source Connections

When importing all three sources, we can establish connections:

```typescript
// After parsing all sources, find connections

function findCrossSourceConnections(
  cards: CanonicalCard[]
): CanonicalConnection[] {
  const connections: CanonicalConnection[] = [];
  
  // Index contacts by email/phone for matching
  const contactsByEmail = new Map<string, CanonicalCard>();
  const contactsByPhone = new Map<string, CanonicalCard>();
  
  for (const card of cards) {
    if (card.card_type === 'person' && card.content) {
      const content = JSON.parse(card.content);
      for (const email of content.emails || []) {
        contactsByEmail.set(email.value.toLowerCase(), card);
      }
      for (const phone of content.phones || []) {
        contactsByPhone.set(normalizePhone(phone.value), card);
      }
    }
  }
  
  // Match calendar event attendees to contacts
  // (Would require parsing attendee data from calendar)
  
  // Match reminder assignees to contacts
  // (Reminders don't typically have assignees in personal use)
  
  return connections;
}
```

---

## 8. Testing

```typescript
describe('AppleRemindersParser', () => {
  it('parses reminders with due dates', async () => {
    const mockDb = createMockRemindersDb([
      { Z_PK: 1, ZTITLE: 'Buy groceries', ZDUEDATE: 694224000, ZCOMPLETED: 0 }
    ]);
    
    const parser = new AppleRemindersParser();
    const { cards } = parser.parse(mockDb);
    
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Buy groceries');
    expect(cards[0].card_type).toBe('event');
    expect(cards[0].due_at).toBeTruthy();
    expect(cards[0].status).toBe('todo');
  });
  
  it('marks completed reminders', async () => {
    const mockDb = createMockRemindersDb([
      { Z_PK: 1, ZTITLE: 'Done task', ZCOMPLETED: 1, ZCOMPLETIONDATE: 694224000 }
    ]);
    
    const parser = new AppleRemindersParser();
    const { cards } = parser.parse(mockDb);
    
    expect(cards[0].status).toBe('done');
    expect(cards[0].completed_at).toBeTruthy();
  });
});

describe('AppleCalendarParser', () => {
  it('parses events with start and end times', async () => {
    const mockDb = createMockCalendarDb([
      { 
        Z_PK: 1, 
        ZTITLE: 'Team Meeting', 
        ZSTARTDATE: 694224000,
        ZENDDATE: 694227600,
        ZLOCATION: 'Conference Room A'
      }
    ]);
    
    const parser = new AppleCalendarParser();
    const { cards } = parser.parse(mockDb);
    
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Team Meeting');
    expect(cards[0].event_start).toBeTruthy();
    expect(cards[0].event_end).toBeTruthy();
    expect(cards[0].location_name).toBe('Conference Room A');
  });
});

describe('AppleContactsParser', () => {
  it('parses contacts with emails and phones', async () => {
    const mockDb = createMockContactsDb({
      contacts: [{ Z_PK: 1, ZFIRSTNAME: 'John', ZLASTNAME: 'Doe' }],
      emails: [{ ZOWNER: 1, ZADDRESS: 'john@example.com', ZLABEL: '_$!<Work>!$_' }],
      phones: [{ ZOWNER: 1, ZFULLNUMBER: '+1-555-1234', ZLABEL: '_$!<Mobile>!$_' }]
    });
    
    const parser = new AppleContactsParser();
    const { cards } = parser.parse(mockDb);
    
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('John Doe');
    expect(cards[0].card_type).toBe('person');
    
    const content = JSON.parse(cards[0].content!);
    expect(content.emails[0].value).toBe('john@example.com');
    expect(content.phones[0].value).toBe('+1-555-1234');
  });
  
  it('identifies organizations as collective', async () => {
    const mockDb = createMockContactsDb({
      contacts: [{ Z_PK: 1, ZORGANIZATION: 'Acme Corp', ZKIND: 1 }],
      emails: [],
      phones: []
    });
    
    const parser = new AppleContactsParser();
    const { cards } = parser.parse(mockDb);
    
    expect(cards[0].is_collective).toBe(true);
    expect(cards[0].folder).toBe('Organizations');
  });
});
```

---

## 9. Summary

| App | Card Type | Key Fields | Source ID |
|-----|-----------|------------|-----------|
| **Reminders** | Event | due_at, completed_at, status, priority | `apple_reminders:{Z_PK}` |
| **Calendar** | Event | event_start, event_end, location_name | `apple_calendar:{Z_PK}` |
| **Contacts** | Person | name, content (JSON), is_collective | `apple_contacts:{Z_PK}` |

### Key Implementation Notes

1. **Core Data Timestamps** — Apple uses seconds since 2001-01-01, not Unix epoch
2. **Sandbox Access** — Requires Full Disk Access or specific entitlements
3. **Label Normalization** — Apple stores labels as `_$!<Work>!$_` format
4. **Contact Details** — Stored as JSON in `content` field for schema-on-read
5. **Deduplication** — Uses `source` + `source_id` for idempotent imports
