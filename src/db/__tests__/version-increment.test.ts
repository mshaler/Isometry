/**
 * Version Increment Trigger Tests
 *
 * Tests verify that the increment_version_on_update trigger:
 * 1. Automatically increments version on UPDATE
 * 2. Works for any column update (name, position, etc.)
 * 3. Respects manually set versions
 * 4. Starts at version 1 for new nodes
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Version Increment Trigger', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    // Initialize sql.js with WASM
    SQL = await initSqlJs({
      locateFile: (file: string) => `public/wasm/${file}`
    });

    db = new SQL.Database();

    // Load schema from file
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSQL);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  test('should start nodes at version 1', () => {
    // Insert a new node
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-1', 'Test Node', datetime('now'), datetime('now'))`
    );

    // Verify version is 1
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-1'`);
    expect(result).toHaveLength(1);
    expect(result[0].values[0][0]).toBe(1);
  });

  test('should increment version on name update', () => {
    // Insert a node
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-2', 'Original Name', datetime('now'), datetime('now'))`
    );

    // Verify initial version
    let result = db.exec(`SELECT version FROM nodes WHERE id = 'test-2'`);
    expect(result[0].values[0][0]).toBe(1);

    // Update the name
    db.run(`UPDATE nodes SET name = 'Updated Name' WHERE id = 'test-2'`);

    // Verify version incremented to 2
    result = db.exec(`SELECT version FROM nodes WHERE id = 'test-2'`);
    expect(result[0].values[0][0]).toBe(2);
  });

  test('should increment version on position update', () => {
    // Insert a node
    db.run(
      `INSERT INTO nodes (id, name, grid_x, grid_y, created_at, modified_at)
       VALUES ('test-3', 'Position Test', 0, 0, datetime('now'), datetime('now'))`
    );

    // Update position
    db.run(`UPDATE nodes SET grid_x = 100, grid_y = 200 WHERE id = 'test-3'`);

    // Verify version incremented to 2
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-3'`);
    expect(result[0].values[0][0]).toBe(2);
  });

  test('should increment version on each update', () => {
    // Insert a node
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-4', 'Multiple Updates', datetime('now'), datetime('now'))`
    );

    // Multiple updates
    db.run(`UPDATE nodes SET name = 'Update 1' WHERE id = 'test-4'`);
    db.run(`UPDATE nodes SET name = 'Update 2' WHERE id = 'test-4'`);
    db.run(`UPDATE nodes SET name = 'Update 3' WHERE id = 'test-4'`);

    // Verify version is 4 (initial 1 + 3 updates)
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-4'`);
    expect(result[0].values[0][0]).toBe(4);
  });

  test('should respect manually set version', () => {
    // Insert a node
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-5', 'Manual Version', datetime('now'), datetime('now'))`
    );

    // Manually set version to 10
    db.run(`UPDATE nodes SET name = 'Updated', version = 10 WHERE id = 'test-5'`);

    // Version should be 10, not auto-incremented
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-5'`);
    expect(result[0].values[0][0]).toBe(10);
  });

  test('should increment version on content update', () => {
    // Insert a node with content
    db.run(
      `INSERT INTO nodes (id, name, content, created_at, modified_at)
       VALUES ('test-6', 'Content Test', 'Original content', datetime('now'), datetime('now'))`
    );

    // Update content
    db.run(`UPDATE nodes SET content = 'Updated content' WHERE id = 'test-6'`);

    // Verify version incremented
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-6'`);
    expect(result[0].values[0][0]).toBe(2);
  });

  test('should increment version on status update', () => {
    // Insert a node with status
    db.run(
      `INSERT INTO nodes (id, name, status, created_at, modified_at)
       VALUES ('test-7', 'Status Test', 'active', datetime('now'), datetime('now'))`
    );

    // Update status
    db.run(`UPDATE nodes SET status = 'completed' WHERE id = 'test-7'`);

    // Verify version incremented
    const result = db.exec(`SELECT version FROM nodes WHERE id = 'test-7'`);
    expect(result[0].values[0][0]).toBe(2);
  });

  test('should not affect other nodes when updating one node', () => {
    // Insert two nodes
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-8a', 'Node A', datetime('now'), datetime('now'))`
    );
    db.run(
      `INSERT INTO nodes (id, name, created_at, modified_at)
       VALUES ('test-8b', 'Node B', datetime('now'), datetime('now'))`
    );

    // Update only Node A
    db.run(`UPDATE nodes SET name = 'Updated A' WHERE id = 'test-8a'`);

    // Verify Node A version is 2
    let result = db.exec(`SELECT version FROM nodes WHERE id = 'test-8a'`);
    expect(result[0].values[0][0]).toBe(2);

    // Verify Node B version is still 1
    result = db.exec(`SELECT version FROM nodes WHERE id = 'test-8b'`);
    expect(result[0].values[0][0]).toBe(1);
  });

  test('trigger should exist in schema', () => {
    // Verify the trigger exists
    const result = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger' AND name = 'increment_version_on_update'
    `);

    expect(result).toHaveLength(1);
    expect(result[0].values).toHaveLength(1);
    expect(result[0].values[0][0]).toBe('increment_version_on_update');
  });
});
