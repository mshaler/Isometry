// Isometry v5 — Phase 3 Connection Handlers
// Thin wrappers around v0.1 connection query functions.

import type { Database } from '../../database/Database';
import * as connections from '../../database/queries/connections';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Handle connection:create request.
 * Creates a new connection between two cards.
 */
export function handleConnectionCreate(
  db: Database,
  payload: WorkerPayloads['connection:create']
): WorkerResponses['connection:create'] {
  return connections.createConnection(db, payload.input);
}

/**
 * Handle connection:get request.
 * Returns connections for a card filtered by direction.
 */
export function handleConnectionGet(
  db: Database,
  payload: WorkerPayloads['connection:get']
): WorkerResponses['connection:get'] {
  return connections.getConnections(db, payload.cardId, payload.direction);
}

/**
 * Handle connection:delete request.
 * Hard-deletes a connection.
 */
export function handleConnectionDelete(
  db: Database,
  payload: WorkerPayloads['connection:delete']
): WorkerResponses['connection:delete'] {
  connections.deleteConnection(db, payload.id);
}
