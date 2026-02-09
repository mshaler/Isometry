import { useEffect, useState } from 'react';
import { useClaude } from './hooks/useClaude';
import { getEnvironmentConfig } from './utils/environmentSetup';

export function CLIIntegrationTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const claude = useClaude();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  useEffect(() => {
    const runTests = async () => {
      addResult('🧪 Starting CLI Integration Tests...');

      try {
        // Test 1: Environment setup
        addResult('📁 Testing environment setup...');
        const envConfig = getEnvironmentConfig();
        addResult(`CLI Available: ${envConfig.cliAvailable ? '✅ Available' : '❌ Not available'}`);
        addResult(`CLI Path: ${envConfig.cliPath || 'Not found'}`);
        addResult(`Configuration Status: ${envConfig.configurationStatus}`);

        // Test 2: Claude hook initialization
        addResult('🪝 Testing Claude hook...');
        if (claude) {
          addResult('✅ Claude hook initialized successfully');
          addResult(`Hook state: available=${claude.isAvailable}, processing=${claude.isProcessing}`);
          addResult(`CLI Path: ${claude.cliPath || 'Not set'}`);
          if (claude.lastError) {
            addResult(`Last Error: ${claude.lastError}`);
          }
        } else {
          addResult('❌ Claude hook failed to initialize');
        }

        // Test 3: Command execution simulation
        addResult('⚡ Testing command execution simulation...');
        if (claude && claude.executeClaudeCommand) {
          try {
            const result = await claude.executeClaudeCommand('test command');
            addResult(`Command result: ${result ? '✅ Success' : '❌ Failed'}`);
            if (result && typeof result === 'object' && 'output' in result) {
              addResult(`Output: ${result.output.substring(0, 100)}...`);
              addResult(`Success: ${result.success}`);
              addResult(`Duration: ${result.duration}ms`);
            }
          } catch (error) {
            addResult(`Command error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          addResult('❌ executeClaudeCommand not available');
        }

        // Test 4: CLI validation
        addResult('🔍 Testing CLI validation...');
        if (claude && claude.validateCLI) {
          const isValid = claude.validateCLI();
          addResult(`CLI validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        } else {
          addResult('❌ validateCLI not available');
        }

        // Test 5: Setup instructions
        addResult('📝 Testing setup instructions...');
        if (claude && claude.getSetupInstructions) {
          const instructions = claude.getSetupInstructions();
          addResult(`Setup instructions: ${instructions.length} steps`);
          instructions.slice(0, 2).forEach((instruction, i) => {
            addResult(`  ${i + 1}. ${instruction}`);
          });
        } else {
          addResult('❌ getSetupInstructions not available');
        }

        addResult('✅ CLI Integration Tests Complete');

      } catch (error) {
        addResult(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    runTests();
  }, [claude]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧪 CLI Integration Test</h1>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm min-h-[400px] overflow-y-auto">
        {testResults.map((result, index) => (
          <div key={index} className="mb-1">{result}</div>
        ))}
        {isLoading && <div className="animate-pulse">Running tests...</div>}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>This test validates:</p>
        <ul className="list-disc ml-4">
          <li>Environment setup utility functions</li>
          <li>Claude CLI detection and configuration</li>
          <li>Claude hook initialization and state</li>
          <li>Command execution simulation</li>
          <li>CLI validation and setup instructions</li>
        </ul>
      </div>
    </div>
  );
}