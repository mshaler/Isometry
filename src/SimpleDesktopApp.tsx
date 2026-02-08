/**
 * Simplified Desktop Application for Tauri Testing
 * Minimal version to demonstrate desktop integration
 */

import React, { useState } from 'react';

// Simple inline button component to avoid imports
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <button
    className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);

export function SimpleDesktopApp() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState('Checking environment...');

  React.useEffect(() => {
    // Check if we're running in Tauri
    const checkTauriEnvironment = () => {
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        setIsDesktop(true);
        setStatus('✅ Running in Tauri Desktop Environment');
      } else {
        setIsDesktop(false);
        setStatus('🌐 Running in Web Browser');
      }
    };

    checkTauriEnvironment();
  }, []);

  const handleTestFileDialog = async () => {
    try {
      if (!isDesktop) {
        setStatus('❌ File dialogs only available in desktop mode');
        return;
      }

      // Try to invoke Tauri command
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('open_isometry_file');
      setStatus(`📁 File dialog result: ${result}`);
    } catch (error) {
      setStatus(`❌ Error: ${(error as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Isometry SuperGrid
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Desktop Application (Tauri Integration Test)
          </p>
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-sm">
            <span className="text-sm font-medium text-gray-700">{status}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Desktop Features</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className={isDesktop ? '✅' : '❌'} style={{ color: isDesktop ? 'green' : 'gray' }}>
                Native desktop environment
              </li>
              <li className={isDesktop ? '✅' : '❌'} style={{ color: isDesktop ? 'green' : 'gray' }}>
                File system access
              </li>
              <li className={isDesktop ? '✅' : '❌'} style={{ color: isDesktop ? 'green' : 'gray' }}>
                Native file dialogs
              </li>
              <li className={isDesktop ? '✅' : '❌'} style={{ color: isDesktop ? 'green' : 'gray' }}>
                Window management
              </li>
            </ul>

            <div className="mt-4">
              <Button onClick={handleTestFileDialog} disabled={!isDesktop}>
                Test File Dialog
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">SuperGrid Integration</h2>
            <p className="text-gray-600 mb-4">
              When complete, this will show the full SuperGrid interface with:
            </p>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• LATCH filtering (Location, Alphabet, Time, Category, Hierarchy)</li>
              <li>• PAFV spatial projection (Planes → Axes → Facets → Values)</li>
              <li>• Interactive data grid with sql.js backend</li>
              <li>• Three-canvas notebook integration</li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-3">Development Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="text-green-600">✅ Complete:</strong>
              <ul className="mt-1 space-y-1 text-gray-700">
                <li>• Tauri project initialization</li>
                <li>• Desktop environment detection</li>
                <li>• Basic window configuration</li>
                <li>• Rust backend setup</li>
              </ul>
            </div>
            <div>
              <strong className="text-yellow-600">🚧 In Progress:</strong>
              <ul className="mt-1 space-y-1 text-gray-700">
                <li>• File system integration</li>
                <li>• Native dialogs</li>
                <li>• sql.js WASM compatibility</li>
                <li>• SuperGrid integration</li>
              </ul>
            </div>
            <div>
              <strong className="text-blue-600">📋 Next:</strong>
              <ul className="mt-1 space-y-1 text-gray-700">
                <li>• Production builds</li>
                <li>• Code signing</li>
                <li>• Auto-updater</li>
                <li>• Multi-platform support</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This is a simplified test interface. The full SuperGrid application will replace this
            once TypeScript cleanup is complete.
          </p>
        </div>
      </div>
    </div>
  );
}