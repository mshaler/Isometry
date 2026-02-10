#!/usr/bin/env node
/**
 * Single Connection Test
 *
 * Test WebSocket with a single, persistent connection to avoid multiple instances.
 */

import { WebSocketClaudeCodeDispatcher } from '../src/services/claudeCodeWebSocketDispatcher.ts';

async function testSingleConnection() {
  console.log('🧪 Testing single WebSocket connection...');

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
    // Connect once
    console.log('📡 Connecting to server...');
    await dispatcher.connect();
    console.log('🔗 Connected successfully');

    // Check connection status
    console.log('🔍 Connection status:', dispatcher.isConnected());

    // Execute command
    console.log('🚀 Starting echo command...');
    const execution = await dispatcher.executeAsync({
      command: 'echo',
      args: ['Hello from single connection!']
    });

    console.log(`📋 Execution started: ${execution.id}`);
    console.log(`📊 Initial status: ${execution.status}`);

    // Wait longer for completion
    console.log('⏳ Waiting for completion...');
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const current = dispatcher.getExecution(execution.id);
      if (current && current.status !== 'pending' && current.status !== 'running') {
        console.log(`📊 Final status: ${current.status}`);
        console.log(`📄 Output: ${current.output.join('\\n')}`);
        if (current.status === 'completed') {
          console.log('\n✅ Single connection test PASSED');
        } else {
          console.log('\n❌ Single connection test FAILED - status:', current.status);
        }
        return;
      }
    }

    console.log('\n❌ Single connection test FAILED - timeout');

  } catch (error) {
    console.error('\n❌ Single connection test FAILED:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    dispatcher.disconnect();
  }
}

testSingleConnection();