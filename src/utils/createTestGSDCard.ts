/**
 * Test utility to create sample GSD cards for validation
 */

import { nanoid } from 'nanoid';
import type { GSDSession, GSDExecutionResult } from '../types/gsd';
import type { GSDSession as GSDDbSession } from '../types/gsd/database';

export function createMockGSDSession(): GSDDbSession {
  const id = nanoid();
  return {
    id,
    session_name: `Test Session ${id.slice(0, 6)}`,
    session_type: 'execution',
    status: 'completed',
    project_node_id: null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function createMockGSDExecution(): GSDExecutionResult {
  return {
    success: true,
    phase: 'testing',
    output: 'Mock GSD execution completed successfully!\n\nThis is a test card to validate the GSD→Isometry integration.',
    filesChanged: ['src/utils/createTestGSDCard.ts', 'src/components/test/TestComponent.tsx'],
    duration: 15.3,
    testsRun: 8,
    testsPassed: 8,
    commitHash: 'abc123def'
  };
}

export function createMockCardData() {
  return {
    session: createMockGSDSession(),
    execution: createMockGSDExecution()
  };
}