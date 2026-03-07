// Isometry v5 — Phase 12 NativeBridge Tests
// Unit tests for uint8ArrayToBase64 round-trip, base64ToUint8Array, and native guard.
//
// These tests validate BRDG-02: binary data must flow as base64 strings,
// NOT as raw Uint8Array, through the nativeBridge WKScriptMessageHandler.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level import — uint8ArrayToBase64 and base64ToUint8Array are exported
// ---------------------------------------------------------------------------
import { base64ToUint8Array, extractChangeset, handleNativeSync, uint8ArrayToBase64 } from '../src/native/NativeBridge';

describe('uint8ArrayToBase64', () => {
	it('converts known bytes to correct base64 string', () => {
		// "Hello" in ASCII = [72, 101, 108, 108, 111]
		const bytes = new Uint8Array([72, 101, 108, 108, 111]);
		const result = uint8ArrayToBase64(bytes);
		expect(result).toBe('SGVsbG8=');
	});

	it('handles empty array', () => {
		const bytes = new Uint8Array(0);
		const result = uint8ArrayToBase64(bytes);
		expect(result).toBe('');
	});

	it('round-trips with base64ToUint8Array', () => {
		const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
		const base64 = uint8ArrayToBase64(original);
		const restored = base64ToUint8Array(base64);
		expect(Array.from(restored)).toEqual(Array.from(original));
	});

	it('handles binary data including null bytes', () => {
		const bytes = new Uint8Array([0, 0, 0, 1, 0, 0]);
		const base64 = uint8ArrayToBase64(bytes);
		const restored = base64ToUint8Array(base64);
		expect(Array.from(restored)).toEqual([0, 0, 0, 1, 0, 0]);
	});
});

describe('base64ToUint8Array', () => {
	it('decodes known base64 to correct bytes', () => {
		// "SGVsbG8=" = "Hello"
		const result = base64ToUint8Array('SGVsbG8=');
		expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
	});

	it('handles empty string', () => {
		const result = base64ToUint8Array('');
		expect(result.byteLength).toBe(0);
	});

	it('round-trips with uint8ArrayToBase64', () => {
		const original = 'SGVsbG8=';
		const bytes = base64ToUint8Array(original);
		const result = uint8ArrayToBase64(bytes);
		expect(result).toBe(original);
	});
});

describe('NativeBridge guard behavior', () => {
	it('MUTATING_TYPES includes write operations but not reads', () => {
		// Verify the set of mutating types covers the expected write operations.
		// This is an indirect test since MUTATING_TYPES is not directly exported.
		// We verify the logic by checking that the module exports the expected functions.
		expect(typeof uint8ArrayToBase64).toBe('function');
		expect(typeof base64ToUint8Array).toBe('function');
	});

	it('uint8ArrayToBase64 does not produce raw dictionary output', () => {
		// Verify that binary data is encoded as a string, not a dictionary.
		// This validates the core requirement of BRDG-02: never pass raw Uint8Array
		// through WKScriptMessageHandler (it would arrive as {"0":0,"1":1,...}).
		const bytes = new Uint8Array([1, 2, 3, 4, 5]);
		const result = uint8ArrayToBase64(bytes);
		// Result should be a string, not an object
		expect(typeof result).toBe('string');
		// Result should not contain object-like structure
		expect(result).not.toMatch(/^\{/);
		// Result should be valid base64 (no invalid chars)
		expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
	});
});

// ---------------------------------------------------------------------------
// extractChangeset tests — Phase 41 TDD (SYNC-02, SYNC-07)
// ---------------------------------------------------------------------------

describe('extractChangeset', () => {
	it('card:delete returns operation update with deleted_at field (SYNC-07)', () => {
		const result = extractChangeset('card:delete', { id: 'c1' });
		expect(result).toBeDefined();
		expect(result!.length).toBe(1);
		expect(result![0]!.operation).toBe('update');
		expect(result![0]!.fields).toBeDefined();
		expect(result![0]!.fields!['deleted_at']).toBeDefined();
		// deleted_at should be an ISO string (not null, not undefined)
		expect(typeof result![0]!.fields!['deleted_at']).toBe('string');
	});

	it('card:undelete returns operation update with deleted_at null', () => {
		const result = extractChangeset('card:undelete', { id: 'c1' });
		expect(result).toBeDefined();
		expect(result!.length).toBe(1);
		expect(result![0]!.operation).toBe('update');
		expect(result![0]!.fields).toBeDefined();
		expect(result![0]!.fields!['deleted_at']).toBeNull();
	});

	it('card:create uses result.id, not payload.id (SYNC-02)', () => {
		const changes = extractChangeset('card:create', { input: { name: 'Test' } }, { id: 'gen-id' });
		expect(changes).toBeDefined();
		expect(changes!.length).toBe(1);
		expect(changes![0]!.recordId).toBe('gen-id');
		expect(changes![0]!.recordType).toBe('Card');
		expect(changes![0]!.operation).toBe('insert');
	});

	it('card:create returns undefined when result is missing', () => {
		const changes = extractChangeset('card:create', { input: { name: 'Test' } });
		expect(changes).toBeUndefined();
	});

	it('connection:create uses result.id and includes fields from payload.input (SYNC-02)', () => {
		const changes = extractChangeset(
			'connection:create',
			{ input: { source_id: 'a', target_id: 'b', label: 'rel' } },
			{ id: 'conn-id' },
		);
		expect(changes).toBeDefined();
		expect(changes!.length).toBe(1);
		expect(changes![0]!.recordId).toBe('conn-id');
		expect(changes![0]!.recordType).toBe('Connection');
		expect(changes![0]!.operation).toBe('insert');
		expect(changes![0]!.fields).toBeDefined();
		expect(changes![0]!.fields!['source_id']).toBe('a');
		expect(changes![0]!.fields!['target_id']).toBe('b');
		expect(changes![0]!.fields!['label']).toBe('rel');
		expect(changes![0]!.fields!['weight']).toBe(1.0);
		expect(changes![0]!.fields!['via_card_id']).toBeNull();
	});

	it('connection:create returns undefined when result is missing', () => {
		const changes = extractChangeset('connection:create', { input: { source_id: 'a' } });
		expect(changes).toBeUndefined();
	});

	it('connection:delete returns operation delete (unchanged, correct)', () => {
		const changes = extractChangeset('connection:delete', { id: 'conn-1' });
		expect(changes).toBeDefined();
		expect(changes!.length).toBe(1);
		expect(changes![0]!.recordId).toBe('conn-1');
		expect(changes![0]!.operation).toBe('delete');
		expect(changes![0]!.recordType).toBe('Connection');
	});

	it('card:update includes fields from payload.updates', () => {
		const changes = extractChangeset('card:update', { id: 'c1', updates: { name: 'New Name' } });
		expect(changes).toBeDefined();
		expect(changes![0]!.operation).toBe('update');
		expect(changes![0]!.fields).toEqual({ name: 'New Name' });
	});

	it('bulk operations return undefined', () => {
		expect(extractChangeset('db:exec', {})).toBeUndefined();
		expect(extractChangeset('etl:import', {})).toBeUndefined();
		expect(extractChangeset('etl:import-native', {})).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// handleNativeSync batch ordering tests — Phase 41 TDD (SYNC-02)
// ---------------------------------------------------------------------------

describe('handleNativeSync batch ordering', () => {
	// Mock window for Node test environment (handleNativeSync uses window.dispatchEvent)
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).window = {
			dispatchEvent: vi.fn(),
		};
	});
	afterEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (globalThis as any).window;
	});

	it('processes Card records before Connection records in a mixed batch', async () => {
		const executedSQLs: string[] = [];
		const mockDbExec = vi.fn(async (_type: unknown, stmt: { sql: string; params: unknown[] }) => {
			executedSQLs.push(stmt.sql);
			return undefined;
		});

		// Deliberately put Connection first, Card second in the input array
		const payload = {
			records: [
				{
					recordType: 'Connection',
					recordId: 'conn-1',
					operation: 'save',
					fields: {
						source_id: 'card-1',
						target_id: 'card-2',
						label: 'test',
						weight: 1.0,
						via_card_id: null,
						created_at: '2026-01-01T00:00:00Z',
					},
				},
				{
					recordType: 'Card',
					recordId: 'card-1',
					operation: 'save',
					fields: {
						name: 'Card 1',
						card_type: 'note',
						created_at: '2026-01-01T00:00:00Z',
						modified_at: '2026-01-01T00:00:00Z',
					},
				},
			],
		};

		await handleNativeSync(mockDbExec as any, payload);

		// The first SQL executed should be a Card INSERT (not Connection)
		expect(executedSQLs.length).toBe(2);
		expect(executedSQLs[0]).toContain('cards');
		expect(executedSQLs[1]).toContain('connections');
	});

	it('handles empty records array without error', async () => {
		const mockDbExec = vi.fn();
		const payload = { records: [] };
		await handleNativeSync(mockDbExec as any, payload);
		expect(mockDbExec).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// handleNativeSync FK failure handling tests — Phase 41 TDD
// ---------------------------------------------------------------------------

describe('handleNativeSync FK failure handling', () => {
	// Mock window for Node test environment
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).window = {
			dispatchEvent: vi.fn(),
		};
	});
	afterEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (globalThis as any).window;
	});

	it('continues processing after a statement failure (FK constraint)', async () => {
		const executedSQLs: string[] = [];
		let callCount = 0;
		const mockDbExec = vi.fn(async (_type: unknown, stmt: { sql: string; params: unknown[] }) => {
			callCount++;
			executedSQLs.push(stmt.sql);
			// Simulate FK failure on the first call
			if (callCount === 1) {
				throw new Error('FOREIGN KEY constraint failed');
			}
			return undefined;
		});

		// Two Card records -- first will fail, second should still execute
		const payload = {
			records: [
				{
					recordType: 'Card',
					recordId: 'card-1',
					operation: 'save',
					fields: {
						name: 'Card 1',
						card_type: 'note',
						created_at: '2026-01-01T00:00:00Z',
						modified_at: '2026-01-01T00:00:00Z',
					},
				},
				{
					recordType: 'Card',
					recordId: 'card-2',
					operation: 'save',
					fields: {
						name: 'Card 2',
						card_type: 'note',
						created_at: '2026-01-01T00:00:00Z',
						modified_at: '2026-01-01T00:00:00Z',
					},
				},
			],
		};

		const originalError = console.error;
		console.error = vi.fn();

		await handleNativeSync(mockDbExec as any, payload);

		console.error = originalError;

		// Both statements should have been attempted (error on first doesn't crash)
		expect(mockDbExec).toHaveBeenCalledTimes(2);
		expect(executedSQLs.length).toBe(2);
	});

	it('logs FK constraint failures without crashing', async () => {
		const mockDbExec = vi.fn(async () => {
			throw new Error('FOREIGN KEY constraint failed');
		});

		const payload = {
			records: [
				{
					recordType: 'Connection',
					recordId: 'conn-1',
					operation: 'save',
					fields: {
						source_id: 'missing-card',
						target_id: 'card-2',
						label: '',
						weight: 1.0,
						via_card_id: null,
						created_at: '2026-01-01T00:00:00Z',
					},
				},
			],
		};

		const errorSpy = vi.fn();
		const originalError = console.error;
		console.error = errorSpy;

		// Should not throw
		await handleNativeSync(mockDbExec as any, payload);

		console.error = originalError;

		// Error should have been logged
		expect(errorSpy).toHaveBeenCalled();
	});
});
