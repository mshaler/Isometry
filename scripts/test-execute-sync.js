#!/usr/bin/env node
/**
 * Synchronous Execute Test
 *
 * Test the synchronous execute method which should wait for completion.
 */

import { WebSocketClaudeCodeDispatcher } from '../src/services/claudeCodeWebSocketDispatcher.ts';

async function testExecuteSync() {
  console.log('🧪 Testing synchronous command execution...');

  const dispatcher = new WebSocketClaudeCodeDispatcher('ws://localhost:8080', {
    onOutput: (output, executionId) => {
      console.log(`📤 [${executionId.substring(0, 8)}...] ${output.trim()}`);
    },
    onError: (error, executionId) => {
      console.log(`❌ [${executionId.substring(0, 8)}...] ERROR: ${error}`);
    },
    onComplete: (executionId) => {
      console.log(`✅ [${executionId.substring(0, 8)}...] COMPLETED`);
    }
  });

  try {
    console.log('📡 Connecting to server...');
    await dispatcher.connect();
    console.log('🔗 Connected successfully');

    console.log('🚀 Executing echo command synchronously...');

    // Use the synchronous execute method that waits for completion
    const result = await dispatcher.execute({
      command: 'echo',
      args: ['Hello synchronous execution!']
    });

    console.log('📋 Command completed!');
    console.log('📄 Result:', result);
    console.log('✅ Synchronous execute test PASSED');

  } catch (error) {
    console.error('❌ Synchronous execute test FAILED:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    dispatcher.disconnect();
  }
}

testExecuteSync();