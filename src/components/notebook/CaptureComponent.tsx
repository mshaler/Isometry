import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Edit3, Minimize2, Maximize2, ChevronDown, ChevronRight, Save, AlertCircle, Hash, Code, Settings } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarkdownEditor } from '../../hooks/useMarkdownEditor';
import { useSlashCommands, type SlashCommand } from '../../hooks/useSlashCommands';
import PropertyEditor from './PropertyEditor';

interface CaptureComponentProps {
  className?: string;
}

export function CaptureComponent({ className }: CaptureComponentProps) {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [propertyUpdateCount, setPropertyUpdateCount] = useState(0);
  const editorRef = useRef<any>(null);

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

  const {
    menuState,
    registerInsertText,
    handleKeyDown,
    handleTextInput,
    executeCommand,
    navigateMenu: _navigateMenu,
    closeMenu: _closeMenu
  } = useSlashCommands();

  const handleManualSave = useCallback(async () => {
    try {
      await saveNow();
    } catch (error) {
      console.error('Save failed:', error);
      // TODO: Show user-friendly error notification
    }
  }, [saveNow]);

  // Register text insertion callback for slash commands
  useEffect(() => {
    const insertText = (text: string, cursorOffset?: number) => {
      const textarea = editorRef.current?.textarea;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const beforeSlash = content.lastIndexOf('/', start - 1);

      // Replace from the slash to the current cursor position
      const newContent =
        content.substring(0, beforeSlash) +
        text +
        content.substring(end);

      setContent(newContent);

      // Position cursor after insertion
      setTimeout(() => {
        const newCursorPos = beforeSlash + text.length - (cursorOffset || 0);
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    };

    registerInsertText(insertText);
  }, [content, setContent, registerInsertText]);

  // Handle keyboard events for slash commands
  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent) => {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPosition = textarea.selectionStart;

    // Let slash command handler process first
    if (handleKeyDown(event.nativeEvent, content, cursorPosition)) {
      return; // Event was handled by slash commands
    }

    // Handle Ctrl+S for manual save
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      handleManualSave();
    }
  }, [content, handleKeyDown, handleManualSave]);

  // Handle text input for slash command query updates
  const handleEditorChange = useCallback((value?: string) => {
    const newContent = value || '';
    setContent(newContent);

    // Update slash command query if menu is open
    const textarea = editorRef.current?.textarea;
    if (textarea && menuState.isOpen) {
      handleTextInput(newContent, textarea.selectionStart, newContent);
    }
  }, [setContent, menuState.isOpen, handleTextInput]);

  // Get icon for command category
  const getCommandIcon = (category: SlashCommand['category']) => {
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
  };

  // Handle property updates from PropertyEditor
  const handlePropertyUpdate = useCallback((_properties: Record<string, unknown>) => {
    setPropertyUpdateCount(prev => prev + 1);
    // PropertyEditor handles the actual database update
  }, []);

  // Count non-empty properties
  const propertyCount = useMemo(() => {
    if (!activeCard?.properties) return 0;
    return Object.values(activeCard.properties).filter(value =>
      value !== null && value !== undefined && value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    ).length;
  }, [activeCard?.properties, propertyUpdateCount]);

  if (isMinimized) {
    return (
      <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg`}>
        <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-gray-600" />
            <span className="font-medium text-sm">Capture</span>
            {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Maximize"
          >
            <Maximize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg flex flex-col min-w-[300px]`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">
            {activeCard ? `Card: ${activeCard.nodeId.slice(0, 8)}...` : 'No Active Card'}
          </span>
          {isDirty && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
          {isSaving && <div className="text-xs text-gray-500">Saving...</div>}
        </div>
        <div className="flex items-center gap-1">
          {/* Save button */}
          <button
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors disabled:opacity-50`}
            title="Save now (Ctrl+S)"
          >
            <Save size={14} className="text-gray-600" />
          </button>

          {/* View mode toggle */}
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Area */}
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

              {/* Slash Command Menu */}
              {menuState.isOpen && (
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
                  {/* Menu Header */}
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

                  {/* Command List */}
                  <div className="py-1">
                    {menuState.commands.length > 0 ? (
                      menuState.commands.map((command, index) => (
                        <button
                          key={command.id}
                          onClick={() => executeCommand(command.id)}
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

                  {/* Footer */}
                  <div className={`p-2 text-xs text-gray-500 border-t ${
                    theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex justify-between">
                      <span>↑↓ Navigate</span>
                      <span>⏎ Select • ⎋ Cancel</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center text-gray-500`}>
              <div className="text-center">
                <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No card selected</p>
                <p className="text-xs text-gray-400">Create a card to start editing</p>
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
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

              {/* System Properties */}
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