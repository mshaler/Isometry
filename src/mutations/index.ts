// Isometry v5 — Phase 4 Mutations Module
// Public re-exports for all mutation types, generators, and the MutationManager.

export {
	batchMutation,
	createCardMutation,
	createConnectionMutation,
	deleteCardMutation,
	deleteConnectionMutation,
	updateCardMutation,
} from './inverses';
export type { MutationBridge, UndoRedoToast } from './MutationManager';
export { MutationManager } from './MutationManager';
export { setupMutationShortcuts } from './shortcuts';
export type { Mutation, MutationCommand } from './types';
