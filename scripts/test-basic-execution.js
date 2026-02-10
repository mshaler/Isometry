#!/usr/bin/env node
/**
 * Basic Execution Test
 *
 * Test WebSocket integration with a simple echo command first.
 */

import { createClaudeCodeDispatcher } from '../src/services/claudeCodeWebSocketDispatcher.ts';

async function testBasicExecution() {
  console.log('🧪 Testing basic command execution...');

  try {
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

    console.log('🔗 Testing simple echo command...');

    // Test with a simple command that should work reliably
    const execution = await dispatcher.executeAsync({
      command: 'echo',
      args: ['Hello from WebSocket!']
    });

    console.log(`📋 Started execution: ${execution.id}`);

    // Wait a bit for the execution to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check final status
    const finalExecution = dispatcher.getExecution(execution.id);
    console.log(`📊 Final status: ${finalExecution?.status}`);
    console.log(`📄 Output: ${finalExecution?.output.join('\\n')}`);

    if (finalExecution?.status === 'completed') {
      console.log('\n✅ Basic execution test PASSED');
    } else {
      console.log('\n❌ Basic execution test FAILED - execution not completed');
    }

  } catch (error) {
    console.error('\n❌ Basic execution test FAILED:', error.message);
    process.exit(1);
  }
}

testBasicExecution();