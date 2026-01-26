// MIGRATION COMPLETED: This file previously handled sql.js initialization
// All database operations now use native GRDB through WebView bridge or HTTP API
//
// The DatabaseContext automatically selects the appropriate provider based on environment:
// - WebView: MessageHandler bridge to native IsometryDatabase
// - Development: HTTP API to native server
// - Legacy: No longer used (sql.js removed)

console.warn('src/db/init.ts: sql.js initialization deprecated. Use DatabaseContext with native providers.');

// Legacy exports for backward compatibility during transition
export async function initDatabase(): Promise<never> {
  throw new Error(
    'sql.js initialization deprecated. Use DatabaseContext with automatic provider selection.'
  );
}

export function getDatabase(): never {
  throw new Error(
    'Direct database access deprecated. Use useDatabase() hook for provider abstraction.'
  );
}

export async function saveDatabase(): Promise<void> {
  // Native providers handle persistence automatically
  console.log('Database persistence handled by native provider');
}

export async function resetDatabase(): Promise<never> {
  throw new Error(
    'Database reset must be done through native provider using useDatabase() hook.'
  );
}