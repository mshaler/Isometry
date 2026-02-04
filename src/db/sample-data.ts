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

// Contact Data
interface SampleContact {
  id: string;
  name: string;
  content: string;
  folder: string;
  tags: string[];
  priority: number;
  createdDaysAgo: number;
  company?: string;
  email?: string;
  phone?: string;
}

const SAMPLE_CONTACTS: SampleContact[] = [
  // Work Contacts
  { id: 'c001', name: 'Sarah Chen', content: 'Product Manager at TechCorp\nEmail: sarah.chen@techcorp.com\nPhone: (555) 123-4567', folder: 'Work', tags: ['colleague', 'product'], priority: 4, createdDaysAgo: 30, company: 'TechCorp', email: 'sarah.chen@techcorp.com', phone: '(555) 123-4567' },
  { id: 'c002', name: 'Mike Rodriguez', content: 'Senior Developer\nSlack: @mike.r\nNotes: Go expert, loves hiking', folder: 'Work', tags: ['colleague', 'engineering'], priority: 3, createdDaysAgo: 45, company: 'TechCorp', email: 'mike.r@techcorp.com' },
  { id: 'c003', name: 'Dr. Emily Watson', content: 'CTO at StartupXYZ\nLinkedIn: linkedin.com/in/emilywatson\nMet at DevConf 2024', folder: 'Work', tags: ['networking', 'CTO'], priority: 5, createdDaysAgo: 120, company: 'StartupXYZ', email: 'emily@startupxyz.com' },
  { id: 'c004', name: 'James Liu', content: 'Design Lead\nPortfolio: jamesdesigns.com\nSpecializes in UX research', folder: 'Work', tags: ['colleague', 'design'], priority: 3, createdDaysAgo: 60, company: 'TechCorp', email: 'j.liu@techcorp.com' },
  { id: 'c005', name: 'Alex Thompson', content: 'Sales Director\nGreat at closing enterprise deals\nIntroduced us to 3 major clients', folder: 'Work', tags: ['colleague', 'sales'], priority: 4, createdDaysAgo: 90, company: 'TechCorp', email: 'a.thompson@techcorp.com', phone: '(555) 234-5678' },

  // Personal Contacts
  { id: 'c006', name: 'Mom', content: 'Susan Johnson\nHome: (555) 987-6543\nBirthday: March 15th', folder: 'Family', tags: ['family', 'important'], priority: 5, createdDaysAgo: 365, phone: '(555) 987-6543' },
  { id: 'c007', name: 'David Best Friend', content: 'College roommate\nLives in Seattle now\nWorks at Microsoft', folder: 'Friends', tags: ['friend', 'college'], priority: 4, createdDaysAgo: 180, company: 'Microsoft', email: 'david.seattle@gmail.com' },
  { id: 'c008', name: 'Dr. Jennifer Park', content: 'Family Doctor\nPhone: (555) 456-7890\nAddress: 123 Medical Plaza', folder: 'Healthcare', tags: ['doctor', 'healthcare'], priority: 3, createdDaysAgo: 90, phone: '(555) 456-7890' },
  { id: 'c009', name: 'Lisa Garcia', content: 'Yoga Instructor\nStudio: Zen Wellness\nClasses: Tuesday/Thursday 7pm', folder: 'Health', tags: ['fitness', 'yoga'], priority: 2, createdDaysAgo: 30, email: 'lisa@zenwellness.com' },
  { id: 'c010', name: 'Tom Handyman', content: 'Home Repairs\nVery reliable, fair prices\nSpecializes in plumbing/electrical', folder: 'Services', tags: ['handyman', 'reliable'], priority: 3, createdDaysAgo: 200, phone: '(555) 321-9876' },

  // Business Contacts
  { id: 'c011', name: 'Maria Consultant', content: 'Business Strategy Consultant\nHelped with Q3 planning\nRates: $200/hour', folder: 'Business', tags: ['consultant', 'strategy'], priority: 4, createdDaysAgo: 75, company: 'Strategic Solutions LLC', email: 'maria@strategicsolutions.com' },
  { id: 'c012', name: 'Robert Lawyer', content: 'Corporate Attorney\nSpecializes in tech startups\nRetainer: $5000/month', folder: 'Legal', tags: ['lawyer', 'corporate'], priority: 4, createdDaysAgo: 120, company: 'Legal Partners LLP', email: 'robert@legalpartners.com', phone: '(555) 555-0123' },
];

// Safari Bookmark Data
interface SampleBookmark {
  id: string;
  name: string;
  content: string;
  folder: string;
  tags: string[];
  priority: number;
  createdDaysAgo: number;
  url?: string;
  domain?: string;
}

const SAMPLE_BOOKMARKS: SampleBookmark[] = [
  // Development Resources
  { id: 'b001', name: 'React Documentation', content: 'Official React docs\nhttps://react.dev\nBookmarked for quick reference during development', folder: 'Development', tags: ['react', 'documentation'], priority: 5, createdDaysAgo: 10, url: 'https://react.dev', domain: 'react.dev' },
  { id: 'b002', name: 'TypeScript Handbook', content: 'Comprehensive TypeScript guide\nhttps://www.typescriptlang.org/docs\nGreat for advanced type patterns', folder: 'Development', tags: ['typescript', 'documentation'], priority: 5, createdDaysAgo: 25, url: 'https://www.typescriptlang.org/docs', domain: 'typescriptlang.org' },
  { id: 'b003', name: 'D3.js Gallery', content: 'Beautiful D3 visualization examples\nhttps://observablehq.com/@d3/gallery\nInspiration for data viz projects', folder: 'Development', tags: ['d3', 'visualization', 'inspiration'], priority: 4, createdDaysAgo: 5, url: 'https://observablehq.com/@d3/gallery', domain: 'observablehq.com' },
  { id: 'b004', name: 'GitHub - Isometry Repo', content: 'Main project repository\nhttps://github.com/user/isometry\nCentral development hub', folder: 'Development', tags: ['github', 'project'], priority: 5, createdDaysAgo: 1, url: 'https://github.com/user/isometry', domain: 'github.com' },
  { id: 'b005', name: 'Stack Overflow - SQLite Performance', content: 'Optimizing SQLite queries\nhttps://stackoverflow.com/questions/1711631/improve-insert-per-second-performance\nUseful for database optimization', folder: 'Development', tags: ['sqlite', 'performance'], priority: 3, createdDaysAgo: 15, url: 'https://stackoverflow.com/questions/1711631/improve-insert-per-second-performance', domain: 'stackoverflow.com' },

  // Design & Inspiration
  { id: 'b006', name: 'Dribbble - Data Visualizations', content: 'Beautiful data viz designs\nhttps://dribbble.com/tags/data_visualization\nDesign inspiration for dashboards', folder: 'Design', tags: ['design', 'inspiration', 'dataviz'], priority: 3, createdDaysAgo: 8, url: 'https://dribbble.com/tags/data_visualization', domain: 'dribbble.com' },
  { id: 'b007', name: 'Figma Community', content: 'Free design resources\nhttps://www.figma.com/community\nComponents and design systems', folder: 'Design', tags: ['figma', 'resources'], priority: 4, createdDaysAgo: 20, url: 'https://www.figma.com/community', domain: 'figma.com' },
  { id: 'b008', name: 'Apple Human Interface Guidelines', content: 'macOS design principles\nhttps://developer.apple.com/design/human-interface-guidelines/macos\nFor native app design consistency', folder: 'Design', tags: ['apple', 'guidelines', 'macos'], priority: 4, createdDaysAgo: 35, url: 'https://developer.apple.com/design/human-interface-guidelines/macos', domain: 'developer.apple.com' },

  // News & Learning
  { id: 'b009', name: 'Hacker News', content: 'Tech news and discussions\nhttps://news.ycombinator.com\nDaily reading for tech trends', folder: 'News', tags: ['news', 'technology'], priority: 3, createdDaysAgo: 2, url: 'https://news.ycombinator.com', domain: 'news.ycombinator.com' },
  { id: 'b010', name: 'The Pragmatic Engineer', content: 'Engineering management blog\nhttps://blog.pragmaticengineer.com\nGreat insights on engineering culture', folder: 'Learning', tags: ['engineering', 'management', 'blog'], priority: 4, createdDaysAgo: 12, url: 'https://blog.pragmaticengineer.com', domain: 'blog.pragmaticengineer.com' },
  { id: 'b011', name: 'Mozilla Developer Network', content: 'Web development reference\nhttps://developer.mozilla.org\nComprehensive web API documentation', folder: 'Development', tags: ['mdn', 'documentation', 'web'], priority: 5, createdDaysAgo: 40, url: 'https://developer.mozilla.org', domain: 'developer.mozilla.org' },

  // Personal & Lifestyle
  { id: 'b012', name: 'Recipe: Homemade Pasta', content: 'Simple pasta recipe\nhttps://www.seriouseats.com/fresh-pasta-recipe\nBookmarked for weekend cooking', folder: 'Recipes', tags: ['cooking', 'pasta', 'recipe'], priority: 2, createdDaysAgo: 7, url: 'https://www.seriouseats.com/fresh-pasta-recipe', domain: 'seriouseats.com' },
  { id: 'b013', name: 'Local Weather', content: 'Weather forecast\nhttps://weather.com/weather/today\nDaily weather check', folder: 'Utilities', tags: ['weather', 'daily'], priority: 1, createdDaysAgo: 1, url: 'https://weather.com/weather/today', domain: 'weather.com' },
  { id: 'b014', name: 'Netflix - Continue Watching', content: 'Streaming service\nhttps://netflix.com/browse\nEvening entertainment', folder: 'Entertainment', tags: ['streaming', 'movies'], priority: 1, createdDaysAgo: 3, url: 'https://netflix.com/browse', domain: 'netflix.com' },
];

// Combine all data types into a unified dataset
function generateAllData(): SampleNote[] {
  const notes = generateAllNotes();

  // Convert contacts to note format for unified interface
  const contactsAsNotes = SAMPLE_CONTACTS.map(contact => ({
    id: contact.id,
    name: contact.name,
    content: contact.content,
    folder: contact.folder,
    tags: contact.tags,
    priority: contact.priority,
    createdDaysAgo: contact.createdDaysAgo
  }));

  // Convert bookmarks to note format for unified interface
  const bookmarksAsNotes = SAMPLE_BOOKMARKS.map(bookmark => ({
    id: bookmark.id,
    name: bookmark.name,
    content: bookmark.content,
    folder: bookmark.folder,
    tags: bookmark.tags,
    priority: bookmark.priority,
    createdDaysAgo: bookmark.createdDaysAgo
  }));

  // Combine all types: 100 notes + 12 contacts + 14 bookmarks = 126 total
  return [...notes, ...contactsAsNotes, ...bookmarksAsNotes];
}

const ALL_NODES = generateAllData();

export const SAMPLE_DATA_SQL = ALL_NODES.map(node => {
  // Determine node type from ID prefix
  let nodeType = 'note';
  if (node.id.startsWith('c')) nodeType = 'contact';
  if (node.id.startsWith('b')) nodeType = 'bookmark';

  return `
INSERT INTO nodes (id, node_type, name, content, folder, tags, priority, created_at, modified_at)
VALUES (
  '${node.id}',
  '${nodeType}',
  '${escapeSql(node.name)}',
  '${escapeSql(node.content)}',
  '${node.folder}',
  '${JSON.stringify(node.tags)}',
  ${node.priority},
  '${generateDate(node.createdDaysAgo)}',
  '${generateDate(Math.max(0, node.createdDaysAgo - Math.floor(Math.random() * 3)))}'
);`;
}).join('\n');

export { ALL_NODES as SAMPLE_NOTES };
