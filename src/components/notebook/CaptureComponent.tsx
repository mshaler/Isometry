import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Edit3, Minimize2, Maximize2, ChevronDown, ChevronRight,
  Save, AlertCircle, Settings, Plus, FileText
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTipTapEditor } from '@/hooks';
import { useSQLite } from '../../db/SQLiteProvider';
import { useNotebook } from '../../contexts/NotebookContext';
import { useSelection } from '../../state/SelectionContext';
import PropertyEditor from './PropertyEditor';
import { TipTapEditor, EditorToolbar, EditorStatusBar, SaveAsTemplateModal } from './editor';
import { TemplatePickerModal } from './editor/TemplatePickerModal';

// Note: GlobalErrorReporting interface is declared in ErrorBoundary component

interface CaptureComponentProps {
  className?: string;
}

// Helper functions for CaptureComponent complexity reduction

function extractCardInfo(content: string) {
  const lines = content.split('\n').filter((line: string) => line.trim());
  const title = lines[0]?.replace(/^#+\s*/, '') || content.substring(0, 50).trim();
  const summary = content.substring(0, 200).trim();
  return { title, summary };
}

function extractShellCommand(content: string): string {
  let command = content.trim();
  const codeBlockMatch = content.match(/```(?:bash|sh|shell)?\n(.*?)```/s);
  if (codeBlockMatch) {
    command = codeBlockMatch[1].trim();
  }
  return command;
}

function MinimizedView({ className, theme, isDirty, onMaximize }: {
  className?: string;
  theme: string;
  isDirty: boolean;
  onMaximize: () => void;
}) {
  return (
    <div className={`${className} ${
      theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'
    } border rounded-lg`}>
      <div className={`flex items-center justify-between p-2 ${
        theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'
      } rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">Capture</span>
          {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
        </div>
        <button
          onClick={onMaximize}
          className={`p-1 rounded hover:${
            theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'
          } transition-colors`}
          title="Maximize"
        >
          <Maximize2 size={14} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}

function EmptyCardView({ theme, onCreateCard }: { theme: string; onCreateCard: () => void }) {
  return (
    <div className={`h-full ${
      theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'
    } border rounded flex items-center justify-center text-gray-500`}>
      <div className="text-center">
        <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No card selected</p>
        <p className="text-xs text-gray-400 mb-3">Create a card to start editing</p>
        <button
          onClick={onCreateCard}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
            theme === 'NeXTSTEP'
              ? 'bg-[#0066cc] hover:bg-[#0055aa] text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Plus size={16} />
          Create New Card
        </button>
      </div>
    </div>
  );
}

export function CaptureComponent({ className }: CaptureComponentProps) {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [propertyUpdateCount, setPropertyUpdateCount] = useState(0);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [templatePickerEditor, setTemplatePickerEditor] = useState<Editor | null>(null);
  const [isSaveAsTemplateOpen, setIsSaveAsTemplateOpen] = useState(false);

  // Use the new TipTap editor hook with integrated slash commands
  const {
    editor,
    isDirty,
    isSaving,
    saveNow,
    activeCard,
    wordCount,
    characterCount,
  } = useTipTapEditor({
    autoSaveDelay: 2000,
    enableAutoSave: true
  });

  const { run: dbRun } = useSQLite();
  const { loadCard, createCard } = useNotebook();
  const { selection } = useSelection();

  // Handle creating a new card
  const handleCreateCard = useCallback(async () => {
    try {
      await createCard('capture');
    } catch (error) {
      console.error('Failed to create card:', error);
    }
  }, [createCard]);

  // SYNC-02: When user clicks card in Preview, load it in Capture
  // This effect reacts to selection changes from NetworkGraph, Timeline, etc.
  // Note: SYNC-03 (selection highlighting across canvases) is handled by Plan 02
  useEffect(() => {
    const selectedId = selection.lastSelectedId;
    if (!selectedId) return;

    // Don't reload if this is already the current card
    if (activeCard?.id === selectedId || activeCard?.nodeId === selectedId) {
      return;
    }

    // Auto-save current card before loading new one (if dirty)
    if (isDirty) {
      saveNow().then(() => {
        loadCard(selectedId);
      }).catch(error => {
        console.error('Auto-save before card switch failed:', error);
        // Still try to load the new card even if save failed
        loadCard(selectedId);
      });
    } else {
      loadCard(selectedId);
    }
  }, [selection.lastSelectedId, activeCard?.id, activeCard?.nodeId, isDirty, saveNow, loadCard]);

  // Handle /save-card command from slash commands
  const handleSaveCard = useCallback(async (markdown: string) => {
    if (!markdown.trim()) {
      alert('No content to save');
      return;
    }
    try {
      const { title, summary } = extractCardInfo(markdown);
      const nodeId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      dbRun(
        `INSERT INTO nodes (id, name, summary, markdown_content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nodeId, title, summary, markdown, now, now]
      );

      dbRun(
        `INSERT INTO notebook_cards (node_id, card_type, markdown_content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [nodeId, 'capture', markdown, now, now]
      );

      alert(`Card saved: ${title}`);
      // Clear the editor after saving
      editor?.commands.clearContent();
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('Failed to save card: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [dbRun, editor]);

  // Handle /send-to-shell command from slash commands
  const handleSendToShell = useCallback((content: string) => {
    if (!content.trim()) {
      alert('No content to send to shell');
      return;
    }
    try {
      const command = extractShellCommand(content);
      console.warn('Sending to shell:', command);
      // Dispatch event for ShellComponent to receive
      window.dispatchEvent(new CustomEvent('isometry:execute-shell-command', {
        detail: { command }
      }));
      alert(`Command sent to shell: ${command.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to send to shell:', error);
      alert('Failed to send to shell: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  // Listen for custom events from slash commands
  useEffect(() => {
    const handleSaveCardEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ markdown: string }>;
      handleSaveCard(customEvent.detail.markdown);
    };

    const handleSendToShellEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ content: string }>;
      handleSendToShell(customEvent.detail.content);
    };

    const handleOpenTemplatePicker = (event: Event) => {
      const customEvent = event as CustomEvent<{ editor: Editor; insertPosition: number }>;
      setTemplatePickerEditor(customEvent.detail.editor);
      setIsTemplatePickerOpen(true);
    };

    window.addEventListener('isometry:save-card', handleSaveCardEvent);
    window.addEventListener('isometry:send-to-shell', handleSendToShellEvent);
    window.addEventListener('isometry:open-template-picker', handleOpenTemplatePicker);

    return () => {
      window.removeEventListener('isometry:save-card', handleSaveCardEvent);
      window.removeEventListener('isometry:send-to-shell', handleSendToShellEvent);
      window.removeEventListener('isometry:open-template-picker', handleOpenTemplatePicker);
    };
  }, [handleSaveCard, handleSendToShell]);

  const handleManualSave = useCallback(async () => {
    try {
      await saveNow();
    } catch (error) {
      console.error('Save failed:', error);
      if (typeof window !== 'undefined' && window.errorReporting) {
        window.errorReporting.reportError({
          error: error instanceof Error ? error : new Error('Save failed'),
          level: 'feature',
          name: 'CaptureComponent',
          retryCount: 0
        });
      }
    }
  }, [saveNow]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  const handlePropertyUpdate = useCallback((_properties: Record<string, unknown>) => {
    setPropertyUpdateCount(prev => prev + 1);
  }, []);

  const propertyCount = useMemo(() => {
    if (!activeCard?.properties) return 0;
    return Object.values(activeCard.properties).filter(value =>
      value !== null && value !== undefined && value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    ).length;
  }, [activeCard?.properties, propertyUpdateCount]);

  // Get content for template saving - use markdown serialization if available
  const getEditorContent = useCallback(() => {
    if (!editor) return '';
    if (editor.storage?.markdown?.manager) {
      return editor.storage.markdown.manager.serialize(editor.getJSON());
    }
    return editor.getText() || '';
  }, [editor]);

  if (isMinimized) {
    return (
      <MinimizedView
        className={className}
        theme={theme}
        isDirty={isDirty}
        onMaximize={() => setIsMinimized(false)}
      />
    );
  }

  return (
    <div className={`${className} ${
      theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'
    } border rounded-lg flex flex-col`}>
      <div className={`flex items-center justify-between p-2 ${
        theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'
      } rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">
            {activeCard ? `Card: ${activeCard.id?.slice(0, 8)}...` : 'Capture'}
          </span>
          <span className="text-xs text-gray-500">|</span>
          <span className="text-xs text-gray-500">Type / for commands</span>
          {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
          {isSaving && <div className="text-xs text-gray-500">Saving...</div>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
            title="Save now (Cmd+S)"
          >
            <Save size={14} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsSaveAsTemplateOpen(true)}
            disabled={!activeCard || !editor?.getText()?.trim()}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
            title="Save as Template"
          >
            <FileText size={14} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Minimize"
          >
            <Minimize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative flex flex-col">
          {activeCard ? (
            <>
              <EditorToolbar editor={editor} theme={theme} />
              <div className="flex-1 overflow-auto">
                <TipTapEditor
                  editor={editor}
                  className="min-h-[400px] p-2"
                />
              </div>
              <EditorStatusBar
                wordCount={wordCount}
                characterCount={characterCount}
                isSaving={isSaving}
                isDirty={isDirty}
                theme={theme}
              />
            </>
          ) : (
            <EmptyCardView theme={theme} onCreateCard={handleCreateCard} />
          )}
        </div>

        <div className={`border-t ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={() => setPropertiesExpanded(!propertiesExpanded)}
            className={`w-full flex items-center justify-between p-2 hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-gray-600" />
              <span className="text-sm font-medium">Properties</span>
              {propertyCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#0066cc] text-white'
                    : 'bg-blue-500 text-white'
                }`}>
                  {propertyCount}
                </span>
              )}
            </div>
            {propertiesExpanded ? (
              <ChevronDown size={14} className="text-gray-600" />
            ) : (
              <ChevronRight size={14} className="text-gray-600" />
            )}
          </button>

          {propertiesExpanded && activeCard && (
            <div className="p-3">
              <PropertyEditor
                card={activeCard}
                onUpdate={handlePropertyUpdate}
                theme={theme}
              />
              <div className={`mt-4 pt-4 border-t space-y-2 ${
                theme === 'NeXTSTEP' ? 'border-[#999999]' : 'border-gray-300'
              }`}>
                <div className="text-xs text-gray-500 mb-2">System Properties</div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Card Type</label>
                  <input
                    type="text"
                    value={activeCard.cardType || 'capture'}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Node ID</label>
                  <input
                    type="text"
                    value={activeCard.nodeId || activeCard.id || ''}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 font-mono ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Created</label>
                  <input
                    type="text"
                    value={activeCard.createdAt ? new Date(activeCard.createdAt).toLocaleString() : ''}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Modified</label>
                  <input
                    type="text"
                    value={activeCard.modifiedAt ? new Date(activeCard.modifiedAt).toLocaleString() : ''}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Picker Modal (opened via /template slash command) */}
      <TemplatePickerModal
        isOpen={isTemplatePickerOpen}
        onClose={() => {
          setIsTemplatePickerOpen(false);
          // Return focus to editor
          templatePickerEditor?.commands.focus();
        }}
        editor={templatePickerEditor}
      />

      {/* Save as Template Modal */}
      <SaveAsTemplateModal
        isOpen={isSaveAsTemplateOpen}
        onClose={() => setIsSaveAsTemplateOpen(false)}
        content={getEditorContent()}
        onSuccess={() => {
          console.log('Template saved successfully');
        }}
      />
    </div>
  );
}
