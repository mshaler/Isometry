#!/usr/bin/env node
/**
 * Test WebSocket Integration
 *
 * Simple test script to verify the Claude Code WebSocket server
 * can be connected to and commands can be executed.
 */

import { createClaudeCodeDispatcher } from '../src/services/claudeCodeWebSocketDispatcher.ts';

async function testWebSocketIntegration() {
  console.log('🧪 Testing WebSocket integration...');

  try {
    // Create dispatcher (should auto-detect and connect to WebSocket server)
    console.log('📡 Creating Claude Code dispatcher...');
    const dispatcher = await createClaudeCodeDispatcher({
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

    console.log('🔗 Dispatcher created, testing connection...');

    // Test simple command
    console.log('\n🔍 Testing simple Claude Code command...');
    const result = await dispatcher.execute({
      command: 'claude',
      args: ['--help']
    });

    console.log('\n📋 Command output:');
    console.log(result);

    console.log('\n✅ WebSocket integration test PASSED');

  } catch (error) {
    console.error('\n❌ WebSocket integration test FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
testWebSocketIntegration();