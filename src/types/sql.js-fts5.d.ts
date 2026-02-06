/**
 * Type declarations for sql.js-fts5
 * Uses same interface as sql.js but with FTS5 support
 */
declare module 'sql.js-fts5' {
  import type { Database as SqlDatabase, SqlJsStatic as SqlStatic, SqlJsConfig } from 'sql.js';

  export type Database = SqlDatabase;
  export type SqlJsStatic = SqlStatic;
  export type Config = SqlJsConfig;

  interface InitSqlJsStatic extends SqlStatic {
    (config?: SqlJsConfig): Promise<SqlStatic>;
  }

  declare const initSqlJs: InitSqlJsStatic;
  export default initSqlJs;
}