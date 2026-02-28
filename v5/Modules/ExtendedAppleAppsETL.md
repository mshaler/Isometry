# Isometry v5 Extended Apple Apps ETL Specification

## Overview

This specification covers secondary Apple first-party apps: **Mail**, **Messages**, **Safari**, **Photos**, and **Freeform**. These sources have varying complexity, access requirements, and value for knowledge work.

**Priority Matrix:**

| App | Complexity | Access | Card Types | Priority |
|-----|------------|--------|------------|----------|
| Mail | HIGH | Full Disk Access | Note, Person | MEDIUM |
| Messages | HIGH | Full Disk Access + Encryption | Note, Person | MEDIUM |
| Safari | LOW | Safari entitlement | Resource | LOW |
| Photos | MEDIUM | Photos entitlement | Resource, Person | LOW |
| Freeform | MEDIUM | Full Disk Access | Note | LOW |

---

## 1. Apple Mail

### 1.1 Database Locations

```
Envelope Index (metadata):
~/Library/Mail/V10/MailData/Envelope Index

Message Content (.emlx files):
~/Library/Mail/V10/[AccountUUID]/[Mailbox].mbox/[UUID].partial.emlx

Attachments:
~/Library/Mail/V10/[AccountUUID]/[Mailbox].mbox/Attachments/
```

### 1.2 Source Schema

```sql
-- Envelope Index tables
-- Table: messages
ROWID                   -- Primary key
mailbox                 -- FK to mailboxes
sender                  -- FK to addresses  
subject                 -- Email subject
date_received           -- Unix timestamp
date_sent               -- Unix timestamp
flags                   -- Bitmask (read=1, deleted=2, answered=4, flagged=8)
read                    -- 0 or 1
flagged                 -- 0 or 1
deleted                 -- 0 or 1
size                    -- Message size in bytes
snippet                 -- Preview text
thread_id               -- Thread grouping

-- Table: addresses
ROWID                   -- Primary key
address                 -- Email address
comment                 -- Display name

-- Table: mailboxes
ROWID                   -- Primary key
url                     -- Mailbox path (e.g., "imap://account/INBOX")
total_count             -- Message count

-- Table: recipients (message recipients)
message_id              -- FK to messages
address_id              -- FK to addresses
type                    -- 0=from, 1=to, 2=cc, 3=bcc
```

### 1.3 Parser Implementation

```typescript
// src/etl/parsers/AppleMailParser.ts

export class AppleMailParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Parse addresses → Person cards (deduplicated)
      const addressMap = this.parseAddresses(db);
      cards.push(...addressMap.values());
      
      // Parse mailboxes for folder mapping
      const mailboxes = this.parseMailboxes(db);
      
      // Parse messages → Note cards
      const messages = this.parseMessages(db, mailboxes, addressMap);
      cards.push(...messages.cards);
      connections.push(...messages.connections);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseAddresses(db: Database): Map<number, CanonicalCard> {
    const addresses = new Map<number, CanonicalCard>();
    const seenEmails = new Map<string, number>();  // Dedupe by email
    
    const stmt = db.prepare(`
      SELECT ROWID, address, comment 
      FROM addresses 
      WHERE address IS NOT NULL AND address != ''
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        ROWID: number;
        address: string;
        comment: string | null;
      };
      
      const emailLower = row.address.toLowerCase();
      
      // Skip if we've already seen this email
      if (seenEmails.has(emailLower)) {
        // Map this ROWID to the existing card
        const existingRowId = seenEmails.get(emailLower)!;
        addresses.set(row.ROWID, addresses.get(existingRowId)!);
        continue;
      }
      
      seenEmails.set(emailLower, row.ROWID);
      
      // Extract name from comment or email
      const name = row.comment?.trim() || row.address.split('@')[0];
      
      const card: CanonicalCard = {
        id: crypto.randomUUID(),
        card_type: 'person',
        name,
        content: JSON.stringify({ 
          emails: [{ label: 'email', value: row.address }] 
        }),
        summary: row.address,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: 'Mail/Contacts',
        tags: ['mail'],
        status: null,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_mail',
        source_id: `address:${row.ROWID}`,
        source_url: null
      };
      
      addresses.set(row.ROWID, card);
    }
    stmt.free();
    
    return addresses;
  }
  
  private parseMailboxes(db: Database): Map<number, string> {
    const mailboxes = new Map<number, string>();
    
    const stmt = db.prepare(`SELECT ROWID, url FROM mailboxes WHERE url IS NOT NULL`);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { ROWID: number; url: string };
      
      // Extract mailbox name from URL
      // e.g., "imap://user@imap.gmail.com/INBOX" → "INBOX"
      // e.g., "imap://user@imap.gmail.com/[Gmail]/Sent Mail" → "Sent Mail"
      const parts = row.url.split('/');
      const name = decodeURIComponent(parts[parts.length - 1] || 'Unknown');
      
      mailboxes.set(row.ROWID, name);
    }
    stmt.free();
    
    return mailboxes;
  }
  
  private parseMessages(
    db: Database,
    mailboxes: Map<number, string>,
    addresses: Map<number, CanonicalCard>
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    const stmt = db.prepare(`
      SELECT 
        m.ROWID,
        m.mailbox,
        m.sender,
        m.subject,
        m.snippet,
        m.date_received,
        m.date_sent,
        m.read,
        m.flagged,
        m.size,
        m.thread_id
      FROM messages m
      WHERE m.deleted = 0
        AND m.subject IS NOT NULL
      ORDER BY m.date_received DESC
      LIMIT 10000
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        ROWID: number;
        mailbox: number;
        sender: number;
        subject: string;
        snippet: string | null;
        date_received: number;
        date_sent: number;
        read: number;
        flagged: number;
        size: number;
        thread_id: number;
      };
      
      const mailboxName = mailboxes.get(row.mailbox) || 'Mail';
      const senderCard = addresses.get(row.sender);
      
      const tags: string[] = ['mail'];
      if (!row.read) tags.push('unread');
      if (row.flagged) tags.push('flagged');
      
      const messageId = crypto.randomUUID();
      const sent = new Date(row.date_sent * 1000).toISOString();
      const received = new Date(row.date_received * 1000).toISOString();
      
      cards.push({
        id: messageId,
        card_type: 'note',
        name: row.subject,
        content: row.snippet,  // Full content requires .emlx parsing
        summary: senderCard ? `From: ${senderCard.name}` : null,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: sent,
        modified_at: received,
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: `Mail/${mailboxName}`,
        tags,
        status: row.read ? 'read' : 'unread',
        
        priority: row.flagged ? 4 : 0,
        sort_order: 0,
        
        url: null,
        mime_type: 'message/rfc822',
        is_collective: false,
        
        source: 'apple_mail',
        source_id: String(row.ROWID),
        source_url: `message://${row.ROWID}`
      });
      
      // Connect message to sender
      if (senderCard) {
        connections.push({
          id: crypto.randomUUID(),
          source_id: senderCard.id,
          target_id: messageId,
          via_card_id: null,
          label: 'sent',
          weight: 1.0
        });
      }
    }
    stmt.free();
    
    // Parse recipients for additional connections
    this.parseRecipients(db, cards, addresses, connections);
    
    return { cards, connections };
  }
  
  private parseRecipients(
    db: Database,
    messageCards: CanonicalCard[],
    addresses: Map<number, CanonicalCard>,
    connections: CanonicalConnection[]
  ): void {
    // Build message ROWID → card.id lookup
    const messageIdMap = new Map<number, string>();
    for (const card of messageCards) {
      const rowId = parseInt(card.source_id!, 10);
      if (!isNaN(rowId)) {
        messageIdMap.set(rowId, card.id);
      }
    }
    
    const stmt = db.prepare(`
      SELECT message_id, address_id, type
      FROM recipients
      WHERE type IN (1, 2)  -- to, cc
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        message_id: number;
        address_id: number;
        type: number;
      };
      
      const messageCardId = messageIdMap.get(row.message_id);
      const recipientCard = addresses.get(row.address_id);
      
      if (messageCardId && recipientCard) {
        connections.push({
          id: crypto.randomUUID(),
          source_id: messageCardId,
          target_id: recipientCard.id,
          via_card_id: null,
          label: row.type === 1 ? 'to' : 'cc',
          weight: row.type === 1 ? 1.0 : 0.5
        });
      }
    }
    stmt.free();
  }
}
```

---

## 2. Apple Messages

### 2.1 Database Location

```
~/Library/Messages/chat.db
```

**⚠️ Important:** On macOS Ventura+, Messages database may be encrypted. Full Disk Access is required, and some content may still be inaccessible.

### 2.2 Source Schema

```sql
-- chat.db tables
-- Table: message
ROWID                   -- Primary key
guid                    -- Unique message ID
text                    -- Message text (may be NULL for attachments)
handle_id               -- FK to handle (sender/recipient)
date                    -- Nanoseconds since 2001-01-01
date_read               -- Read timestamp
is_from_me              -- 0 or 1
is_read                 -- 0 or 1
service                 -- 'iMessage' or 'SMS'
cache_has_attachments   -- 0 or 1
associated_message_guid -- For reactions/replies

-- Table: handle
ROWID                   -- Primary key
id                      -- Phone number or email
service                 -- 'iMessage' or 'SMS'
uncanonicalized_id      -- Original format

-- Table: chat
ROWID                   -- Primary key
guid                    -- Chat GUID
chat_identifier         -- Phone/email or group ID
display_name            -- Group name (if group chat)
group_id                -- Group identifier

-- Table: chat_message_join
chat_id                 -- FK to chat
message_id              -- FK to message

-- Table: chat_handle_join
chat_id                 -- FK to chat
handle_id               -- FK to handle
```

### 2.3 Parser Implementation

```typescript
// src/etl/parsers/AppleMessagesParser.ts

// Messages timestamp: nanoseconds since 2001-01-01
const MESSAGES_EPOCH_MS = Date.UTC(2001, 0, 1);
const NANO_TO_MS = 1_000_000;

function messagesTimestampToISO(timestamp: number | null): string | null {
  if (!timestamp || timestamp === 0) return null;
  
  // Handle both formats:
  // - Old: seconds since 2001
  // - New: nanoseconds since 2001
  const isNanoseconds = timestamp > 1_000_000_000_000;
  const ms = isNanoseconds 
    ? Math.floor(timestamp / NANO_TO_MS) + MESSAGES_EPOCH_MS
    : timestamp * 1000 + MESSAGES_EPOCH_MS;
  
  return new Date(ms).toISOString();
}

export class AppleMessagesParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Parse handles → Person cards
      const handleMap = this.parseHandles(db);
      cards.push(...handleMap.values());
      
      // Parse chats for grouping
      const chats = this.parseChats(db);
      
      // Build chat → handles mapping for group chats
      const chatHandles = this.parseChatHandles(db, handleMap);
      
      // Parse messages → Note cards
      const messages = this.parseMessages(db, handleMap, chats, chatHandles);
      cards.push(...messages.cards);
      connections.push(...messages.connections);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseHandles(db: Database): Map<number, CanonicalCard> {
    const handles = new Map<number, CanonicalCard>();
    const seenIds = new Map<string, number>();  // Dedupe by id
    
    const stmt = db.prepare(`
      SELECT ROWID, id, service, uncanonicalized_id
      FROM handle
      WHERE id IS NOT NULL AND id != ''
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        ROWID: number;
        id: string;
        service: string;
        uncanonicalized_id: string | null;
      };
      
      const idLower = row.id.toLowerCase();
      
      if (seenIds.has(idLower)) {
        handles.set(row.ROWID, handles.get(seenIds.get(idLower)!)!);
        continue;
      }
      
      seenIds.set(idLower, row.ROWID);
      
      const isEmail = row.id.includes('@');
      const displayId = row.uncanonicalized_id || row.id;
      
      // Format phone numbers nicely
      const name = isEmail ? displayId : this.formatPhoneNumber(displayId);
      
      const content: Record<string, any> = { service: row.service };
      if (isEmail) {
        content.emails = [{ label: 'imessage', value: row.id }];
      } else {
        content.phones = [{ label: row.service.toLowerCase(), value: displayId }];
      }
      
      const card: CanonicalCard = {
        id: crypto.randomUUID(),
        card_type: 'person',
        name,
        content: JSON.stringify(content),
        summary: `${row.service}: ${displayId}`,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder: 'Messages/Contacts',
        tags: [row.service.toLowerCase()],
        status: null,
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: null,
        is_collective: false,
        
        source: 'apple_messages',
        source_id: `handle:${row.ROWID}`,
        source_url: null
      };
      
      handles.set(row.ROWID, card);
    }
    stmt.free();
    
    return handles;
  }
  
  private parseChats(db: Database): Map<number, { 
    name: string; 
    identifier: string; 
    isGroup: boolean 
  }> {
    const chats = new Map();
    
    const stmt = db.prepare(`
      SELECT ROWID, chat_identifier, display_name, group_id
      FROM chat
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        ROWID: number;
        chat_identifier: string;
        display_name: string | null;
        group_id: string | null;
      };
      
      const isGroup = row.chat_identifier.startsWith('chat') || row.group_id != null;
      const name = row.display_name || row.chat_identifier;
      
      chats.set(row.ROWID, { 
        name, 
        identifier: row.chat_identifier,
        isGroup 
      });
    }
    stmt.free();
    
    return chats;
  }
  
  private parseChatHandles(
    db: Database,
    handles: Map<number, CanonicalCard>
  ): Map<number, CanonicalCard[]> {
    const chatHandles = new Map<number, CanonicalCard[]>();
    
    const stmt = db.prepare(`SELECT chat_id, handle_id FROM chat_handle_join`);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { chat_id: number; handle_id: number };
      const handle = handles.get(row.handle_id);
      
      if (handle) {
        const existing = chatHandles.get(row.chat_id) || [];
        existing.push(handle);
        chatHandles.set(row.chat_id, existing);
      }
    }
    stmt.free();
    
    return chatHandles;
  }
  
  private parseMessages(
    db: Database,
    handles: Map<number, CanonicalCard>,
    chats: Map<number, { name: string; identifier: string; isGroup: boolean }>,
    chatHandles: Map<number, CanonicalCard[]>
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    const stmt = db.prepare(`
      SELECT 
        m.ROWID,
        m.guid,
        m.text,
        m.handle_id,
        m.date,
        m.is_from_me,
        m.is_read,
        m.service,
        cmj.chat_id
      FROM message m
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE m.text IS NOT NULL AND m.text != ''
      ORDER BY m.date DESC
      LIMIT 10000
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        ROWID: number;
        guid: string;
        text: string;
        handle_id: number;
        date: number;
        is_from_me: number;
        is_read: number;
        service: string;
        chat_id: number | null;
      };
      
      const handleCard = handles.get(row.handle_id);
      const chat = row.chat_id ? chats.get(row.chat_id) : null;
      
      const tags: string[] = [row.service.toLowerCase()];
      if (row.is_from_me) tags.push('sent');
      else tags.push('received');
      if (chat?.isGroup) tags.push('group');
      
      // Build folder path
      let folder: string;
      if (chat?.isGroup) {
        folder = `Messages/Groups/${chat.name}`;
      } else if (handleCard) {
        folder = `Messages/${handleCard.name}`;
      } else {
        folder = 'Messages/Unknown';
      }
      
      const timestamp = messagesTimestampToISO(row.date) || new Date().toISOString();
      const messageId = crypto.randomUUID();
      
      // Truncate for title
      const title = row.text.length > 100 
        ? row.text.slice(0, 97) + '...'
        : row.text;
      
      cards.push({
        id: messageId,
        card_type: 'note',
        name: title.replace(/\n/g, ' '),
        content: row.text,
        summary: row.is_from_me
          ? `To: ${handleCard?.name || 'Unknown'}`
          : `From: ${handleCard?.name || 'Unknown'}`,
        
        latitude: null,
        longitude: null,
        location_name: null,
        
        created_at: timestamp,
        modified_at: timestamp,
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        
        folder,
        tags,
        status: row.is_read ? 'read' : 'unread',
        
        priority: 0,
        sort_order: 0,
        
        url: null,
        mime_type: 'text/plain',
        is_collective: false,
        
        source: 'apple_messages',
        source_id: row.guid,
        source_url: `imessage://${row.guid}`
      });
      
      // Connect message to person
      if (handleCard) {
        connections.push({
          id: crypto.randomUUID(),
          source_id: row.is_from_me ? messageId : handleCard.id,
          target_id: row.is_from_me ? handleCard.id : messageId,
          via_card_id: null,
          label: row.is_from_me ? 'sent_to' : 'received_from',
          weight: 1.0
        });
      }
    }
    stmt.free();
    
    return { cards, connections };
  }
  
  private formatPhoneNumber(phone: string): string {
    // Simple US phone formatting
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }
}
```

---

## 3. Safari

### 3.1 Database Locations

```
History:
~/Library/Safari/History.db

Bookmarks:
~/Library/Safari/Bookmarks.plist

Reading List:
~/Library/Safari/ReadingListArchives/
```

### 3.2 Parser Implementation

```typescript
// src/etl/parsers/SafariParser.ts

const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

export class SafariParser {
  
  parseHistory(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    const cards: CanonicalCard[] = [];
    
    try {
      // Get unique URLs with most recent visit
      const stmt = db.prepare(`
        SELECT 
          hi.id,
          hi.url,
          hi.domain_expansion,
          hi.visit_count,
          MAX(hv.visit_time) as last_visit,
          hv.title
        FROM history_items hi
        JOIN history_visits hv ON hv.history_item = hi.id
        WHERE hv.title IS NOT NULL AND hv.title != ''
        GROUP BY hi.url
        ORDER BY last_visit DESC
        LIMIT 5000
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          id: number;
          url: string;
          domain_expansion: string;
          visit_count: number;
          last_visit: number;
          title: string;
        };
        
        const timestamp = new Date((row.last_visit + CORE_DATA_EPOCH) * 1000).toISOString();
        
        cards.push({
          id: crypto.randomUUID(),
          card_type: 'resource',
          name: row.title,
          content: null,
          summary: `${row.domain_expansion} • ${row.visit_count} visits`,
          
          latitude: null,
          longitude: null,
          location_name: null,
          
          created_at: timestamp,
          modified_at: timestamp,
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          
          folder: `Safari/History/${row.domain_expansion}`,
          tags: ['history', 'safari'],
          status: null,
          
          priority: 0,
          sort_order: 0,
          
          url: row.url,
          mime_type: 'text/html',
          is_collective: false,
          
          source: 'safari_history',
          source_id: String(row.id),
          source_url: row.url
        });
      }
      stmt.free();
      
      return { cards, connections: [] };
    } finally {
      db.close();
    }
  }
  
  // Bookmarks would require plist parsing
  // Reading List would require reading archived HTML files
}
```

---

## 4. Apple Photos

### 4.1 Database Location

```
~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite
```

### 4.2 Parser Implementation

```typescript
// src/etl/parsers/ApplePhotosParser.ts

const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

export class ApplePhotosParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Parse identified people → Person cards
      const people = this.parsePeople(db);
      cards.push(...people.values());
      
      // Parse assets → Resource cards
      const assets = this.parseAssets(db);
      cards.push(...assets);
      
      // Parse face detections → connections
      const faceConnections = this.parseFaces(db, people, assets);
      connections.push(...faceConnections);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parsePeople(db: Database): Map<number, CanonicalCard> {
    const people = new Map<number, CanonicalCard>();
    
    try {
      const stmt = db.prepare(`
        SELECT Z_PK, ZDISPLAYNAME, ZFACECOUNT, ZVERIFIED
        FROM ZPERSON
        WHERE ZDISPLAYNAME IS NOT NULL AND ZDISPLAYNAME != ''
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          Z_PK: number;
          ZDISPLAYNAME: string;
          ZFACECOUNT: number;
          ZVERIFIED: number;
        };
        
        people.set(row.Z_PK, {
          id: crypto.randomUUID(),
          card_type: 'person',
          name: row.ZDISPLAYNAME,
          content: null,
          summary: `${row.ZFACECOUNT} photos${row.ZVERIFIED ? ' (verified)' : ''}`,
          
          latitude: null,
          longitude: null,
          location_name: null,
          
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          
          folder: 'Photos/People',
          tags: ['photos'],
          status: null,
          
          priority: 0,
          sort_order: 0,
          
          url: null,
          mime_type: null,
          is_collective: false,
          
          source: 'apple_photos',
          source_id: `person:${row.Z_PK}`,
          source_url: null
        });
      }
      stmt.free();
    } catch {
      // Table may not exist
    }
    
    return people;
  }
  
  private parseAssets(db: Database): CanonicalCard[] {
    const cards: CanonicalCard[] = [];
    
    try {
      const stmt = db.prepare(`
        SELECT 
          Z_PK,
          ZUUID,
          ZORIGINALFILENAME,
          ZDATECREATED,
          ZMODIFICATIONDATE,
          ZLATITUDE,
          ZLONGITUDE,
          ZKIND,
          ZFAVORITE,
          ZDURATION
        FROM ZASSET
        WHERE ZTRASHEDSTATE = 0
        ORDER BY ZDATECREATED DESC
        LIMIT 10000
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          Z_PK: number;
          ZUUID: string;
          ZORIGINALFILENAME: string;
          ZDATECREATED: number;
          ZMODIFICATIONDATE: number;
          ZLATITUDE: number | null;
          ZLONGITUDE: number | null;
          ZKIND: number;
          ZFAVORITE: number;
          ZDURATION: number | null;
        };
        
        const isVideo = row.ZKIND === 1;
        const mimeType = isVideo ? 'video/quicktime' : 'image/jpeg';
        
        const tags: string[] = ['photos'];
        if (isVideo) tags.push('video');
        else tags.push('photo');
        if (row.ZFAVORITE) tags.push('favorite');
        if (row.ZLATITUDE && row.ZLONGITUDE) tags.push('geotagged');
        
        const created = new Date((row.ZDATECREATED + CORE_DATA_EPOCH) * 1000).toISOString();
        const modified = new Date((row.ZMODIFICATIONDATE + CORE_DATA_EPOCH) * 1000).toISOString();
        
        let summary = isVideo ? 'Video' : 'Photo';
        if (row.ZDURATION) {
          const mins = Math.floor(row.ZDURATION / 60);
          const secs = Math.floor(row.ZDURATION % 60);
          summary = `Video • ${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        cards.push({
          id: crypto.randomUUID(),
          card_type: 'resource',
          name: row.ZORIGINALFILENAME || row.ZUUID,
          content: null,
          summary,
          
          latitude: row.ZLATITUDE,
          longitude: row.ZLONGITUDE,
          location_name: null,
          
          created_at: created,
          modified_at: modified,
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          
          folder: 'Photos/Library',
          tags,
          status: null,
          
          priority: row.ZFAVORITE ? 5 : 0,
          sort_order: 0,
          
          url: `photos://${row.ZUUID}`,
          mime_type: mimeType,
          is_collective: false,
          
          source: 'apple_photos',
          source_id: row.ZUUID,
          source_url: `photos://${row.ZUUID}`
        });
      }
      stmt.free();
    } catch {
      // Table may not exist
    }
    
    return cards;
  }
  
  private parseFaces(
    db: Database,
    people: Map<number, CanonicalCard>,
    assets: CanonicalCard[]
  ): CanonicalConnection[] {
    const connections: CanonicalConnection[] = [];
    
    // Build asset UUID → card.id lookup
    const assetMap = new Map<string, string>();
    for (const asset of assets) {
      assetMap.set(asset.source_id!, asset.id);
    }
    
    try {
      const stmt = db.prepare(`
        SELECT df.ZASSET, df.ZPERSON, a.ZUUID
        FROM ZDETECTEDFACE df
        JOIN ZASSET a ON a.Z_PK = df.ZASSET
        WHERE df.ZPERSON IS NOT NULL
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          ZASSET: number;
          ZPERSON: number;
          ZUUID: string;
        };
        
        const person = people.get(row.ZPERSON);
        const assetCardId = assetMap.get(row.ZUUID);
        
        if (person && assetCardId) {
          connections.push({
            id: crypto.randomUUID(),
            source_id: assetCardId,
            target_id: person.id,
            via_card_id: null,
            label: 'contains_face',
            weight: 1.0
          });
        }
      }
      stmt.free();
    } catch {
      // Table may not exist
    }
    
    return connections;
  }
}
```

---

## 5. Freeform

### 5.1 Database Location

```
~/Library/Containers/com.apple.freeform/Data/Library/Application Support/Freeform/
```

### 5.2 Parser Implementation

```typescript
// src/etl/parsers/FreeformParser.ts

const CORE_DATA_EPOCH = Date.UTC(2001, 0, 1) / 1000;

export class FreeformParser {
  
  parse(dbData: ArrayBuffer): {
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  } {
    const db = new SQL.Database(new Uint8Array(dbData));
    
    try {
      const cards: CanonicalCard[] = [];
      const connections: CanonicalConnection[] = [];
      
      // Parse boards
      const boards = this.parseBoards(db);
      cards.push(...boards.cards);
      
      // Parse text shapes
      const shapes = this.parseTextShapes(db, boards.boardMap);
      cards.push(...shapes.cards);
      connections.push(...shapes.connections);
      
      return { cards, connections };
    } finally {
      db.close();
    }
  }
  
  private parseBoards(db: Database): { 
    cards: CanonicalCard[]; 
    boardMap: Map<number, CanonicalCard> 
  } {
    const cards: CanonicalCard[] = [];
    const boardMap = new Map<number, CanonicalCard>();
    
    try {
      const stmt = db.prepare(`
        SELECT Z_PK, ZTITLE, ZCREATIONDATE, ZMODIFICATIONDATE
        FROM ZBOARD
        WHERE ZTITLE IS NOT NULL
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          Z_PK: number;
          ZTITLE: string;
          ZCREATIONDATE: number;
          ZMODIFICATIONDATE: number;
        };
        
        const created = new Date((row.ZCREATIONDATE + CORE_DATA_EPOCH) * 1000).toISOString();
        const modified = new Date((row.ZMODIFICATIONDATE + CORE_DATA_EPOCH) * 1000).toISOString();
        
        const card: CanonicalCard = {
          id: crypto.randomUUID(),
          card_type: 'note',
          name: row.ZTITLE,
          content: null,
          summary: 'Freeform Board',
          
          latitude: null,
          longitude: null,
          location_name: null,
          
          created_at: created,
          modified_at: modified,
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          
          folder: 'Freeform',
          tags: ['freeform', 'board'],
          status: null,
          
          priority: 0,
          sort_order: 0,
          
          url: `freeform://board/${row.Z_PK}`,
          mime_type: null,
          is_collective: false,
          
          source: 'apple_freeform',
          source_id: `board:${row.Z_PK}`,
          source_url: `freeform://board/${row.Z_PK}`
        };
        
        cards.push(card);
        boardMap.set(row.Z_PK, card);
      }
      stmt.free();
    } catch {
      // Table may not exist
    }
    
    return { cards, boardMap };
  }
  
  private parseTextShapes(
    db: Database,
    boardMap: Map<number, CanonicalCard>
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    try {
      const stmt = db.prepare(`
        SELECT Z_PK, ZBOARD, ZTEXT
        FROM ZSHAPE
        WHERE ZTEXT IS NOT NULL AND ZTEXT != ''
      `);
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          Z_PK: number;
          ZBOARD: number;
          ZTEXT: string;
        };
        
        const boardCard = boardMap.get(row.ZBOARD);
        const shapeId = crypto.randomUUID();
        
        cards.push({
          id: shapeId,
          card_type: 'note',
          name: row.ZTEXT.slice(0, 100).replace(/\n/g, ' '),
          content: row.ZTEXT,
          summary: boardCard ? `In: ${boardCard.name}` : null,
          
          latitude: null,
          longitude: null,
          location_name: null,
          
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          
          folder: 'Freeform',
          tags: ['freeform', 'shape'],
          status: null,
          
          priority: 0,
          sort_order: 0,
          
          url: null,
          mime_type: null,
          is_collective: false,
          
          source: 'apple_freeform',
          source_id: `shape:${row.Z_PK}`,
          source_url: null
        });
        
        // Connect to parent board
        if (boardCard) {
          connections.push({
            id: crypto.randomUUID(),
            source_id: boardCard.id,
            target_id: shapeId,
            via_card_id: null,
            label: 'contains',
            weight: 1.0
          });
        }
      }
      stmt.free();
    } catch {
      // Table may not exist
    }
    
    return { cards, connections };
  }
}
```

---

## 6. Worker Integration

### 6.1 Unified Handler

```typescript
// src/worker/handlers/appleAppsExtended.ts

import { AppleMailParser } from '../parsers/AppleMailParser';
import { AppleMessagesParser } from '../parsers/AppleMessagesParser';
import { SafariParser } from '../parsers/SafariParser';
import { ApplePhotosParser } from '../parsers/ApplePhotosParser';
import { FreeformParser } from '../parsers/FreeformParser';

const parsers = {
  mail: new AppleMailParser(),
  messages: new AppleMessagesParser(),
  safari: new SafariParser(),
  photos: new ApplePhotosParser(),
  freeform: new FreeformParser()
};

export async function handleExtendedAppleImport(
  payload: { 
    source: keyof typeof parsers; 
    data: ArrayBuffer 
  },
  db: Database
): Promise<ImportResult> {
  const parser = parsers[payload.source];
  
  let result;
  if (payload.source === 'safari') {
    result = (parser as SafariParser).parseHistory(payload.data);
  } else {
    result = parser.parse(payload.data);
  }
  
  const { cards, connections } = result;
  
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
```

---

## 7. Summary

| App | Source | Card Types | Connections |
|-----|--------|------------|-------------|
| **Mail** | Envelope Index | Note (messages), Person (addresses) | sent, to, cc |
| **Messages** | chat.db | Note (messages), Person (handles) | sent_to, received_from |
| **Safari** | History.db | Resource (pages) | — |
| **Photos** | Photos.sqlite | Resource (assets), Person (faces) | contains_face |
| **Freeform** | Freeform DB | Note (boards, shapes) | contains |

### Access Requirements

| App | Requirement |
|-----|-------------|
| Mail | Full Disk Access |
| Messages | Full Disk Access (may be encrypted) |
| Safari | Safari entitlement |
| Photos | Photos entitlement |
| Freeform | Full Disk Access |

### Key Implementation Notes

1. **Core Data Timestamps** — All Apple apps use seconds since 2001-01-01
2. **Messages Timestamps** — Newer versions use nanoseconds
3. **Deduplication** — Email addresses and phone numbers are deduplicated
4. **Encryption** — Messages database may be inaccessible on newer macOS
5. **Schema Variations** — Table names may vary between macOS versions
