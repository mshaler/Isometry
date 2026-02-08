import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { CapturePane } from '@/app/components/CapturePane';
import { ClaudePane } from '@/app/components/ClaudePane';
import { PreviewPane } from '@/app/components/PreviewPane';
import { ChevronUp, ChevronDown, Maximize2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type PopoutPane = 'capture' | 'claude' | 'preview' | null;

export function WorkspacePane() {
  const { theme } = useTheme();
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const [collapsedPanes, setCollapsedPanes] = useState<{
    capture: boolean;
    claude: boolean;
    preview: boolean;
  }>({
    capture: false,
    claude: false,
    preview: false,
  });
  const [popoutPane, setPopoutPane] = useState<PopoutPane>(null);

  const toggleWorkspace = () => {
    setIsWorkspaceCollapsed(!isWorkspaceCollapsed);
  };

  const togglePaneCollapse = (pane: 'capture' | 'claude' | 'preview') => {
    setCollapsedPanes((prev) => ({
      ...prev,
      [pane]: !prev[pane],
    }));
  };

  const openPopout = (pane: PopoutPane) => {
    setPopoutPane(pane);
  };

  const closePopout = () => {
    setPopoutPane(null);
  };

  const getVisiblePanesCount = () => {
    return Object.values(collapsedPanes).filter((v) => !v).length;
  };

  const getPaneWidth = () => {
    const visibleCount = getVisiblePanesCount();
    if (visibleCount === 0) return 'w-0';
    if (visibleCount === 1) return 'w-full';
    if (visibleCount === 2) return 'w-1/2';
    return 'w-1/3';
  };

  return (
    <>
      <div
        className={`flex flex-col border-t-2 transition-all duration-300 ${
          theme === 'NeXTSTEP'
            ? 'border-[#505050] bg-[#c0c0c0]'
            : 'border-gray-200 bg-white'
        } ${isWorkspaceCollapsed ? 'h-10' : 'h-96'}`}
      >
        {/* Workspace header */}
        <div
          className={`flex items-center justify-between h-10 px-3 cursor-pointer ${
            theme === 'NeXTSTEP'
              ? 'bg-[#b0b0b0] border-b-2 border-[#505050]'
              : 'bg-gray-100 border-b border-gray-200'
          }`}
          onClick={toggleWorkspace}
        >
          <span
            className={`text-sm ${
              theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'
            }`}
          >
            Workspace
          </span>
          <button
            className={`p-1 ${
              theme === 'NeXTSTEP'
                ? 'hover:bg-[#a0a0a0]'
                : 'hover:bg-gray-200 rounded'
            }`}
          >
            {isWorkspaceCollapsed ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>

        {/* Panes container */}
        {!isWorkspaceCollapsed && (
          <div className="flex-1 flex overflow-hidden">
            {/* Capture Pane */}
            <div className={collapsedPanes.capture ? 'w-0 overflow-hidden' : getPaneWidth()}>
              <div className="h-full relative group">
                <CapturePane
                  isCollapsed={collapsedPanes.capture}
                  onToggleCollapse={() => openPopout('capture')}
                />
                {!collapsedPanes.capture && (
                  <button
                    onClick={() => togglePaneCollapse('capture')}
                    className={`absolute top-2 left-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-2 border-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-white border border-gray-300 hover:bg-gray-100 rounded shadow-sm'
                    }`}
                    title="Collapse pane"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Claude Pane */}
            <div className={collapsedPanes.claude ? 'w-0 overflow-hidden' : getPaneWidth()}>
              <div className="h-full relative group">
                <ClaudePane
                  isCollapsed={collapsedPanes.claude}
                  onToggleCollapse={() => openPopout('claude')}
                />
                {!collapsedPanes.claude && (
                  <button
                    onClick={() => togglePaneCollapse('claude')}
                    className={`absolute top-2 left-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-2 border-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-white border border-gray-300 hover:bg-gray-100 rounded shadow-sm'
                    }`}
                    title="Collapse pane"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Preview Pane */}
            <div className={collapsedPanes.preview ? 'w-0 overflow-hidden' : getPaneWidth()}>
              <div className="h-full relative group">
                <PreviewPane
                  isCollapsed={collapsedPanes.preview}
                  onToggleCollapse={() => openPopout('preview')}
                />
                {!collapsedPanes.preview && (
                  <button
                    onClick={() => togglePaneCollapse('preview')}
                    className={`absolute top-2 left-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-2 border-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-white border border-gray-300 hover:bg-gray-100 rounded shadow-sm'
                    }`}
                    title="Collapse pane"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Collapsed panes indicators */}
            {(collapsedPanes.capture || collapsedPanes.claude || collapsedPanes.preview) && (
              <div
                className={`flex flex-col gap-2 p-2 ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#b0b0b0] border-l-2 border-[#505050]'
                    : 'bg-gray-100 border-l border-gray-200'
                }`}
              >
                {collapsedPanes.capture && (
                  <button
                    onClick={() => togglePaneCollapse('capture')}
                    className={`px-3 py-2 text-xs whitespace-nowrap ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-gray-200 hover:bg-gray-300 rounded'
                    }`}
                  >
                    Capture
                  </button>
                )}
                {collapsedPanes.claude && (
                  <button
                    onClick={() => togglePaneCollapse('claude')}
                    className={`px-3 py-2 text-xs whitespace-nowrap ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-gray-200 hover:bg-gray-300 rounded'
                    }`}
                  >
                    Claude
                  </button>
                )}
                {collapsedPanes.preview && (
                  <button
                    onClick={() => togglePaneCollapse('preview')}
                    className={`px-3 py-2 text-xs whitespace-nowrap ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                        : 'bg-gray-200 hover:bg-gray-300 rounded'
                    }`}
                  >
                    Preview
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popout dialogs */}
      <Dialog.Root open={popoutPane !== null} onOpenChange={(open) => !open && closePopout()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={`fixed inset-0 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#000000]/50'
                : 'bg-black/50'
            }`}
          />
          <Dialog.Content
            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vh] ${
              theme === 'NeXTSTEP'
                ? 'bg-[#c0c0c0] border-4 border-[#000000] shadow-[8px_8px_0_rgba(0,0,0,0.5)]'
                : 'bg-white rounded-lg shadow-2xl'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Dialog header */}
              <div
                className={`flex items-center justify-between h-12 px-4 ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#b0b0b0] border-b-2 border-[#505050]'
                    : 'bg-gray-100 border-b border-gray-200'
                }`}
              >
                <Dialog.Title
                  className={`text-sm ${
                    theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-900'
                  }`}
                >
                  {popoutPane === 'capture' && 'Capture'}
                  {popoutPane === 'claude' && 'Claude'}
                  {popoutPane === 'preview' && 'Preview'}
                </Dialog.Title>
                <Dialog.Close
                  className={`p-1 ${
                    theme === 'NeXTSTEP'
                      ? 'hover:bg-[#a0a0a0]'
                      : 'hover:bg-gray-200 rounded'
                  }`}
                >
                  <X className="size-5" />
                </Dialog.Close>
              </div>

              {/* Dialog content */}
              <div className="flex-1 overflow-hidden">
                {popoutPane === 'capture' && <CapturePane isPopout={true} onToggleCollapse={closePopout} />}
                {popoutPane === 'claude' && <ClaudePane isPopout={true} onToggleCollapse={closePopout} />}
                {popoutPane === 'preview' && <PreviewPane isPopout={true} onToggleCollapse={closePopout} />}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
