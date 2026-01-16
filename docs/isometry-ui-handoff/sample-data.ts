// ============================================================================
// Isometry Sample Data
// ============================================================================
// 100 realistic notes for development and testing
// Covers variety of folders, dates, priorities, and content
// ============================================================================

import { Node, NodeType, TaskStatus } from './types';

// Helper to generate random date within range
function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
}

// Helper to generate random ID
function generateId(): string {
  return `node-${Math.random().toString(36).substring(2, 11)}`;
}

// Sample folders
const FOLDERS = [
  'Work',
  'Personal',
  'Projects',
  'Archive',
  'Meetings',
  'Ideas',
  'Research',
  'Health',
  'Finance',
  'Travel',
];

// Sample tags
const TAGS = [
  'important',
  'follow-up',
  'review',
  'draft',
  'final',
  'urgent',
  'reference',
  'template',
  'archive',
  'share',
];

// Sample locations
const LOCATIONS = [
  { name: 'Boulder, CO', lat: 40.0150, lon: -105.2705 },
  { name: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 },
  { name: 'New York, NY', lat: 40.7128, lon: -74.0060 },
  { name: 'Austin, TX', lat: 30.2672, lon: -97.7431 },
  { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  null, // Many notes won't have location
  null,
  null,
  null,
];

// Sample note titles and content
const NOTE_TEMPLATES = [
  // Work
  { 
    folder: 'Work', 
    title: 'Q1 Planning Meeting Notes', 
    content: 'Discussed roadmap priorities for Q1. Key decisions:\n\n1. Focus on core features first\n2. Delay mobile launch to Q2\n3. Hire 2 more engineers\n\nAction items assigned to team leads.',
    tags: ['meetings', 'planning']
  },
  { 
    folder: 'Work', 
    title: 'Product Roadmap Draft', 
    content: '## Product Vision\n\nBuild the best polymorphic data visualization tool.\n\n## Q1 Goals\n- Launch MVP\n- 100 beta users\n- 50% week-over-week retention',
    tags: ['planning', 'draft']
  },
  { 
    folder: 'Work', 
    title: 'Team Standup Notes', 
    content: 'Quick sync with the team:\n\n- Sarah: finishing auth flow\n- Mike: debugging sync issues\n- Alex: UX research ongoing\n\nBlocked: waiting on API docs from partner.',
    tags: ['meetings']
  },
  { 
    folder: 'Work', 
    title: 'Performance Review Prep', 
    content: 'Notes for upcoming review:\n\n**Accomplishments**\n- Shipped 3 major features\n- Mentored 2 junior devs\n- Reduced bugs by 40%\n\n**Areas for growth**\n- Public speaking\n- Cross-team collaboration',
    tags: ['important', 'draft']
  },
  { 
    folder: 'Work', 
    title: 'Client Call Summary - Acme Corp', 
    content: 'Call with Acme Corp stakeholders.\n\nRequested features:\n1. Export to Excel\n2. Custom dashboards\n3. API access\n\nTimeline: Need proposal by Friday.',
    tags: ['meetings', 'follow-up', 'urgent']
  },
  
  // Projects
  { 
    folder: 'Projects', 
    title: 'Isometry Architecture Notes', 
    content: '## Core Concepts\n\n**PAFV**: Planes → Axes → Facets → Values\n**LATCH**: Location, Alphabet, Time, Category, Hierarchy\n**GRAPH**: Links, Nesting, Sequence, Affinity\n\nThe boring stack wins.',
    tags: ['reference', 'important']
  },
  { 
    folder: 'Projects', 
    title: 'D3.js Best Practices', 
    content: 'Key patterns for D3:\n\n```javascript\nsvg.selectAll(".item")\n  .data(items, d => d.id)\n  .join("rect")\n  .attr("x", d => xScale(d.category))\n```\n\nAlways use key functions!',
    tags: ['reference', 'template']
  },
  { 
    folder: 'Projects', 
    title: 'SQLite Schema Design', 
    content: 'Optimizing for LATCH:\n\n- Index on each axis column\n- FTS5 for text search\n- JSON for tags array\n- Soft delete pattern\n\nAvoid: excessive normalization.',
    tags: ['reference']
  },
  
  // Personal
  { 
    folder: 'Personal', 
    title: 'Book List 2026', 
    content: '## To Read\n- The Pragmatic Programmer\n- Designing Data-Intensive Applications\n- Staff Engineer\n\n## Finished\n- Shape Up ⭐⭐⭐⭐⭐\n- The Manager\'s Path ⭐⭐⭐⭐',
    tags: ['reference']
  },
  { 
    folder: 'Personal', 
    title: 'Morning Routine', 
    content: '6:00 - Wake up, no phone\n6:15 - Meditation (10 min)\n6:30 - Exercise\n7:15 - Shower\n7:45 - Breakfast\n8:15 - Deep work block',
    tags: ['template']
  },
  { 
    folder: 'Personal', 
    title: 'Gift Ideas', 
    content: 'For Mom: spa day, new cookbook\nFor Dad: golf lessons, whiskey\nFor Sarah: concert tickets, art supplies',
    tags: ['reference']
  },
  
  // Ideas
  { 
    folder: 'Ideas', 
    title: 'App Ideas', 
    content: '1. AI-powered recipe finder based on fridge contents\n2. Neighborhood tool sharing app\n3. Reading group scheduler\n4. Personal finance dashboard',
    tags: ['draft']
  },
  { 
    folder: 'Ideas', 
    title: 'Blog Post: Why SQLite is Underrated', 
    content: 'Working title: "SQLite: The Database That Could"\n\nMain points:\n- Good enough for 95% of apps\n- Zero configuration\n- Incredible reliability\n- Edge deployment ready',
    tags: ['draft']
  },
  
  // Research
  { 
    folder: 'Research', 
    title: 'Competitive Analysis', 
    content: '## Competitors\n\n**Notion**: General purpose, complex\n**Obsidian**: Markdown focused, local-first\n**Roam**: Networked thought\n\n**Our differentiator**: Polymorphic views with LATCH filtering.',
    tags: ['reference', 'important']
  },
  { 
    folder: 'Research', 
    title: 'User Interview Notes - Participant 3', 
    content: 'Key quotes:\n- "I have 500 notes and can\'t find anything"\n- "I wish I could see my notes on a timeline"\n- "Folders are too rigid"\n\nPain point: organization breaks down at scale.',
    tags: ['reference']
  },
  
  // Meetings
  { 
    folder: 'Meetings', 
    title: '1:1 with Sarah - Jan 10', 
    content: 'Topics discussed:\n- Career growth path\n- Project handoff timing\n- Team dynamics\n\nAction: Sarah to draft proposal by EOW.',
    tags: ['meetings']
  },
  { 
    folder: 'Meetings', 
    title: 'Board Meeting Prep', 
    content: 'Agenda:\n1. Q4 results review\n2. 2026 strategy\n3. Funding discussion\n4. Hiring plan\n\nDeck due: Monday 9am.',
    tags: ['meetings', 'important', 'urgent']
  },
  
  // Health
  { 
    folder: 'Health', 
    title: 'Workout Log - Week 3', 
    content: 'Mon: Upper body (30 min)\nTue: Run 5k (28:45)\nWed: Rest\nThu: Lower body (35 min)\nFri: Yoga (45 min)\nSat: Hike (2 hrs)\nSun: Rest',
    tags: ['reference']
  },
  { 
    folder: 'Health', 
    title: 'Meal Prep Ideas', 
    content: 'Breakfast: overnight oats, egg muffins\nLunch: grain bowls, soup\nDinner: sheet pan dinners, stir fry\nSnacks: hummus + veggies, nuts',
    tags: ['template']
  },
  
  // Finance
  { 
    folder: 'Finance', 
    title: 'Budget Review - January', 
    content: 'Income: $X,XXX\n\nExpenses:\n- Housing: 35%\n- Food: 15%\n- Transport: 10%\n- Savings: 20%\n- Other: 20%\n\nOn track!',
    tags: ['reference']
  },
  { 
    folder: 'Finance', 
    title: 'Investment Research', 
    content: 'Looking into:\n- Index funds (VTI, VXUS)\n- I-Bonds for inflation protection\n- 401k max contribution\n\nMeet with advisor next month.',
    tags: ['reference', 'follow-up']
  },
  
  // Travel
  { 
    folder: 'Travel', 
    title: 'Japan Trip Planning', 
    content: '## Itinerary Draft\n\nTokyo: 4 days\nKyoto: 3 days\nOsaka: 2 days\n\n## Must See\n- Fushimi Inari\n- TeamLab Borderless\n- Tsukiji Market',
    tags: ['planning', 'draft']
  },
  { 
    folder: 'Travel', 
    title: 'Packing List Template', 
    content: '## Essentials\n- Passport\n- Phone + charger\n- Medications\n\n## Clothes\n- Based on weather\n- 1 nice outfit\n- Comfy shoes\n\n## Tech\n- Laptop\n- Adapters',
    tags: ['template']
  },
];

/**
 * Generate sample nodes
 */
export function generateSampleNodes(count: number = 100): Node[] {
  const nodes: Node[] = [];
  
  for (let i = 0; i < count; i++) {
    // Pick a template (cycling through, then random)
    const template = NOTE_TEMPLATES[i % NOTE_TEMPLATES.length];
    
    // Generate dates
    const createdAt = randomDate(90); // Within last 90 days
    const modifiedDate = new Date(createdAt);
    modifiedDate.setDate(modifiedDate.getDate() + Math.floor(Math.random() * 7)); // Modified within a week
    const modifiedAt = modifiedDate.toISOString();
    
    // Pick random location (most will be null)
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    
    // Generate random priority
    const priority = Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0;
    
    // Vary the title slightly for duplicates
    const titleSuffix = i >= NOTE_TEMPLATES.length ? ` (${Math.floor(i / NOTE_TEMPLATES.length) + 1})` : '';
    
    nodes.push({
      id: generateId(),
      nodeType: 'note',
      name: template.title + titleSuffix,
      content: template.content,
      summary: null,
      latitude: location?.lat ?? null,
      longitude: location?.lon ?? null,
      locationName: location?.name ?? null,
      locationAddress: null,
      createdAt,
      modifiedAt,
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: template.folder,
      tags: template.tags,
      status: null,
      priority,
      importance: 0,
      sortOrder: i,
      source: 'sample',
      sourceId: `sample-${i}`,
      sourceUrl: null,
      deletedAt: null,
      version: 1,
    });
  }
  
  return nodes;
}

/**
 * Generate INSERT statements for sample data
 */
export function generateSampleSQL(nodes: Node[]): string {
  const statements: string[] = [];
  
  for (const node of nodes) {
    const sql = `INSERT INTO nodes (
      id, node_type, name, content, summary,
      latitude, longitude, location_name, location_address,
      created_at, modified_at, due_at, completed_at, event_start, event_end,
      folder, tags, status, priority, importance, sort_order,
      source, source_id, source_url, deleted_at, version
    ) VALUES (
      '${node.id}', '${node.nodeType}', '${escapeSql(node.name)}', '${escapeSql(node.content || '')}', NULL,
      ${node.latitude ?? 'NULL'}, ${node.longitude ?? 'NULL'}, ${node.locationName ? `'${escapeSql(node.locationName)}'` : 'NULL'}, NULL,
      '${node.createdAt}', '${node.modifiedAt}', NULL, NULL, NULL, NULL,
      ${node.folder ? `'${escapeSql(node.folder)}'` : 'NULL'}, '${JSON.stringify(node.tags)}', NULL, ${node.priority}, 0, ${node.sortOrder},
      '${node.source}', '${node.sourceId}', NULL, NULL, 1
    );`;
    statements.push(sql);
  }
  
  return statements.join('\n');
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

// Export pre-generated sample data
export const SAMPLE_NODES = generateSampleNodes(100);

// Export as SQL
export const SAMPLE_DATA_SQL = generateSampleSQL(SAMPLE_NODES);
