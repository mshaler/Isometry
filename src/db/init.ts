// REMOVED: This file previously handled sql.js initialization
// SQL.js has been completely removed from the codebase
//
// The DatabaseProvider component automatically selects the appropriate provider:
// - WebView: MessageHandler bridge to native IsometryDatabase
// - Development: HTTP API to native server

// Legacy exports throw errors to prevent usage
export async function initDatabase(): Promise<never> {
  throw new Error(
    'Legacy sql.js initialization has been removed. Use DatabaseProvider component for automatic database provider selection.'
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