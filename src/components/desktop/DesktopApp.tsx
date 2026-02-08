/**
 * Desktop Application Layout - Main container for Tauri desktop app
 */

import { useState, useCallback } from 'react';
import { DesktopMenu } from './DesktopMenu';
import { SQLiteP0GateTest } from '../../SQLiteP0GateTest';
import { ThreeCanvasDemo } from '../ThreeCanvasDemo';
import { NotebookLayout } from '../notebook/NotebookLayout';
import { NotebookProvider } from '../../contexts/NotebookContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useIsDesktop } from '@/hooks/useTauri';

export type ViewMode = 'supergrid' | 'three-canvas' | 'p0-test' | 'welcome';

export function DesktopApp() {
  const [currentView, setCurrentView] = useState<ViewMode>('welcome');
  const isDesktop = useIsDesktop();

  const handleNewFile = useCallback(() => {
    // TODO: Implement new file creation
    console.log('New file requested');
    setCurrentView('p0-test'); // Start with P0 test for now
  }, []);

  const handleOpenFile = useCallback(() => {
    // File opening is handled by DesktopMenu via useTauri
    // Here we just switch to the appropriate view
    setCurrentView('supergrid');
  }, []);

  const handleSaveFile = useCallback(() => {
    // File saving is handled by DesktopMenu via useTauri
    console.log('File saved');
  }, []);

  const handleSettings = useCallback(() => {
    // TODO: Implement settings dialog
    console.log('Settings requested');
  }, []);

  const handleHelp = useCallback(() => {
    // TODO: Implement help system
    console.log('Help requested');
  }, []);

  const handleToggleView = useCallback((view: 'grid' | 'network' | 'timeline' | 'kanban') => {
    switch (view) {
      case 'grid':
        setCurrentView('supergrid');
        break;
      case 'network':
        setCurrentView('three-canvas');
        break;
      default:
        setCurrentView('supergrid');
    }
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'p0-test':
        return <SQLiteP0GateTest />;

      case 'three-canvas':
        return (
          <ThemeProvider>
            <NotebookProvider>
              <div className="h-full bg-gray-50 relative">
                <NotebookLayout />
                <ThreeCanvasDemo />
              </div>
            </NotebookProvider>
          </ThemeProvider>
        );

      case 'supergrid':
        return (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">SuperGrid View</h2>
            <p className="text-gray-600 mb-4">
              SuperGrid integration with loaded database will appear here.
            </p>
            <p className="text-sm text-gray-500">
              For now, switching to P0 test which includes SuperGrid demo...
            </p>
            <div className="mt-4">
              <SQLiteP0GateTest />
            </div>
          </div>
        );

      case 'welcome':
      default:
        return (
          <div className="p-8 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-4">Welcome to Isometry SuperGrid</h1>
              <p className="text-lg text-gray-600 mb-6">
                Polymorphic data projection platform with interactive grid visualization
              </p>
              {isDesktop && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                  ✅ Running in Desktop Mode
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-3">SuperGrid Demo</h3>
                <p className="text-gray-600 mb-4">
                  Interactive data grid with LATCH filtering and PAFV spatial projection.
                </p>
                <button
                  onClick={() => setCurrentView('p0-test')}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Launch Demo
                </button>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-3">Three-Canvas Notebook</h3>
                <p className="text-gray-600 mb-4">
                  Complete notebook interface with Capture, Shell, and Preview canvases.
                </p>
                <button
                  onClick={() => setCurrentView('three-canvas')}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                >
                  Open Notebook
                </button>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-xl font-semibold mb-3">File Operations</h3>
                <p className="text-gray-600 mb-4">
                  Open .isometry files or create new datasets with native file dialogs.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleNewFile}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                  >
                    New Project
                  </button>
                  <button
                    onClick={handleOpenFile}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                  >
                    Open File
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Desktop Features</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✅ Native file system access for .isometry databases</li>
                <li>✅ Native file dialogs for Open/Save operations</li>
                <li>✅ Window state persistence (size, position)</li>
                <li>✅ Native keyboard shortcuts and menus</li>
                <li>✅ Direct sql.js database access (no serialization)</li>
                <li>✅ Full SuperGrid performance in desktop environment</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <DesktopMenu
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onSaveFile={handleSaveFile}
        onSettings={handleSettings}
        onHelp={handleHelp}
        onToggleView={handleToggleView}
      />

      <div className="flex-1 overflow-hidden">
        {renderCurrentView()}
      </div>
    </div>
  );
}