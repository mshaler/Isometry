import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Edit3, Minimize2, Maximize2, ChevronDown, ChevronRight, Save, AlertCircle, Hash, Code, Settings } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarkdownEditor, useSlashCommands } from '@/hooks';
import { useSQLite } from '../../db/SQLiteProvider';
import { useNotebook } from '../../contexts/NotebookContext';
import PropertyEditor from './PropertyEditor';

type SlashCommand = {
  id: string;
  label: string;
  category: 'isometry' | 'template' | 'format';
  action: () => void;
};

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

function getCommandIcon(category: SlashCommand['category']) {
  switch (category) {
    case 'isometry':
      return <Hash size={14} className="text-blue-500" />;
    case 'template':
      return <Edit3 size={14} className="text-green-500" />;
    case 'format':
      return <Code size={14} className="text-purple-500" />;
    default:
      return null;
  }
}

function MinimizedView({ className, theme, isDirty, onMaximize }: {
  className?: string;
  theme: string;
  isDirty: boolean;
  onMaximize: () => void;
}) {
  return (
    <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg`}>
      <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">Capture</span>
          {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
        </div>
        <button
          onClick={onMaximize}
          className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
          title="Maximize"
        >
          <Maximize2 size={14} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}

function EmptyCardView({ theme }: { theme: string }) {
  return (
    <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center text-gray-500`}>
      <div className="text-center">
        <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No card selected</p>
        <p className="text-xs text-gray-400">Create a card to start editing</p>
      </div>
    </div>
  );
}

function SlashCommandMenu({
  menuState,
  theme,
  onExecuteCommand
}: {
  menuState: any;
  theme: string;
  onExecuteCommand: (commandId: string) => void;
}) {
  return (
    <div
      className={`absolute z-50 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-[#707070] shadow-md'
          : 'bg-white border-gray-300 shadow-lg'
      } border rounded-lg min-w-[300px] max-h-[300px] overflow-y-auto`}
      style={{
        top: menuState.position.y + 20,
        left: menuState.position.x
      }}
    >
      <div className={`p-2 text-xs text-gray-500 border-b ${
        theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center gap-1">
          <span>💡</span>
          <span>
            {menuState.query ? `Searching "${menuState.query}"` : 'Choose a command...'}
          </span>
        </div>
      </div>
      <div className="py-1">
        {menuState.commands.length > 0 ? (
          menuState.commands.map((command: any, index: number) => (
            <button
              key={command.id}
              onClick={() => onExecuteCommand(command.id)}
              className={`w-full text-left p-2 flex items-center gap-2 hover:${
                theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'
              } transition-colors ${
                index === menuState.selectedIndex
                  ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                  : ''
              }`}
            >
              <div className="flex-shrink-0">
                {getCommandIcon(command.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{command.label}</div>
                <div className={`text-xs ${
                  index === menuState.selectedIndex ? 'text-white/80' : 'text-gray-500'
                } truncate`}>
                  {command.description}
                </div>
              </div>
              {command.shortcut && (
                <div className={`text-xs px-1 rounded ${
                  index === menuState.selectedIndex
                    ? 'bg-white/20'
                    : theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-200'
                }`}>
                  /{command.shortcut}
                </div>
              )}
            </button>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            <div className="mb-1">No commands found</div>
            <div className="text-xs">Try typing "pafv", "latch", or "meeting"</div>
          </div>
        )}
      </div>
      <div className={`p-2 text-xs text-gray-500 border-t ${
        theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex justify-between">
          <span>↑↓ Navigate</span>
          <span>⏎ Select • ⎋ Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function CaptureComponent({ className }: CaptureComponentProps) {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [propertyUpdateCount, setPropertyUpdateCount] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    content,
    setContent,
    isDirty,
    isSaving,
    saveNow,
    activeCard
  } = useMarkdownEditor({
    autoSaveDelay: 2000,
    enableAutoSave: true
  });

  const { run: dbRun } = useSQLite();
  useNotebook();

  const slashHook = useSlashCommands();
  const {
    menuState,
    registerInsertText,
    handleKeyDown,
    handleTextInput,
    executeCommand: originalExecuteCommand,
    commands: allCommands,
    filteredCommands
  } = slashHook;

  const handleSaveCard = useCallback(async () => {
    if (!content.trim()) {
      alert('No content to save');
      return;
    }
    try {
      const { title, summary } = extractCardInfo(content);
      const nodeId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      dbRun(
        `INSERT INTO nodes (id, name, summary, markdown_content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nodeId, title, summary, content, now, now]
      );

      dbRun(
        `INSERT INTO notebook_cards (node_id, card_type, markdown_content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [nodeId, 'capture', content, now, now]
      );

      alert(`Card saved: ${title}`);
      setContent('');
    } catch (error) {
      console.error('Failed to save card:', error);
      alert('Failed to save card: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [content, dbRun, setContent]);

  const handleSendToShell = useCallback(() => {
    if (!content.trim()) {
      alert('No content to send to shell');
      return;
    }
    try {
      const command = extractShellCommand(content);
      console.log('Sending to shell:', command);
      alert(`Command sent to shell: ${command.substring(0, 50)}...`);
    } catch (error) {
      console.error('Failed to send to shell:', error);
      alert('Failed to send to shell: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [content]);

  const executeCommand = useCallback((commandId?: string) => {
    const command = commandId
      ? allCommands.find(cmd => cmd.id === commandId)
      : filteredCommands[menuState.selectedIndex];

    if (!command) return originalExecuteCommand(commandId);

    if (command.id === 'save-card') {
      handleSaveCard();
      return true;
    }
    if (command.id === 'send-to-shell') {
      handleSendToShell();
      return true;
    }
    return originalExecuteCommand(commandId);
  }, [allCommands, filteredCommands, menuState.selectedIndex, originalExecuteCommand, handleSaveCard, handleSendToShell]);

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

  useEffect(() => {
    const insertText = (text: string, cursorOffset?: number) => {
      const textarea = editorRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const beforeSlash = content.lastIndexOf('/', start - 1);
      const newContent = content.substring(0, beforeSlash) + text + content.substring(end);
      setContent(newContent);

      setTimeout(() => {
        const newCursorPos = beforeSlash + text.length - (cursorOffset || 0);
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    };
    registerInsertText(insertText);
  }, [content, setContent, registerInsertText]);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent) => {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPosition = textarea.selectionStart;

    if (handleKeyDown(event.nativeEvent, content, cursorPosition, textarea)) {
      return;
    }
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      handleManualSave();
    }
  }, [content, handleKeyDown, handleManualSave]);

  const handleEditorChange = useCallback((value?: string) => {
    const newContent = value || '';
    setContent(newContent);
    const textarea = editorRef.current;
    if (textarea && menuState.isOpen) {
      handleTextInput(newContent, textarea.selectionStart, newContent);
    }
  }, [setContent, menuState.isOpen, handleTextInput]);

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
    <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg flex flex-col min-w-[300px]`}>
      <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">
            {activeCard ? `Card: ${activeCard.nodeId.slice(0, 8)}...` : 'Capture'}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500">Type / for commands</span>
          {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
          {isSaving && <div className="text-xs text-gray-500">Saving...</div>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
            title="Save now (Ctrl+S)"
          >
            <Save size={14} className="text-gray-600" />
          </button>
          <select
            value={previewMode}
            onChange={(e) => setPreviewMode(e.target.value as 'edit' | 'split' | 'preview')}
            className="text-xs p-1 rounded border"
          >
            <option value="edit">Edit</option>
            <option value="split">Split</option>
            <option value="preview">Preview</option>
          </select>
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
        <div className="flex-1 p-2 relative">
          {activeCard ? (
            <>
              <MDEditor
                ref={editorRef}
                value={content}
                onChange={handleEditorChange}
                preview={previewMode === 'edit' ? 'edit' : previewMode === 'preview' ? 'preview' : 'live'}
                hideToolbar={false}
                height={400}
                data-color-mode={theme === 'NeXTSTEP' ? 'light' : 'light'}
                onKeyDown={handleEditorKeyDown}
              />
              {menuState.isOpen && (
                <SlashCommandMenu
                  menuState={menuState}
                  theme={theme}
                  onExecuteCommand={executeCommand}
                />
              )}
            </>
          ) : (
            <EmptyCardView theme={theme} />
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
                    value={activeCard.cardType}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Node ID</label>
                  <input
                    type="text"
                    value={activeCard.nodeId}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 font-mono ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Created</label>
                  <input
                    type="text"
                    value={new Date(activeCard.createdAt).toLocaleString()}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Modified</label>
                  <input
                    type="text"
                    value={new Date(activeCard.modifiedAt).toLocaleString()}
                    readOnly
                    className={`w-full text-xs p-1 border rounded bg-gray-100 ${theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-300'}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}