#!/usr/bin/env node
// Generates all 9 ETL validation fixture files for Phase 47.
// Run: node tests/etl-validation/fixtures/generate-fixtures.mjs

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Shared constants for diversity
// ---------------------------------------------------------------------------

const FOLDERS = ['Work', 'Personal', 'Projects', 'Archive', 'Research', 'Finance', null];
const STATUSES = ['todo', 'in_progress', 'done', 'blocked', null];
const PRIORITIES = [0, 1, 2, 3, 4, 5];
const TAGS_POOL = [
  'project', 'important', 'review', 'meeting', 'design', 'code',
  'documentation', 'testing', 'research', 'planning', 'urgent',
  'followup', 'idea', 'reference', 'draft'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, min, max) {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function isoDate(baseYear, month, day, hour) {
  const y = baseYear || (Math.random() > 0.5 ? 2025 : 2026);
  const m = month || (1 + Math.floor(Math.random() * 12));
  const d = day || (1 + Math.floor(Math.random() * 28));
  const h = hour || Math.floor(Math.random() * 24);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`;
}

// ---------------------------------------------------------------------------
// 1. Apple Notes Snapshot (ParsedFile[])
// ---------------------------------------------------------------------------

function generateAppleNotes(count = 110) {
  const files = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(FOLDERS.filter(f => f !== null));
    const tags = pickN(TAGS_POOL, 0, 3);
    const created = isoDate();
    const modified = isoDate(2026);
    const noteId = 1000 + i;

    // Build attachments for hashtags
    const attachments = tags.map((tag, idx) => ({
      id: `att-${i}-${idx}`,
      type: 'com.apple.notes.inlinetextattachment.hashtag',
      content: `<a class="tag link" href="/tags/${tag}">#${tag}</a>`
    }));

    // Links to other notes (10+ notes have links)
    const links = [];
    if (i <= 15) {
      // First 15 notes link to other notes
      const targetId = String(1000 + ((i % count) + 1));
      links.push(targetId);
      if (i <= 5) {
        links.push(String(1000 + ((i + 5) % count) + 1));
      }
    }

    // Edge case names
    let name = `Note ${String(i).padStart(3, '0')}`;
    if (i === 1) name = 'A very long note title that exceeds one hundred characters in length to test edge cases with extremely verbose naming conventions and display truncation';
    if (i === 2) name = 'Special chars: & < > " \' @ # $ %';
    if (i === 3) name = 'Unicode test: cafe\u0301 \u00FC\u00F6\u00E4 \u2603 \u2764\uFE0F \u{1F680}';

    const frontmatter = [
      '---',
      `title: "${name.replace(/"/g, '\\"')}"`,
      `id: ${noteId}`,
      `created: ${created}`,
      `modified: ${modified}`,
      `folder: ${folder}`,
    ];

    if (attachments.length > 0) {
      frontmatter.push('attachments:');
      for (const att of attachments) {
        frontmatter.push(`  - id: ${att.id}`);
        frontmatter.push(`    type: ${att.type}`);
        frontmatter.push(`    content: '${att.content}'`);
      }
    }

    if (links.length > 0) {
      frontmatter.push('links:');
      for (const link of links) {
        frontmatter.push(`  - '${link}'`);
      }
    }

    frontmatter.push(`source: notes://showNote?identifier=${noteId}`);
    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(`# ${name}`);
    frontmatter.push('');
    frontmatter.push(`Content body for note ${i}. This is a paragraph with some text about ${folder} topics.`);

    files.push({
      path: `${folder}/Note-${String(i).padStart(3, '0')}.md`,
      content: frontmatter.join('\n')
    });
  }
  return files;
}

// ---------------------------------------------------------------------------
// 2. Markdown Snapshot (ParsedFile[])
// ---------------------------------------------------------------------------

function generateMarkdown(count = 110) {
  const files = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 1, 4);
    const status = pick(STATUSES);
    const priority = pick(PRIORITIES);
    const created = isoDate();
    const modified = isoDate(2026);
    const folder = pick(FOLDERS.filter(f => f !== null));

    let name = `Markdown Note ${String(i).padStart(3, '0')}`;
    if (i === 1) name = 'A very long markdown title that exceeds one hundred characters to test edge cases with extremely verbose naming conventions in Obsidian vault exports';
    if (i === 2) name = 'Chars: & < > " \'';
    if (i === 3) name = '\u00DCnicode: \u00E9\u00E8\u00EA \u00F1 \u00DF';

    const frontmatter = [
      '---',
      `title: "${name.replace(/"/g, '\\"')}"`,
      `tags: [${tags.join(', ')}]`,
      `created: ${created}`,
      `modified: ${modified}`,
    ];
    if (status) frontmatter.push(`status: ${status}`);
    frontmatter.push(`priority: ${priority}`);
    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(`# ${name}`);
    frontmatter.push('');
    frontmatter.push(`Content for markdown note ${i}. Tags: ${tags.join(', ')}.`);

    files.push({
      path: `vault/${folder}/note-${String(i).padStart(3, '0')}.md`,
      content: frontmatter.join('\n')
    });
  }
  return files;
}

// ---------------------------------------------------------------------------
// 3. CSV Snapshot (ParsedFile[] with single CSV content)
// ---------------------------------------------------------------------------

function generateCSV(count = 110) {
  const rows = ['\uFEFFtitle,content,tags,status,priority,due_date,folder'];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 3).join(';');
    const status = pick(STATUSES);
    const priority = pick(PRIORITIES);
    const dueDate = Math.random() > 0.3 ? isoDate().split('T')[0] : '';
    const folder = pick(FOLDERS.filter(f => f !== null));

    let title = `CSV Item ${String(i).padStart(3, '0')}`;
    if (i === 1) title = 'A very long CSV title that exceeds one hundred characters in length to test display truncation and edge case handling in the parser implementation';
    if (i === 2) title = 'Special: & < > "double quotes"';
    if (i === 3) title = '\u00DC\u00F6\u00E4 Unicode CSV \u00E9\u00E8';

    const content = `Content for row ${i} about ${folder} matters`;
    rows.push(`"${title}","${content}","${tags}","${status || ''}","${priority}","${dueDate}","${folder}"`);
  }

  return [{
    path: 'data.csv',
    content: rows.join('\n')
  }];
}

// ---------------------------------------------------------------------------
// 4. JSON Snapshot (JSON string of array)
// ---------------------------------------------------------------------------

function generateJSON(count = 110) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 4);
    const status = pick(STATUSES);
    const priority = pick(PRIORITIES);
    const dueDate = Math.random() > 0.3 ? isoDate() : null;
    const folder = pick(FOLDERS.filter(f => f !== null));

    let title = `JSON Entry ${String(i).padStart(3, '0')}`;
    if (i === 1) title = 'An extremely long JSON title that exceeds one hundred characters in length for testing edge case handling with verbose display names in the interface';
    if (i === 2) title = 'JSON special: & < > "quotes"';
    if (i === 3) title = '\u00DC\u00F6\u00E4 JSON Unicode \u00E9\u00E8';

    // Vary field names to exercise HEADER_SYNONYMS
    const item = {};
    if (i % 4 === 0) {
      item.name = title;
      item.description = `Body content for JSON item ${i}`;
    } else if (i % 4 === 1) {
      item.title = title;
      item.body = `Body content for JSON item ${i}`;
    } else if (i % 4 === 2) {
      item.subject = title;
      item.text = `Body content for JSON item ${i}`;
    } else {
      item.heading = title;
      item.notes = `Body content for JSON item ${i}`;
    }

    item.tags = tags;
    if (status) item.status = status;
    item.priority = priority;
    if (dueDate) item.date = dueDate;
    item.folder = folder;

    items.push(item);
  }
  return items;
}

// ---------------------------------------------------------------------------
// 5. Excel Rows (JSON row objects for generateExcelBuffer helper)
// ---------------------------------------------------------------------------

function generateExcelRows(count = 110) {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 3).join(';');
    const status = pick(STATUSES);
    const priority = pick(PRIORITIES);
    const folder = pick(FOLDERS.filter(f => f !== null));

    let title = `Excel Row ${String(i).padStart(3, '0')}`;
    if (i === 1) title = 'An extremely long Excel row title that exceeds one hundred characters in length for testing edge case handling with verbose display names';
    if (i === 2) title = 'Excel special: & < > "quotes"';
    if (i === 3) title = '\u00DC\u00F6\u00E4 Excel Unicode \u00E9\u00E8';

    rows.push({
      title: title,
      content: `Content for Excel row ${i} in ${folder}`,
      tags: tags,
      created: isoDate(),
      folder: folder,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 6. HTML Snapshot (string[])
// ---------------------------------------------------------------------------

function generateHTML(count = 110) {
  const pages = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(FOLDERS.filter(f => f !== null));

    let title = `HTML Page ${String(i).padStart(3, '0')}`;
    if (i === 1) title = 'An extremely long HTML page title that exceeds one hundred characters in length for testing edge case handling with verbose display names in the parser';
    if (i === 2) title = 'HTML special: &amp; &lt; &gt;';
    if (i === 3) title = '\u00DC\u00F6\u00E4 HTML Unicode \u00E9\u00E8';

    let body = `<h1>${title}</h1><p>Content paragraph for page ${i} about ${folder} topics.</p>`;

    // Add varied HTML elements
    if (i % 5 === 0) {
      body += '<table><tr><th>Column A</th><th>Column B</th></tr><tr><td>Data 1</td><td>Data 2</td></tr></table>';
    }
    if (i % 7 === 0) {
      body += '<ul><li>Item alpha</li><li>Item beta</li><li>Item gamma</li></ul>';
    }
    if (i % 3 === 0) {
      body += `<a href="https://example.com/page-${i}">Link to page ${i}</a>`;
    }

    const html = `<html><head><title>${title}</title><meta property="og:title" content="${title}"></head><body>${body}</body></html>`;
    pages.push(html);
  }
  return pages;
}

// ---------------------------------------------------------------------------
// 7. Native Reminders (CanonicalCard[])
// ---------------------------------------------------------------------------

function generateNativeReminders(count = 110) {
  const listNames = ['Groceries', 'Work', 'Personal', 'Home', 'Health', 'Errands'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(listNames);
    const tags = pickN(TAGS_POOL, 0, 3);
    const status = Math.random() > 0.3 ? 'incomplete' : 'complete';
    const priority = pick(PRIORITIES);
    const hasDueDate = Math.random() > 0.3;
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `Reminder ${String(i).padStart(3, '0')}`;
    if (i === 1) name = 'An extremely long reminder title that exceeds one hundred characters in length for testing edge case handling with verbose display names in the UI';
    if (i === 2) name = 'Special chars reminder: & < > "quotes"';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Unicode Reminder \u00E9\u00E8 \u{1F680}';

    cards.push({
      id: randomUUID(),
      card_type: 'task',
      name,
      content: `Details for reminder ${i}: ${folder} list item`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: created,
      modified_at: modified,
      due_at: hasDueDate ? isoDate(2026) : null,
      completed_at: status === 'complete' ? isoDate(2026) : null,
      event_start: null,
      event_end: null,
      folder,
      tags,
      status,
      priority,
      sort_order: i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'native_reminders',
      source_id: `rem-${String(i).padStart(4, '0')}`,
      source_url: null,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 8. Native Calendar (CanonicalCard[] - events + attendees)
// ---------------------------------------------------------------------------

function generateNativeCalendar(count = 110) {
  const calendarNames = ['Work', 'Personal', 'Family', 'Fitness', 'Travel', 'Meetings'];
  const cards = [];

  // 100 events
  const eventCount = count - 10;
  for (let i = 1; i <= eventCount; i++) {
    const folder = pick(calendarNames);
    const tags = pickN(TAGS_POOL, 0, 2);
    const eventDate = isoDate(2026);
    const startHour = 8 + Math.floor(Math.random() * 10);
    const endHour = startHour + 1 + Math.floor(Math.random() * 3);
    const created = isoDate(2025);
    const modified = isoDate(2026);

    // Build event_start and event_end from eventDate base
    const baseDate = eventDate.split('T')[0];
    const eventStart = `${baseDate}T${String(startHour).padStart(2, '0')}:00:00Z`;
    const eventEnd = `${baseDate}T${String(endHour).padStart(2, '0')}:00:00Z`;

    let name = `Event ${String(i).padStart(3, '0')}`;
    if (i === 1) name = 'An extremely long calendar event title that exceeds one hundred characters in length for testing edge case handling with verbose display names';
    if (i === 2) name = 'Event: & < > "special chars"';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Calendar Unicode \u00E9\u00E8';

    cards.push({
      id: randomUUID(),
      card_type: 'event',
      name,
      content: `Details for event ${i} in ${folder} calendar`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: i % 5 === 0 ? 'Conference Room A' : null,
      created_at: created,
      modified_at: modified,
      due_at: eventStart,
      completed_at: null,
      event_start: eventStart,
      event_end: eventEnd,
      folder,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'native_calendar',
      source_id: `cal-evt-${String(i).padStart(4, '0')}`,
      source_url: null,
      deleted_at: null,
    });
  }

  // 10 attendee persons
  for (let i = 1; i <= 10; i++) {
    const eventSourceId = `cal-evt-${String(i).padStart(4, '0')}`;

    cards.push({
      id: randomUUID(),
      card_type: 'person',
      name: `Attendee ${String(i).padStart(2, '0')}`,
      content: `attendee${i}@example.com`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: isoDate(2025),
      modified_at: isoDate(2026),
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: [],
      status: null,
      priority: 0,
      sort_order: eventCount + i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'native_calendar',
      source_id: `cal-person-${String(i).padStart(4, '0')}`,
      source_url: `attendee-of:${eventSourceId}`,
      deleted_at: null,
    });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// 9. Native Notes (CanonicalCard[])
// ---------------------------------------------------------------------------

function generateNativeNotes(count = 110) {
  const folderNames = ['Notes', 'Work', 'Personal', 'Archive', 'Projects', 'Ideas'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(folderNames);
    const tags = pickN(TAGS_POOL, 0, 3);
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `Native Note ${String(i).padStart(3, '0')}`;
    if (i === 1) name = 'An extremely long native note title that exceeds one hundred characters in length for testing edge case handling with verbose display names in the UI';
    if (i === 2) name = 'Special chars note: & < > "quotes"';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Native Note Unicode \u00E9\u00E8 \u{1F680}';

    // Note links: first 12 notes link to other notes
    let sourceUrl = null;
    let sourceId = `native-note-${String(i).padStart(4, '0')}`;
    if (i <= 12) {
      const targetIdx = ((i % count) + 1);
      const targetZID = `Z_${String(targetIdx).padStart(4, '0')}`;
      const sourceZID = `Z_${String(i).padStart(4, '0')}`;
      sourceUrl = `note-link:${targetZID}`;
      sourceId = `notelink:${sourceZID}:${targetZID}`;
    }

    cards.push({
      id: randomUUID(),
      card_type: 'note',
      name,
      content: `Content body for native note ${i}. This is about ${folder} topics with tags ${tags.join(', ')}.`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: created,
      modified_at: modified,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'native_notes',
      source_id: sourceId,
      source_url: sourceUrl,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Write all fixtures
// ---------------------------------------------------------------------------

console.log('Generating ETL validation fixtures...');

const appleNotes = generateAppleNotes(110);
writeFileSync(join(__dirname, 'apple-notes-snapshot.json'), JSON.stringify(appleNotes, null, 2));
console.log(`  apple-notes-snapshot.json: ${appleNotes.length} entries`);

const markdown = generateMarkdown(110);
writeFileSync(join(__dirname, 'markdown-snapshot.json'), JSON.stringify(markdown, null, 2));
console.log(`  markdown-snapshot.json: ${markdown.length} entries`);

const csv = generateCSV(110);
writeFileSync(join(__dirname, 'csv-snapshot.json'), JSON.stringify(csv, null, 2));
console.log(`  csv-snapshot.json: 1 ParsedFile with ${csv[0].content.split('\n').length - 1} rows`);

const json = generateJSON(110);
writeFileSync(join(__dirname, 'json-snapshot.json'), JSON.stringify(json, null, 2));
console.log(`  json-snapshot.json: ${json.length} entries`);

const excelRows = generateExcelRows(110);
writeFileSync(join(__dirname, 'excel-rows.json'), JSON.stringify(excelRows, null, 2));
console.log(`  excel-rows.json: ${excelRows.length} rows`);

const html = generateHTML(110);
writeFileSync(join(__dirname, 'html-snapshot.json'), JSON.stringify(html, null, 2));
console.log(`  html-snapshot.json: ${html.length} entries`);

const reminders = generateNativeReminders(110);
writeFileSync(join(__dirname, 'native-reminders.json'), JSON.stringify(reminders, null, 2));
console.log(`  native-reminders.json: ${reminders.length} entries`);

const calendar = generateNativeCalendar(110);
writeFileSync(join(__dirname, 'native-calendar.json'), JSON.stringify(calendar, null, 2));
console.log(`  native-calendar.json: ${calendar.length} entries`);

const notes = generateNativeNotes(110);
writeFileSync(join(__dirname, 'native-notes.json'), JSON.stringify(notes, null, 2));
console.log(`  native-notes.json: ${notes.length} entries`);

console.log('\nAll fixtures generated successfully!');
