#!/usr/bin/env node
// Generates CI-safe alto-index fixtures for Phase 109.
// Run: node tests/fixtures/alto-index/generate-alto-fixtures.mjs
// Committed JSON is source of truth -- script is for regeneration only.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const FOLDERS = ['Work', 'Personal', 'Projects', 'Archive', 'Research', 'Finance', null];
const STATUSES = ['todo', 'in_progress', 'done', 'blocked', null];
const PRIORITIES = [0, 1, 2, 3, 4, 5];
const TAGS_POOL = [
  'project', 'important', 'review', 'meeting', 'design', 'code',
  'documentation', 'testing', 'research', 'planning', 'urgent',
  'followup', 'idea', 'reference', 'draft',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, min, max) {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function isoDate(baseYear) {
  const y = baseYear || (Math.random() > 0.5 ? 2025 : 2026);
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 28);
  const h = Math.floor(Math.random() * 24);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`;
}
function pad(n, width = 3) { return String(n).padStart(width, '0'); }

// ---------------------------------------------------------------------------
// 1. Notes
// ---------------------------------------------------------------------------

function generateNotes(count = 252) {
  const folderNames = ['Notes', 'Work', 'Personal', 'Archive', 'Projects', 'Ideas'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(folderNames);
    const tags = pickN(TAGS_POOL, 0, 4);
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `Note ${pad(i)}`;
    if (i === 1) name = 'An extremely long note title that exceeds one hundred characters in length to test edge cases with verbose naming conventions and display truncation behavior';
    if (i === 2) name = 'Special chars: & < > " \' @ # $ %';
    if (i === 3) name = 'Unicode test: cafe\u0301 \u00FC\u00F6\u00E4 \u2603 \u2764\uFE0F \u{1F680}';

    cards.push({
      id: randomUUID(),
      card_type: 'note',
      name,
      content: `# ${name}\n\nContent body for note ${i}. This is a paragraph about **${folder}** topics.\n\n- Item one\n- Item two\n- Item three`,
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
      mime_type: 'text/markdown',
      is_collective: false,
      source: 'alto_notes',
      source_id: `alto-notes-${pad(i)}`,
      source_url: `notes://showNote?identifier=${1000 + i}`,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 2. Contacts
// ---------------------------------------------------------------------------

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Rose', 'Sam', 'Tara', 'Uma', 'Victor', 'Wendy', 'Xander', 'Yara'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Lewis', 'Lee', 'Clark', 'Walker', 'Hall', 'Allen', 'Young'];

function generateContacts(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
    const tags = pickN(TAGS_POOL, 0, 2);
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `${firstName} ${lastName}`;
    if (i === 1) name = 'An Extremely Long Contact Name That Has Both First And Last Name Exceeding Character Limits For Display';
    if (i === 2) name = 'Contact: O\'Brien & Associates <test@example.com>';
    if (i === 3) name = '\u00DCmit \u00D6zbek \u00C7elik';

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const phone = `+1-555-${String(100 + i).padStart(3, '0')}-${String(1000 + i).padStart(4, '0')}`;

    cards.push({
      id: randomUUID(),
      card_type: 'person',
      name,
      content: `Email: ${email}\nPhone: ${phone}\nOrganization: Example Corp ${i}`,
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
      folder: i % 4 === 0 ? 'Work' : i % 4 === 1 ? 'Personal' : null,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}`,
      mime_type: null,
      is_collective: false,
      source: 'alto_contacts',
      source_id: `alto-contacts-${pad(i)}`,
      source_url: `contact://id/${1200 + i}`,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 3. Calendar
// ---------------------------------------------------------------------------

const EVENT_NAMES = [
  'Team Standup', 'Product Review', 'Design Sprint', 'Client Meeting', 'One-on-One',
  'All-Hands', 'Code Review', 'Sprint Planning', 'Retrospective', 'Demo Day',
  'Lunch & Learn', 'Workshop', 'Interview', 'Board Meeting', 'Training Session',
  'Hackathon Kickoff', 'Release Planning', 'Budget Review', 'Strategy Session', 'Happy Hour',
  'Project Kickoff', 'Architecture Review', 'Incident Post-Mortem', 'OKR Review', 'Offsite',
];

function generateCalendar(count = 25) {
  const calendarNames = ['Work', 'Personal', 'Family', 'Fitness', 'Travel', 'Meetings'];
  const locations = ['Conference Room A', 'Conference Room B', 'Zoom', 'Office Lobby', 'Cafe Mocha', null];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(calendarNames);
    const tags = pickN(TAGS_POOL, 0, 2);
    const created = isoDate(2025);
    const modified = isoDate(2026);
    const baseDate = isoDate(2026).split('T')[0];
    const startHour = 8 + Math.floor(Math.random() * 10);
    const endHour = Math.min(startHour + 1 + Math.floor(Math.random() * 3), 20);
    const eventStart = `${baseDate}T${String(startHour).padStart(2, '0')}:00:00Z`;
    const eventEnd = `${baseDate}T${String(endHour).padStart(2, '0')}:00:00Z`;

    let name = EVENT_NAMES[(i - 1) % EVENT_NAMES.length];
    if (i === 1) name = 'An extremely long calendar event title that exceeds one hundred characters in length for testing edge case handling with verbose display names in UI';
    if (i === 2) name = 'Event: & < > "special chars"';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Calendar Unicode \u00E9\u00E8';

    cards.push({
      id: randomUUID(),
      card_type: 'event',
      name,
      content: `Details for ${name}. Attendees: team-${i}@example.com. Agenda: discuss progress on milestone ${Math.ceil(i / 5)}.`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: pick(locations),
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
      is_collective: i % 5 === 0,
      source: 'alto_calendar',
      source_id: `alto-calendar-${pad(i)}`,
      source_url: `cal://event/${1300 + i}`,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 4. Messages
// ---------------------------------------------------------------------------

const MESSAGE_BODIES = [
  'Hey, can we sync up later today?',
  'Just following up on the previous email.',
  'Thanks for the quick turnaround!',
  'The meeting has been rescheduled to 3pm.',
  'Please review the attached document.',
  'Are you available for a call tomorrow?',
  'The deployment went smoothly — all green.',
  'I\'ve updated the ticket with the latest notes.',
  'Let me know if you have any questions.',
  'Looking forward to our discussion.',
  'The client approved the proposal!',
  'Can you share the latest design files?',
  'We hit a blocker — need your input.',
  'Great work on the presentation yesterday.',
  'The report is ready for your review.',
  'I\'ll be OOO from Friday through Monday.',
  'New version is live on staging.',
  'Reminder: deadline is this Friday.',
  'Just saw your message — on it!',
  'The bug has been fixed and verified.',
  'Thanks for the feedback, updating now.',
  'Meeting notes have been sent to the group.',
  'Next steps: finalize scope by EOW.',
  'Approved! Go ahead with implementation.',
  'Can you take a look at this PR?',
];

function generateMessages(count = 25) {
  const contacts = ['alice@example.com', 'bob@example.com', '+1-555-000-1234', '+1-555-000-5678', 'carol@work.co'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 2);
    const created = isoDate();
    const modified = created;
    const contact = contacts[(i - 1) % contacts.length];

    let name = `Message from ${contact}`;
    if (i === 1) name = 'An extremely long message subject that exceeds one hundred characters in length for testing truncation in the message list and detail view rendering';
    if (i === 2) name = 'Message: & < > "special chars" subject';
    if (i === 3) name = 'Unicode message: \u{1F4AC} \u00E9\u00E8 \u00DC\u00F6\u00E4';

    cards.push({
      id: randomUUID(),
      card_type: 'message',
      name,
      content: MESSAGE_BODIES[(i - 1) % MESSAGE_BODIES.length],
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
      folder: i % 3 === 0 ? 'Inbox' : i % 3 === 1 ? 'Sent' : 'Archive',
      tags,
      status: i % 5 === 0 ? 'read' : 'unread',
      priority: 0,
      sort_order: i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'alto_messages',
      source_id: `alto-messages-${pad(i)}`,
      source_url: contact,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 5. Books
// ---------------------------------------------------------------------------

const BOOK_TITLES = [
  'The Pragmatic Programmer', 'Clean Code', 'Design Patterns', 'The Mythical Man-Month',
  'Refactoring', 'Domain-Driven Design', 'The Phoenix Project', 'Continuous Delivery',
  'Site Reliability Engineering', 'An Elegant Puzzle', 'A Philosophy of Software Design',
  'Working Effectively with Legacy Code', 'The Art of Readable Code', 'Code Complete',
  'Head First Design Patterns', 'Growing Object-Oriented Software', 'Release It!',
  'Building Microservices', 'Designing Data-Intensive Applications', 'The Manager\'s Path',
  'Staff Engineer', 'An Introduction to Information Retrieval', 'Algorithms', 'SICP',
  'Grokking Algorithms',
];

function generateBooks(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 3);
    const created = isoDate();
    const modified = isoDate(2026);
    const bookTitle = BOOK_TITLES[(i - 1) % BOOK_TITLES.length];

    let name = `Highlight from: ${bookTitle}`;
    if (i === 1) name = 'An extremely long book highlight title that exceeds one hundred characters in length for testing edge case display in the reference card view rendering';
    if (i === 2) name = 'Book: & < > "special chars" highlight';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Book Unicode highlight \u00E9\u00E8 \u{1F4DA}';

    cards.push({
      id: randomUUID(),
      card_type: 'reference',
      name,
      content: `Highlight from chapter ${Math.ceil(i / 3)}: "This is a significant insight from the book that deserves attention and deeper reflection. The author argues that good software design requires careful thought about trade-offs." — p. ${100 + i * 7}`,
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
      folder: bookTitle,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: `https://www.goodreads.com/book/show/${100000 + i}`,
      mime_type: null,
      is_collective: false,
      source: 'alto_books',
      source_id: `alto-books-${pad(i)}`,
      source_url: `books://highlight/${1400 + i}`,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 6. Calls
// ---------------------------------------------------------------------------

function generateCalls(count = 25) {
  const contacts = ['+1-555-010-1111', '+1-555-020-2222', '+1-555-030-3333', '+1-555-040-4444', '+1-555-050-5555'];
  const directions = ['incoming', 'outgoing', 'missed'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const tags = pickN(TAGS_POOL, 0, 1);
    const created = isoDate();
    const contact = contacts[(i - 1) % contacts.length];
    const direction = directions[(i - 1) % directions.length];
    const durationMins = 1 + Math.floor(Math.random() * 30);
    const baseDate = isoDate(2026).split('T')[0];
    const startHour = 9 + Math.floor(Math.random() * 8);
    const eventStart = `${baseDate}T${String(startHour).padStart(2, '0')}:00:00Z`;
    const eventEnd = `${baseDate}T${String(startHour).padStart(2, '0')}:${String(durationMins).padStart(2, '0')}:00Z`;

    let name = `${direction.charAt(0).toUpperCase() + direction.slice(1)} call with ${contact}`;
    if (i === 1) name = 'An extremely long call description that exceeds one hundred characters in length for testing truncation in the call history list view rendering behavior';
    if (i === 2) name = 'Call: & < > "special chars" contact';
    if (i === 3) name = 'Unicode call: \u{1F4DE} \u00DC\u00F6\u00E4 \u00E9\u00E8';

    cards.push({
      id: randomUUID(),
      card_type: 'event',
      name,
      content: `${direction} call — ${durationMins} minute${durationMins === 1 ? '' : 's'}`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: created,
      modified_at: created,
      due_at: null,
      completed_at: direction !== 'missed' ? eventEnd : null,
      event_start: eventStart,
      event_end: eventEnd,
      folder: direction === 'missed' ? 'Missed' : null,
      tags,
      status: direction === 'missed' ? 'missed' : 'completed',
      priority: 0,
      sort_order: i,
      url: null,
      mime_type: null,
      is_collective: false,
      source: 'alto_calls',
      source_id: `alto-calls-${pad(i)}`,
      source_url: contact,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 7. Safari History
// ---------------------------------------------------------------------------

const WEBSITES = [
  { url: 'https://github.com/microsoft/vscode', title: 'Visual Studio Code — GitHub' },
  { url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', title: 'JavaScript — MDN Web Docs' },
  { url: 'https://www.typescriptlang.org/docs/', title: 'TypeScript Documentation' },
  { url: 'https://vitejs.dev/guide/', title: 'Getting Started — Vite' },
  { url: 'https://vitest.dev/', title: 'Vitest — A Vite-native testing framework' },
  { url: 'https://d3js.org/', title: 'D3.js — Data-Driven Documents' },
  { url: 'https://sqlite.org/lang_select.html', title: 'SQLite SELECT documentation' },
  { url: 'https://stackoverflow.com/questions/tagged/typescript', title: 'TypeScript — Stack Overflow' },
  { url: 'https://news.ycombinator.com/', title: 'Hacker News' },
  { url: 'https://www.apple.com/swift/', title: 'Swift — Apple Developer' },
  { url: 'https://developer.apple.com/documentation/cloudkit', title: 'CloudKit — Apple Developer' },
  { url: 'https://webkit.org/blog/', title: 'WebKit Blog' },
  { url: 'https://css-tricks.com/', title: 'CSS-Tricks' },
  { url: 'https://web.dev/', title: 'web.dev — Google Developers' },
  { url: 'https://tailwindcss.com/docs/', title: 'Tailwind CSS Documentation' },
  { url: 'https://reactjs.org/', title: 'React — A JavaScript library for building UIs' },
  { url: 'https://svelte.dev/', title: 'Svelte — Cybernetically enhanced web apps' },
  { url: 'https://www.postgresql.org/docs/', title: 'PostgreSQL Documentation' },
  { url: 'https://redis.io/', title: 'Redis — The open-source, in-memory data store' },
  { url: 'https://grafana.com/', title: 'Grafana — The Open Observability Platform' },
  { url: 'https://kubernetes.io/docs/home/', title: 'Kubernetes Documentation' },
  { url: 'https://www.docker.com/', title: 'Docker — Accelerated Container Application Development' },
  { url: 'https://linear.app/', title: 'Linear — The issue tracking tool you\'ll enjoy using' },
  { url: 'https://www.figma.com/', title: 'Figma — The collaborative interface design tool' },
  { url: 'https://obsidian.md/', title: 'Obsidian — A second brain for you, forever' },
];

function generateSafariHistory(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const site = WEBSITES[(i - 1) % WEBSITES.length];
    const tags = pickN(TAGS_POOL, 0, 2);
    const visited = isoDate();

    let name = site.title;
    if (i === 1) name = 'An extremely long Safari history page title that exceeds one hundred characters in length for testing edge case display in the browser history list view';
    if (i === 2) name = 'Safari: & < > "special chars" page title';
    if (i === 3) name = 'Unicode page: \u{1F310} \u00DC\u00F6\u00E4 \u00E9\u00E8 web title';

    cards.push({
      id: randomUUID(),
      card_type: 'reference',
      name,
      content: `Visited page: ${site.url}\nVisit count: ${1 + Math.floor(Math.random() * 20)}\nLast visited: ${visited}`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: visited,
      modified_at: visited,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: site.url,
      mime_type: 'text/html',
      is_collective: false,
      source: 'alto_safari_history',
      source_id: `alto-safari-history-${pad(i)}`,
      source_url: site.url,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 8. Kindle
// ---------------------------------------------------------------------------

const KINDLE_BOOKS = [
  'Thinking, Fast and Slow',
  'Sapiens: A Brief History of Humankind',
  'The Gene: An Intimate History',
  'Outliers: The Story of Success',
  'The Power of Habit',
  'Educated',
  'Atomic Habits',
  'The Body: A Guide for Occupants',
  'Factfulness',
  'Deep Work',
  'Digital Minimalism',
  'The Subtle Art of Not Giving a F*ck',
  'Range: Why Generalists Triumph',
  'The Innovator\'s Dilemma',
  'Zero to One',
  'Bad Blood',
  'Shoe Dog',
  'The Everything Store',
  'Creativity, Inc.',
  'The Hard Thing About Hard Things',
  'High Output Management',
  'An Elegant Puzzle',
  'The Making of a Manager',
  'Radical Candor',
  'Never Split the Difference',
];

function generateKindle(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const bookTitle = KINDLE_BOOKS[(i - 1) % KINDLE_BOOKS.length];
    const tags = pickN(TAGS_POOL, 0, 3);
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `Kindle highlight ${pad(i)}`;
    if (i === 1) name = 'An extremely long Kindle highlight that exceeds one hundred characters in length for testing edge case display in the reference card and annotation view';
    if (i === 2) name = 'Kindle: & < > "special chars" annotation';
    if (i === 3) name = 'Unicode Kindle: \u{1F4D6} \u00DC\u00F6\u00E4 \u00E9\u00E8';

    const highlightText = `"This passage from ${bookTitle} reveals something important: the relationship between deliberate practice and mastery is not linear, but rather follows a pattern of plateau and breakthrough. The author's research demonstrates that experts aren't born — they are made through specific types of practice." — Page ${50 + i * 11}`;

    cards.push({
      id: randomUUID(),
      card_type: 'reference',
      name,
      content: highlightText,
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
      folder: bookTitle,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: `kindle://book?action=open&asin=B${String(100000 + i).padStart(9, '0')}`,
      mime_type: null,
      is_collective: false,
      source: 'alto_kindle',
      source_id: `alto-kindle-${pad(i)}`,
      source_url: null,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 9. Reminders
// ---------------------------------------------------------------------------

function generateReminders(count = 25) {
  const listNames = ['Groceries', 'Work', 'Personal', 'Home', 'Health', 'Errands', 'Shopping'];
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const folder = pick(listNames);
    const tags = pickN(TAGS_POOL, 0, 3);
    const status = Math.random() > 0.3 ? 'incomplete' : 'complete';
    const priority = pick(PRIORITIES);
    const hasDueDate = Math.random() > 0.3;
    const created = isoDate();
    const modified = isoDate(2026);

    let name = `Reminder ${pad(i)}`;
    if (i === 1) name = 'An extremely long reminder title that exceeds one hundred characters in length for testing edge case handling with verbose display names in the task list UI';
    if (i === 2) name = 'Reminder: & < > "special chars"';
    if (i === 3) name = '\u00DC\u00F6\u00E4 Unicode Reminder \u00E9\u00E8 \u{1F680}';

    cards.push({
      id: randomUUID(),
      card_type: 'task',
      name,
      content: `Details for reminder ${i}: item on the ${folder} list. Notes: check this before ${hasDueDate ? 'the deadline' : 'end of week'}.`,
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
      source: 'alto_reminders',
      source_id: `alto-reminders-${pad(i)}`,
      source_url: `reminders://task/${1600 + i}`,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 10. Safari Bookmarks
// ---------------------------------------------------------------------------

const BOOKMARK_FOLDERS = ['Reading List', 'Dev Tools', 'References', 'Recipes', 'Shopping', 'News', 'Work'];

function generateSafariBookmarks(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const site = WEBSITES[(i - 1) % WEBSITES.length];
    const tags = pickN(TAGS_POOL, 0, 3);
    const created = isoDate();
    const bookmarkFolder = BOOKMARK_FOLDERS[(i - 1) % BOOKMARK_FOLDERS.length];

    let name = `Bookmark: ${site.title}`;
    if (i === 1) name = 'An extremely long Safari bookmark title that exceeds one hundred characters in length for testing edge case display in the bookmark manager and reference view';
    if (i === 2) name = 'Bookmark: & < > "special chars" page title';
    if (i === 3) name = 'Unicode bookmark: \u{1F516} \u00DC\u00F6\u00E4 \u00E9\u00E8';

    cards.push({
      id: randomUUID(),
      card_type: 'reference',
      name,
      content: `Bookmarked: ${site.url}`,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: created,
      modified_at: created,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: bookmarkFolder,
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: site.url,
      mime_type: null,
      is_collective: false,
      source: 'alto_safari_bookmarks',
      source_id: `alto-safari-bookmarks-${pad(i)}`,
      source_url: site.url,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// 11. Voice Memos
// ---------------------------------------------------------------------------

const MEMO_SUBJECTS = [
  'Meeting notes recap', 'Project brainstorm', 'Ideas for redesign', 'Voice reminder',
  'Dictated email draft', 'Reading notes', 'Thoughts on architecture', 'Daily journal',
  'Quick note to self', 'Interview prep notes', 'Lecture recording', 'Book summary',
  'Task list dictation', 'Travel notes', 'Research observations', 'Podcast key points',
  'Feedback session notes', 'Bug report dictation', 'Planning session recap', 'Action items',
  'Weekly review', 'Retrospective thoughts', 'Feature ideas', 'Customer call notes', 'Sprint notes',
];

function generateVoiceMemos(count = 25) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    const subject = MEMO_SUBJECTS[(i - 1) % MEMO_SUBJECTS.length];
    const tags = pickN(TAGS_POOL, 0, 2);
    const created = isoDate();
    const durationSecs = 30 + Math.floor(Math.random() * 600);

    let name = `Voice Memo: ${subject}`;
    if (i === 1) name = 'An extremely long voice memo title that exceeds one hundred characters in length for testing edge case display in the media card and voice memo list view';
    if (i === 2) name = 'Voice Memo: & < > "special chars" title';
    if (i === 3) name = 'Unicode memo: \u{1F3A4} \u00DC\u00F6\u00E4 \u00E9\u00E8';

    const transcription = `Transcription of ${subject} (${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s): This is the auto-transcribed content of the voice memo. The speaker discusses ${subject.toLowerCase()} with various related points and action items. Key takeaway: review and follow up before end of sprint.`;

    cards.push({
      id: randomUUID(),
      card_type: 'media',
      name,
      content: transcription,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: created,
      modified_at: created,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: 'Voice Memos',
      tags,
      status: null,
      priority: 0,
      sort_order: i,
      url: `voice-memo://id/${1700 + i}`,
      mime_type: 'audio/m4a',
      is_collective: false,
      source: 'alto_voice_memos',
      source_id: `alto-voice-memos-${pad(i)}`,
      source_url: null,
      deleted_at: null,
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Edge cases (separate, hand-crafted)
// ---------------------------------------------------------------------------

function generateEdgeCases() {
  const baseCard = {
    card_type: 'note',
    summary: null,
    latitude: null,
    longitude: null,
    location_name: null,
    created_at: '2026-01-15T09:00:00Z',
    modified_at: '2026-02-20T14:30:00Z',
    due_at: null,
    completed_at: null,
    event_start: null,
    event_end: null,
    status: null,
    priority: 0,
    sort_order: 0,
    url: null,
    mime_type: null,
    is_collective: false,
    source: 'alto_edge_cases',
    deleted_at: null,
  };

  return [
    // 1. Null name
    {
      ...baseCard,
      id: randomUUID(),
      name: null,
      content: 'Card with null name — should not crash downstream consumers.',
      folder: 'Edge Cases',
      tags: [],
      sort_order: 1,
      source_id: 'edge-null-name-001',
      source_url: null,
    },
    // 2. Null content
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with null content',
      content: null,
      folder: 'Edge Cases',
      tags: ['no-content'],
      sort_order: 2,
      source_id: 'edge-null-content-002',
      source_url: null,
    },
    // 3. Very long name (500+ chars)
    {
      ...baseCard,
      id: randomUUID(),
      name: 'A'.repeat(520) + ' (520-char name)',
      content: 'Card with an extremely long name exceeding typical display limits.',
      folder: 'Edge Cases',
      tags: ['long-name'],
      sort_order: 3,
      source_id: 'edge-long-name-003',
      source_url: null,
    },
    // 4. Emoji-heavy content (flags, skin tones, ZWJ sequences)
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Emoji edge case',
      content: 'Flags: \u{1F1FA}\u{1F1F8} \u{1F1EC}\u{1F1E7} \u{1F1E9}\u{1F1EA}\nSkin tones: \u{1F44D}\u{1F3FB} \u{1F44D}\u{1F3FD} \u{1F44D}\u{1F3FF}\nZWJ: \u{1F469}\u200D\u{1F4BB} \u{1F468}\u200D\u{1F469}\u200D\u{1F466}\nMisc: \u{1F600}\u{1F923}\u{1F643}\u2764\uFE0F\u{1F525}',
      folder: 'Edge Cases',
      tags: ['unicode', 'emoji'],
      sort_order: 4,
      source_id: 'edge-emoji-content-004',
      source_url: null,
    },
    // 5. Unicode normalization edge case (composed vs decomposed)
    {
      ...baseCard,
      id: randomUUID(),
      name: 'cafe\u0301 vs caf\u00E9 — normalization test',
      content: 'NFC: caf\u00E9 (U+00E9)\nNFD: cafe\u0301 (e + combining accent)\nBoth should round-trip through the database correctly.',
      folder: 'Edge Cases',
      tags: ['unicode', 'normalization'],
      sort_order: 5,
      source_id: 'edge-unicode-norm-005',
      source_url: null,
    },
    // 6. Empty tags array
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with empty tags array',
      content: 'This card has no tags — tags field is an empty array [].',
      folder: 'Edge Cases',
      tags: [],
      sort_order: 6,
      source_id: 'edge-empty-tags-006',
      source_url: null,
    },
    // 7. Many tags (20+)
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with 22 tags',
      content: 'This card has an unusually high number of tags to test rendering and storage limits.',
      folder: 'Edge Cases',
      tags: ['tag-01', 'tag-02', 'tag-03', 'tag-04', 'tag-05', 'tag-06', 'tag-07', 'tag-08', 'tag-09', 'tag-10', 'tag-11', 'tag-12', 'tag-13', 'tag-14', 'tag-15', 'tag-16', 'tag-17', 'tag-18', 'tag-19', 'tag-20', 'tag-21', 'tag-22'],
      sort_order: 7,
      source_id: 'edge-many-tags-007',
      source_url: null,
    },
    // 8. All date fields null
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with all dates null',
      content: 'All date fields (due_at, completed_at, event_start, event_end) are null.',
      folder: 'Edge Cases',
      tags: ['no-dates'],
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      sort_order: 8,
      source_id: 'edge-null-dates-008',
      source_url: null,
    },
    // 9. source_id with special characters (colons, slashes)
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with special source_id',
      content: 'source_id contains colons and slashes: notelink:Z_0042:Z_0099',
      folder: 'Edge Cases',
      tags: ['special-source-id'],
      sort_order: 9,
      source_id: 'notelink:Z_0042:Z_0099/alto/special',
      source_url: 'note-link:Z_0099',
    },
    // 10. Deeply nested folder path
    {
      ...baseCard,
      id: randomUUID(),
      name: 'Card with deeply nested folder',
      content: 'This card is in a deeply nested folder: A/B/C/D/E',
      folder: 'A/B/C/D/E',
      tags: ['deep-folder'],
      sort_order: 10,
      source_id: 'edge-deep-folder-010',
      source_url: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Write all fixtures
// ---------------------------------------------------------------------------

mkdirSync(__dirname, { recursive: true });

console.log('Generating alto-index fixtures...');

const notes = generateNotes(252);
writeFileSync(join(__dirname, 'notes.json'), JSON.stringify(notes, null, 2));
console.log(`  notes.json: ${notes.length} cards`);

const contacts = generateContacts(25);
writeFileSync(join(__dirname, 'contacts.json'), JSON.stringify(contacts, null, 2));
console.log(`  contacts.json: ${contacts.length} cards`);

const calendar = generateCalendar(25);
writeFileSync(join(__dirname, 'calendar.json'), JSON.stringify(calendar, null, 2));
console.log(`  calendar.json: ${calendar.length} cards`);

const messages = generateMessages(25);
writeFileSync(join(__dirname, 'messages.json'), JSON.stringify(messages, null, 2));
console.log(`  messages.json: ${messages.length} cards`);

const books = generateBooks(25);
writeFileSync(join(__dirname, 'books.json'), JSON.stringify(books, null, 2));
console.log(`  books.json: ${books.length} cards`);

const calls = generateCalls(25);
writeFileSync(join(__dirname, 'calls.json'), JSON.stringify(calls, null, 2));
console.log(`  calls.json: ${calls.length} cards`);

const safariHistory = generateSafariHistory(25);
writeFileSync(join(__dirname, 'safari-history.json'), JSON.stringify(safariHistory, null, 2));
console.log(`  safari-history.json: ${safariHistory.length} cards`);

const kindle = generateKindle(25);
writeFileSync(join(__dirname, 'kindle.json'), JSON.stringify(kindle, null, 2));
console.log(`  kindle.json: ${kindle.length} cards`);

const reminders = generateReminders(25);
writeFileSync(join(__dirname, 'reminders.json'), JSON.stringify(reminders, null, 2));
console.log(`  reminders.json: ${reminders.length} cards`);

const safariBookmarks = generateSafariBookmarks(25);
writeFileSync(join(__dirname, 'safari-bookmarks.json'), JSON.stringify(safariBookmarks, null, 2));
console.log(`  safari-bookmarks.json: ${safariBookmarks.length} cards`);

const voiceMemos = generateVoiceMemos(25);
writeFileSync(join(__dirname, 'voice-memos.json'), JSON.stringify(voiceMemos, null, 2));
console.log(`  voice-memos.json: ${voiceMemos.length} cards`);

const edgeCases = generateEdgeCases();
writeFileSync(join(__dirname, 'edge-cases.json'), JSON.stringify(edgeCases, null, 2));
console.log(`  edge-cases.json: ${edgeCases.length} cards`);

console.log('\nAll alto-index fixtures generated successfully!');
