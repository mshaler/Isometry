import { devLogger } from './dev-logger';

export interface EnvironmentConfig {
  isConfigured: boolean;
  hasAPIKey: boolean;
  isProduction: boolean;
  configurationStatus: string;
  apiKeySource?: 'ANTHROPIC_API_KEY' | 'VITE_ANTHROPIC_API_KEY';
}

/**
 * Validates if the Anthropic API key is properly configured
 */
export function validateAPIKey(): boolean {
  const apiKey = getAPIKey();

  if (!apiKey) {
    return false;
  }

  // Check if API key has valid format
  if (!apiKey.startsWith('sk-ant-')) {
    console.warn('API key does not match expected Anthropic format');
    return false;
  }

  // Basic length check (Anthropic keys are typically around 108 characters)
  if (apiKey.length < 50) {
    console.warn('API key appears to be too short');
    return false;
  }

  return true;
}

/**
 * Gets the API key from environment variables, checking multiple sources
 */
function getAPIKey(): string | undefined {
  // In development, Vite exposes variables prefixed with VITE_
  const viteKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (viteKey) {
    return viteKey;
  }

  // Fallback to Node.js environment (if available)
  try {
    const nodeKey = (globalThis as { process?: { env?: { ANTHROPIC_API_KEY?: string } } })
      .process?.env?.ANTHROPIC_API_KEY;
    if (nodeKey) {
      return nodeKey;
    }
  } catch {
    // process is not available in browser environment
  }

  return undefined;
}

/**
 * Returns comprehensive environment configuration status
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const apiKey = getAPIKey();
  const hasAPIKey = !!apiKey;
  const isValidKey = hasAPIKey && validateAPIKey();
  const isProduction = import.meta.env.PROD || false;

  let configurationStatus = '';
  let apiKeySource: 'ANTHROPIC_API_KEY' | 'VITE_ANTHROPIC_API_KEY' | undefined;

  if (!hasAPIKey) {
    configurationStatus = 'No API key found';
  } else if (!isValidKey) {
    configurationStatus = 'Invalid API key format';
  } else {
    configurationStatus = 'API key configured';
    // Determine source
    if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
      apiKeySource = 'VITE_ANTHROPIC_API_KEY';
    } else {
      apiKeySource = 'ANTHROPIC_API_KEY';
    }
  }

  return {
    isConfigured: isValidKey,
    hasAPIKey,
    isProduction,
    configurationStatus,
    apiKeySource
  };
}

/**
 * Returns step-by-step setup instructions for configuring the API key
 */
export function setupEnvironmentInstructions(): string[] {
  const config = getEnvironmentConfig();

  if (config.isConfigured) {
    return [
      '✅ Claude API is properly configured',
      `📍 Using key from: ${config.apiKeySource}`,
      '',
      'You can now use Claude commands in the terminal!'
    ];
  }

  const instructions = [
    '🔧 Claude API Setup Required',
    '',
    '1. Visit the Anthropic Console:',
    '   https://console.anthropic.com/account/keys',
    '',
    '2. Create a new API key:',
    '   - Click "Create Key"',
    '   - Give it a descriptive name (e.g., "Isometry Dev")',
    '   - Copy the key (starts with sk-ant-)',
    '',
    '3. Set the environment variable:'
  ];

  if (config.isProduction) {
    instructions.push(
      '   export ANTHROPIC_API_KEY=sk-ant-your-key-here',
      '',
      '4. Restart your application'
    );
  } else {
    instructions.push(
      '   export VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here',
      '   (or add to your .env file: VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here)',
      '',
      '4. Restart your development server:',
      '   npm run dev'
    );
  }

  instructions.push(
    '',
    '⚠️  Security Note:',
    '   This demo exposes the API key in the browser.',
    '   In production, route API calls through your backend server.',
    '',
    '💡 Tip: You can also create a .env file in your project root'
  );

  if (config.hasAPIKey && !config.isConfigured) {
    instructions.push(
      '',
      '❌ Current Issue:',
      '   API key found but invalid format.',
      '   Ensure it starts with "sk-ant-" and is complete.'
    );
  }

  return instructions;
}

/**
 * Determines if the application is running in production mode
 */
export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD || false;
}

/**
 * Logs configuration status to console (for debugging)
 */
export function logEnvironmentStatus(): void {
  const config = getEnvironmentConfig();

  devLogger.debug('Claude API Environment Status', {
    configured: config.isConfigured,
    hasKey: config.hasAPIKey,
    status: config.configurationStatus,
    source: config.apiKeySource,
    isProduction: config.isProduction
  });

  if (!config.isConfigured) {
    devLogger.setup('Setup Instructions', {});
    setupEnvironmentInstructions().forEach(instruction => console.log(instruction));
  }
}