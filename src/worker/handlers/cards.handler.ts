// Isometry v5 — Phase 3 Card Handlers
// Thin wrappers around v0.1 card query functions.
//
// These handlers receive payloads from the worker router and delegate
// to the existing query modules. No business logic here — that stays in v0.1.
//
// Usage: Import these in worker.ts as an alternative to inline handlers.
// Currently, worker.ts has handlers inline for simplicity, but this module
// is available for refactoring if handlers grow more complex.

import type { Database } from '../../database/Database';
import * as cards from '../../database/queries/cards';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Handle card:create request.
 * Creates a new card and returns the full Card object.
 */
export function handleCardCreate(
  db: Database,
  payload: WorkerPayloads['card:create']
): WorkerResponses['card:create'] {
  return cards.createCard(db, payload.input);
}

/**
 * Handle card:get request.
 * Returns the card or null if not found/deleted.
 */
export function handleCardGet(
  db: Database,
  payload: WorkerPayloads['card:get']
): WorkerResponses['card:get'] {
  return cards.getCard(db, payload.id);
}

/**
 * Handle card:update request.
 * Updates card fields and auto-updates modified_at.
 */
export function handleCardUpdate(
  db: Database,
  payload: WorkerPayloads['card:update']
): WorkerResponses['card:update'] {
  cards.updateCard(db, payload.id, payload.updates);
}

/**
 * Handle card:delete request.
 * Soft-deletes the card by setting deleted_at.
 */
export function handleCardDelete(
  db: Database,
  payload: WorkerPayloads['card:delete']
): WorkerResponses['card:delete'] {
  cards.deleteCard(db, payload.id);
}

/**
 * Handle card:undelete request.
 * Restores a soft-deleted card by clearing deleted_at.
 */
export function handleCardUndelete(
  db: Database,
  payload: WorkerPayloads['card:undelete']
): WorkerResponses['card:undelete'] {
  cards.undeleteCard(db, payload.id);
}

/**
 * Handle card:list request.
 * Returns filtered list of cards.
 */
export function handleCardList(
  db: Database,
  payload: WorkerPayloads['card:list']
): WorkerResponses['card:list'] {
  return cards.listCards(db, payload.options);
}
