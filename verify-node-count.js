// Quick verification script to check sample data node count
import { SAMPLE_NOTES } from './src/db/sample-data.ts';

console.log('🔢 Sample Data Verification:');
console.log('Total nodes:', SAMPLE_NOTES.length);

// Count by type (based on ID prefix)
const nodeTypes = {
  notes: SAMPLE_NOTES.filter(n => n.id.startsWith('n')).length,
  contacts: SAMPLE_NOTES.filter(n => n.id.startsWith('c')).length,
  bookmarks: SAMPLE_NOTES.filter(n => n.id.startsWith('b')).length,
};

console.log('By type:', nodeTypes);
console.log('Expected total: 126 (100 notes + 12 contacts + 14 bookmarks)');
console.log('Actual total:', Object.values(nodeTypes).reduce((a, b) => a + b, 0));

// Show sample of each type
console.log('\nSample nodes:');
console.log('- First note:', SAMPLE_NOTES.find(n => n.id.startsWith('n'))?.name);
console.log('- First contact:', SAMPLE_NOTES.find(n => n.id.startsWith('c'))?.name);
console.log('- First bookmark:', SAMPLE_NOTES.find(n => n.id.startsWith('b'))?.name);