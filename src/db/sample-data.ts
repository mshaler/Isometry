// Sample data for development and testing

interface SampleNote {
  id: string;
  name: string;
  content: string;
  folder: string;
  tags: string[];
  priority: number;
  createdDaysAgo: number;
}

const SAMPLE_NOTES: SampleNote[] = [
  // Work
  { id: 'n001', name: 'Q1 Planning Meeting Notes', content: 'Discussed roadmap priorities...', folder: 'Work', tags: ['meetings', 'planning'], priority: 4, createdDaysAgo: 5 },
  { id: 'n002', name: 'Product Roadmap Draft', content: '## Product Vision\n\nBuild the best polymorphic data visualization tool.', folder: 'Work', tags: ['planning', 'draft'], priority: 5, createdDaysAgo: 12 },
  { id: 'n003', name: 'Team Standup Notes', content: 'Quick sync with the team...', folder: 'Work', tags: ['meetings'], priority: 2, createdDaysAgo: 1 },
  { id: 'n004', name: 'Performance Review Prep', content: 'Notes for upcoming review...', folder: 'Work', tags: ['important'], priority: 4, createdDaysAgo: 8 },
  { id: 'n005', name: 'Client Call - Acme Corp', content: 'Call with Acme Corp stakeholders...', folder: 'Work', tags: ['meetings', 'urgent'], priority: 5, createdDaysAgo: 2 },
  
  // Projects  
  { id: 'n006', name: 'Isometry Architecture', content: '## Core Concepts\n\nPAFV, LATCH, GRAPH...', folder: 'Projects', tags: ['reference', 'important'], priority: 5, createdDaysAgo: 20 },
  { id: 'n007', name: 'D3.js Best Practices', content: 'Key patterns for D3...', folder: 'Projects', tags: ['reference'], priority: 3, createdDaysAgo: 15 },
  { id: 'n008', name: 'SQLite Schema Design', content: 'Optimizing for LATCH...', folder: 'Projects', tags: ['reference'], priority: 4, createdDaysAgo: 10 },
  { id: 'n009', name: 'MVP Feature List', content: 'Core features for launch...', folder: 'Projects', tags: ['planning'], priority: 5, createdDaysAgo: 7 },
  { id: 'n010', name: 'Bug Fixes Needed', content: 'List of known issues...', folder: 'Projects', tags: ['bugs'], priority: 3, createdDaysAgo: 3 },
  
  // Personal
  { id: 'n011', name: 'Book List 2026', content: '## To Read\n- The Pragmatic Programmer...', folder: 'Personal', tags: ['reference'], priority: 2, createdDaysAgo: 30 },
  { id: 'n012', name: 'Morning Routine', content: '6:00 - Wake up...', folder: 'Personal', tags: ['template'], priority: 3, createdDaysAgo: 45 },
  { id: 'n013', name: 'Gift Ideas', content: 'For Mom: spa day...', folder: 'Personal', tags: ['reference'], priority: 1, createdDaysAgo: 60 },
  { id: 'n014', name: 'Workout Log', content: 'Mon: Upper body...', folder: 'Personal', tags: ['health'], priority: 2, createdDaysAgo: 4 },
  { id: 'n015', name: 'Recipe: Pasta', content: 'Ingredients: ...', folder: 'Personal', tags: ['recipes'], priority: 1, createdDaysAgo: 25 },
  
  // Ideas
  { id: 'n016', name: 'App Ideas', content: '1. AI-powered recipe finder...', folder: 'Ideas', tags: ['draft'], priority: 2, createdDaysAgo: 14 },
  { id: 'n017', name: 'Blog Post Draft', content: 'Why SQLite is Underrated...', folder: 'Ideas', tags: ['draft', 'writing'], priority: 3, createdDaysAgo: 9 },
  { id: 'n018', name: 'Side Project Concepts', content: 'Things to build someday...', folder: 'Ideas', tags: ['draft'], priority: 1, createdDaysAgo: 40 },
  
  // Research
  { id: 'n019', name: 'Competitive Analysis', content: '## Competitors\n\nNotion, Obsidian, Roam...', folder: 'Research', tags: ['reference', 'important'], priority: 4, createdDaysAgo: 22 },
  { id: 'n020', name: 'User Interview Notes', content: 'Key quotes from users...', folder: 'Research', tags: ['reference'], priority: 3, createdDaysAgo: 18 },
  
  // Meetings
  { id: 'n021', name: '1:1 with Sarah', content: 'Topics discussed...', folder: 'Meetings', tags: ['meetings'], priority: 3, createdDaysAgo: 6 },
  { id: 'n022', name: 'Board Meeting Prep', content: 'Agenda for board...', folder: 'Meetings', tags: ['meetings', 'important'], priority: 5, createdDaysAgo: 11 },
  { id: 'n023', name: 'Design Review', content: 'Feedback on mockups...', folder: 'Meetings', tags: ['meetings'], priority: 3, createdDaysAgo: 4 },
  
  // Archive
  { id: 'n024', name: 'Old Project Notes', content: 'From 2024 project...', folder: 'Archive', tags: ['archive'], priority: 0, createdDaysAgo: 90 },
  { id: 'n025', name: 'Completed Tasks', content: 'Done items from Q4...', folder: 'Archive', tags: ['archive'], priority: 0, createdDaysAgo: 75 },
];

function generateDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

// Generate more notes by varying the templates
function generateAllNotes(): SampleNote[] {
  const allNotes = [...SAMPLE_NOTES];
  
  // Add 75 more notes with variations
  for (let i = 26; i <= 100; i++) {
    const template = SAMPLE_NOTES[(i - 1) % SAMPLE_NOTES.length];
    allNotes.push({
      id: `n${String(i).padStart(3, '0')}`,
      name: `${template.name} (${Math.ceil((i - 25) / 25)})`,
      content: template.content,
      folder: template.folder,
      tags: template.tags,
      priority: Math.floor(Math.random() * 5),
      createdDaysAgo: Math.floor(Math.random() * 90) + 1,
    });
  }
  
  return allNotes;
}

const ALL_NOTES = generateAllNotes();

export const SAMPLE_DATA_SQL = ALL_NOTES.map(note => `
INSERT INTO nodes (id, node_type, name, content, folder, tags, priority, created_at, modified_at)
VALUES (
  '${note.id}',
  'note',
  '${escapeSql(note.name)}',
  '${escapeSql(note.content)}',
  '${note.folder}',
  '${JSON.stringify(note.tags)}',
  ${note.priority},
  '${generateDate(note.createdDaysAgo)}',
  '${generateDate(Math.max(0, note.createdDaysAgo - Math.floor(Math.random() * 3)))}'
);`).join('\n');

export { ALL_NOTES as SAMPLE_NOTES };
