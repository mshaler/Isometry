import { useEffect, useState, useRef, useCallback } from 'react';
import { Group, Panel, Separator, type PanelImperativeHandle, type Layout } from 'react-resizable-panels';
import { CaptureComponent } from './CaptureComponent';
import { ShellComponent } from './ShellComponent';
import { PreviewComponent } from './PreviewComponent';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { FocusProvider, useFocusContext, useFocusableComponent } from '../../context/FocusContext';
import { TerminalProvider } from '../../context/TerminalContext';

const STORAGE_KEY = 'notebook-panels';
const DEFAULT_SIZE = 33.33;
const MIN_SIZE = 15;

const PANEL_IDS = {
  capture: 'capture',
  shell: 'shell',
  preview: 'preview',
} as const;

function loadPanelLayout(): Layout | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Layout;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

function savePanelLayout(layout: Layout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore quota errors
  }
}

function getDefaultLayout(): Layout {
  return {
    [PANEL_IDS.capture]: DEFAULT_SIZE,
    [PANEL_IDS.shell]: DEFAULT_SIZE,
    [PANEL_IDS.preview]: DEFAULT_SIZE,
  };
}

function NotebookLayoutInner() {
  const { focusComponent } = useFocusContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus management refs
  const captureRef = useFocusableComponent('capture');
  const shellRef = useFocusableComponent('shell');
  const previewRef = useFocusableComponent('preview');
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Panel refs for imperative resize control (double-click to reset)
  const capturePanelRef = useRef<PanelImperativeHandle>(null);
  const shellPanelRef = useRef<PanelImperativeHandle>(null);
  const previewPanelRef = useRef<PanelImperativeHandle>(null);

  // Handle screen size detection
  // Breakpoints adjusted: desktop at 900px to support half-screen workflows
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('mobile');
      } else if (width < 900) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle keyboard shortcuts for focus management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey)) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            focusComponent('capture');
            break;
          case '2':
            event.preventDefault();
            focusComponent('shell');
            break;
          case '3':
            event.preventDefault();
            focusComponent('preview');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusComponent]);

  // Reset all panels to equal thirds on double-click
  const handleDividerDoubleClick = useCallback(() => {
    capturePanelRef.current?.resize(DEFAULT_SIZE);
    shellPanelRef.current?.resize(DEFAULT_SIZE);
    previewPanelRef.current?.resize(DEFAULT_SIZE);
  }, []);

  // Persist sizes to localStorage after user finishes dragging
  const handleLayoutChanged = useCallback((layout: Layout) => {
    savePanelLayout(layout);
  }, []);

  if (screenSize === 'mobile') {
    // Mobile: Stack vertically
    return (
      <div ref={containerRef} className="h-full flex flex-col gap-1 p-1 overflow-hidden">
        <ErrorBoundary level="feature" name="CaptureComponent">
          <div ref={captureRef} className="flex-1 min-h-0 relative focusable-component" tabIndex={0}>
            <CaptureComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <ErrorBoundary level="feature" name="ShellComponent">
          <div ref={shellRef} className="flex-1 min-h-0 relative focusable-component" tabIndex={0}>
            <ShellComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <ErrorBoundary level="feature" name="PreviewComponent">
          <div ref={previewRef} className="flex-1 min-h-0 relative focusable-component" tabIndex={0}>
            <PreviewComponent className="h-full" />
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  if (screenSize === 'tablet') {
    // Tablet: Capture on top, Shell and Preview side-by-side below
    return (
      <div ref={containerRef} className="h-full flex flex-col gap-1 p-1 overflow-hidden">
        <ErrorBoundary level="feature" name="CaptureComponent">
          <div ref={captureRef} className="flex-1 min-h-0 relative focusable-component" tabIndex={0}>
            <CaptureComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <div className="flex-1 flex gap-1 min-h-0">
          <ErrorBoundary level="feature" name="ShellComponent">
            <div ref={shellRef} className="flex-1 min-w-0 relative focusable-component" tabIndex={0}>
              <ShellComponent className="h-full" />
            </div>
          </ErrorBoundary>
          <ErrorBoundary level="feature" name="PreviewComponent">
            <div ref={previewRef} className="flex-1 min-w-0 relative focusable-component" tabIndex={0}>
              <PreviewComponent className="h-full" />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Desktop: Three resizable panels using react-resizable-panels
  const storedLayout = loadPanelLayout();
  const defaultLayout = storedLayout ?? getDefaultLayout();

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden p-1">
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={handleLayoutChanged}
        className="h-full"
      >
        {/* Capture Panel - 1/3 */}
        <Panel
          id={PANEL_IDS.capture}
          panelRef={capturePanelRef}
          defaultSize={DEFAULT_SIZE}
          minSize={MIN_SIZE}
          collapsible={false}
        >
          <ErrorBoundary level="feature" name="CaptureComponent">
            <div
              ref={captureRef}
              className="h-full relative focusable-component overflow-hidden"
              tabIndex={0}
            >
              <CaptureComponent className="h-full w-full" />
            </div>
          </ErrorBoundary>
        </Panel>

        <Separator
          className="w-1 bg-gray-300 hover:bg-blue-400 transition-colors duration-150 cursor-col-resize mx-px"
          onDoubleClick={handleDividerDoubleClick}
        />

        {/* Shell Panel - 1/3 */}
        <Panel
          id={PANEL_IDS.shell}
          panelRef={shellPanelRef}
          defaultSize={DEFAULT_SIZE}
          minSize={MIN_SIZE}
          collapsible={false}
        >
          <ErrorBoundary level="feature" name="ShellComponent">
            <div
              ref={shellRef}
              className="h-full relative focusable-component overflow-hidden"
              tabIndex={0}
            >
              <ShellComponent className="h-full w-full" />
            </div>
          </ErrorBoundary>
        </Panel>

        <Separator
          className="w-1 bg-gray-300 hover:bg-blue-400 transition-colors duration-150 cursor-col-resize mx-px"
          onDoubleClick={handleDividerDoubleClick}
        />

        {/* Preview Panel - 1/3 */}
        <Panel
          id={PANEL_IDS.preview}
          panelRef={previewPanelRef}
          defaultSize={DEFAULT_SIZE}
          minSize={MIN_SIZE}
          collapsible={false}
        >
          <ErrorBoundary level="feature" name="PreviewComponent">
            <div
              ref={previewRef}
              className="h-full relative focusable-component overflow-hidden"
              tabIndex={0}
            >
              <PreviewComponent className="h-full w-full" />
            </div>
          </ErrorBoundary>
        </Panel>
      </Group>
    </div>
  );
}

export function NotebookLayout() {
  return (
    <TerminalProvider initialDirectory="/Users/mshaler/Developer/Projects/Isometry">
      <FocusProvider>
        <NotebookLayoutInner />
      </FocusProvider>
    </TerminalProvider>
  );
}
