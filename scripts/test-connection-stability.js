#!/usr/bin/env node
/**
 * Connection Stability Test
 *
 * Test if WebSocket connection remains stable without any command execution.
 */

import { WebSocketClaudeCodeDispatcher } from '../src/services/claudeCodeWebSocketDispatcher.ts';

async function testConnectionStability() {
  console.log('🧪 Testing WebSocket connection stability...');

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

    // Check connection status periodically
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isConnected = dispatcher.isConnected();
      console.log(`🔍 ${i + 1}s: Connected = ${isConnected}`);

      if (!isConnected) {
        console.log('❌ Connection lost!');
        break;
      }
    }

    console.log('✅ Connection stability test completed');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    console.log('🔌 Disconnecting...');
    dispatcher.disconnect();
  }
}

testConnectionStability();