// Isometry v5 — Phase 4 Mutation Types Tests
// Tests for MutationCommand and Mutation interfaces.

import { describe, it, expect } from 'vitest';
import type { MutationCommand, Mutation } from '../../src/mutations/types';

describe('MutationCommand', () => {
  it('has sql and params fields', () => {
    const cmd: MutationCommand = {
      sql: 'DELETE FROM cards WHERE id = ?',
      params: ['some-uuid'],
    };
    expect(cmd.sql).toBe('DELETE FROM cards WHERE id = ?');
    expect(cmd.params).toEqual(['some-uuid']);
  });

  it('params can hold mixed types', () => {
    const cmd: MutationCommand = {
      sql: 'INSERT INTO cards (id, priority, is_collective) VALUES (?, ?, ?)',
      params: ['uuid', 1, 0],
    };
    expect(cmd.params).toHaveLength(3);
  });
});

describe('Mutation', () => {
  it('has required fields: id, timestamp, description, forward, inverse', () => {
    const mutation: Mutation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      description: 'Create card Test',
      forward: [{ sql: 'INSERT INTO cards (id) VALUES (?)', params: ['id1'] }],
      inverse: [{ sql: 'DELETE FROM cards WHERE id = ?', params: ['id1'] }],
    };
    expect(mutation.id).toBeTypeOf('string');
    expect(mutation.timestamp).toBeTypeOf('number');
    expect(mutation.description).toBeTypeOf('string');
    expect(Array.isArray(mutation.forward)).toBe(true);
    expect(Array.isArray(mutation.inverse)).toBe(true);
  });

  it('forward and inverse are arrays of MutationCommand', () => {
    const mutation: Mutation = {
      id: 'test-id',
      timestamp: 0,
      description: 'test',
      forward: [
        { sql: 'UPDATE cards SET name = ? WHERE id = ?', params: ['New', 'id1'] },
        { sql: 'UPDATE cards SET status = ? WHERE id = ?', params: ['active', 'id1'] },
      ],
      inverse: [
        { sql: 'UPDATE cards SET status = ? WHERE id = ?', params: ['open', 'id1'] },
        { sql: 'UPDATE cards SET name = ? WHERE id = ?', params: ['Old', 'id1'] },
      ],
    };
    expect(mutation.forward).toHaveLength(2);
    expect(mutation.inverse).toHaveLength(2);
  });
});
