// Isometry v5 — Phase 4 Mutations Module
// Public re-exports for all mutation types, generators, and the MutationManager.

export type { MutationCommand, Mutation } from './types';
export {
  createCardMutation,
  updateCardMutation,
  deleteCardMutation,
  createConnectionMutation,
  deleteConnectionMutation,
  batchMutation,
} from './inverses';
export { MutationManager } from './MutationManager';
export type { MutationBridge } from './MutationManager';
export { setupMutationShortcuts } from './shortcuts';
