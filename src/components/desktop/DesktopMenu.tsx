/**
 * Desktop Menu Component - Native-style menu for Tauri app
 */

import { Button } from '@/components/ui/button';
import {
  FileText,
  FolderOpen,
  Save,
  Settings,
  HelpCircle,
  Grid3X3,
  Database
} from 'lucide-react';
import { useTauri } from '@/hooks/useTauri';

export interface DesktopMenuProps {
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onSaveFile?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onToggleView?: (view: 'grid' | 'network' | 'timeline' | 'kanban') => void;
}

export function DesktopMenu({
  onNewFile,
  onOpenFile,
  onSaveFile,
  onSettings,
  onHelp,
  onToggleView,
}: DesktopMenuProps) {
  const [tauriState, tauriActions] = useTauri();

  const handleOpenFile = async () => {
    const file = await tauriActions.openFile();
    if (file && onOpenFile) {
      onOpenFile();
    }
  };

  const handleSaveFile = async () => {
    // TODO: Get actual database data
    const dummyData = new ArrayBuffer(0);
    const filePath = await tauriActions.saveFile(dummyData);
    if (filePath && onSaveFile) {
      onSaveFile();
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      {/* Left side - File operations */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewFile}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          New
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenFile}
          disabled={!tauriState.capabilities.hasNativeDialogs || tauriState.isLoading}
          className="flex items-center gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          Open
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSaveFile}
          disabled={!tauriState.capabilities.hasNativeDialogs || tauriState.isLoading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>

        <div className="w-px h-6 bg-gray-200 mx-2" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleView?.('grid')}
          className="flex items-center gap-2"
        >
          <Grid3X3 className="h-4 w-4" />
          SuperGrid
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleView?.('network')}
          className="flex items-center gap-2"
        >
          <Database className="h-4 w-4" />
          Network
        </Button>
      </div>

      {/* Center - Title */}
      <div className="flex-1 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          Isometry SuperGrid
        </h1>
        {tauriState.isDesktop && (
          <span className="text-xs text-gray-500">Desktop Application</span>
        )}
      </div>

      {/* Right side - Settings and help */}
      <div className="flex items-center gap-2">
        {tauriState.recentFiles.length > 0 && (
          <div className="text-xs text-gray-500 mr-2">
            Recent: {tauriState.recentFiles.length} files
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onSettings}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onHelp}
          className="flex items-center gap-2"
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </div>

      {/* Error display */}
      {tauriState.error && (
        <div className="fixed top-16 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{tauriState.error}</span>
          <button
            onClick={tauriActions.clearError}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}