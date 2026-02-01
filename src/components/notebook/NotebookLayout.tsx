import { useEffect, useState, useRef, useCallback } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import { CaptureComponent } from './CaptureComponent';
import { EnhancedShellComponent } from '../gsd/EnhancedShellComponent';
import { PreviewComponent } from './PreviewComponent';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { FocusProvider, useFocusContext, useFocusableComponent } from '../../context/FocusContext';

interface ComponentLayout {
  width: number;
  height: number;
}

function NotebookLayoutInner() {
  const { updateLayout } = useNotebook();
  const { focusComponent } = useFocusContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus management refs
  const captureRef = useFocusableComponent('capture');
  const shellRef = useFocusableComponent('shell');
  const previewRef = useFocusableComponent('preview');
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [componentLayouts, setComponentLayouts] = useState<{
    capture: ComponentLayout;
    shell: ComponentLayout;
    preview: ComponentLayout;
  }>({
    capture: { width: 40, height: 100 }, // percentage
    shell: { width: 30, height: 100 },
    preview: { width: 30, height: 100 },
  });

  // Handle screen size detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
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

  // Drag resize functionality
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startWidth: 0 });

  const handleMouseDown = useCallback((divider: string, _event: React.MouseEvent) => {
    _event.preventDefault();
    setIsDragging(divider);
    setDragStart({
      x: _event.clientX,
      y: _event.clientY,
      startWidth: divider === 'capture-shell' ? componentLayouts.capture.width : componentLayouts.shell.width,
    });
  }, [componentLayouts]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = event.clientX - dragStart.x;
    const deltaPercentage = (deltaX / containerRect.width) * 100;

    if (isDragging === 'capture-shell') {
      const newCaptureWidth = Math.max(25, Math.min(60, dragStart.startWidth + deltaPercentage));
      const remainingWidth = 100 - newCaptureWidth;
      const shellRatio = componentLayouts.shell.width / (componentLayouts.shell.width + componentLayouts.preview.width);

      setComponentLayouts(prev => ({
        capture: { ...prev.capture, width: newCaptureWidth },
        shell: { ...prev.shell, width: remainingWidth * shellRatio },
        preview: { ...prev.preview, width: remainingWidth * (1 - shellRatio) },
      }));
    } else if (isDragging === 'shell-preview') {
      const remainingWidth = 100 - componentLayouts.capture.width;
      const newShellWidth = Math.max(20, Math.min(remainingWidth - 20, dragStart.startWidth + deltaPercentage));
      const newPreviewWidth = remainingWidth - newShellWidth;

      setComponentLayouts(prev => ({
        ...prev,
        shell: { ...prev.shell, width: newShellWidth },
        preview: { ...prev.preview, width: newPreviewWidth },
      }));
    }
  }, [isDragging, dragStart, componentLayouts]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Persist layout to context
      updateLayout('capture', {
        x: 0,
        y: 0,
        width: componentLayouts.capture.width,
        height: componentLayouts.capture.height
      });
      updateLayout('shell', {
        x: componentLayouts.capture.width,
        y: 0,
        width: componentLayouts.shell.width,
        height: componentLayouts.shell.height
      });
      updateLayout('preview', {
        x: componentLayouts.capture.width + componentLayouts.shell.width,
        y: 0,
        width: componentLayouts.preview.width,
        height: componentLayouts.preview.height
      });
    }
    setIsDragging(null);
  }, [isDragging, componentLayouts, updateLayout]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Render divider for desktop mode
  const renderDivider = (type: string, _className: string) => (
    <div
      className={`${_className} group`}
      onMouseDown={(e) => handleMouseDown(type, e)}
    >
      <div className="w-full h-full bg-gray-300 group-hover:bg-gray-400 transition-colors cursor-col-resize flex items-center justify-center">
        <div className="w-1 h-8 bg-gray-500 rounded"></div>
      </div>
    </div>
  );

  if (screenSize === 'mobile') {
    // Mobile: Stack vertically
    return (
      <div ref={containerRef} className="h-full flex flex-col gap-2 p-2">
        <ErrorBoundary level="feature" name="CaptureComponent">
          <div ref={captureRef} className="flex-1 min-h-[300px] relative focusable-component" tabIndex={0}>
            <CaptureComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <ErrorBoundary level="feature" name="ShellComponent">
          <div ref={shellRef} className="flex-1 min-h-[200px] relative focusable-component" tabIndex={0}>
            <EnhancedShellComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <ErrorBoundary level="feature" name="PreviewComponent">
          <div ref={previewRef} className="flex-1 min-h-[200px] relative focusable-component" tabIndex={0}>
            <PreviewComponent className="h-full" />
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  if (screenSize === 'tablet') {
    // Tablet: Capture on top, Shell and Preview side-by-side below
    return (
      <div ref={containerRef} className="h-full flex flex-col gap-2 p-2">
        <ErrorBoundary level="feature" name="CaptureComponent">
          <div ref={captureRef} className="flex-1 min-h-[300px] relative focusable-component" tabIndex={0}>
            <CaptureComponent className="h-full" />
          </div>
        </ErrorBoundary>
        <div className="flex-1 flex gap-2 min-h-[300px]">
          <ErrorBoundary level="feature" name="ShellComponent">
            <div ref={shellRef} className="flex-1 min-w-[300px] relative focusable-component" tabIndex={0}>
              <EnhancedShellComponent className="h-full" />
            </div>
          </ErrorBoundary>
          <ErrorBoundary level="feature" name="PreviewComponent">
            <div ref={previewRef} className="flex-1 min-w-[300px] relative focusable-component" tabIndex={0}>
              <PreviewComponent className="h-full" />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  // Desktop: Three columns side-by-side with resizable dividers
  return (
    <div
      ref={containerRef}
      className="h-full flex gap-0 p-2 select-none"
      style={{ cursor: isDragging ? 'col-resize' : 'default' }}
    >
      {/* Capture Component */}
      <ErrorBoundary level="feature" name="CaptureComponent">
        <div
          ref={captureRef}
          style={{ width: `${componentLayouts.capture.width}%` }}
          className="min-w-[300px] relative focusable-component"
          tabIndex={0}
        >
          <CaptureComponent className="h-full" />
        </div>
      </ErrorBoundary>

      {/* Capture-Shell Divider */}
      {renderDivider('capture-shell', 'w-1 h-full')}

      {/* Shell Component */}
      <ErrorBoundary level="feature" name="ShellComponent">
        <div
          ref={shellRef}
          style={{ width: `${componentLayouts.shell.width}%` }}
          className="min-w-[250px] relative focusable-component"
          tabIndex={0}
        >
          <EnhancedShellComponent className="h-full" />
        </div>
      </ErrorBoundary>

      {/* Shell-Preview Divider */}
      {renderDivider('shell-preview', 'w-1 h-full')}

      {/* Preview Component */}
      <ErrorBoundary level="feature" name="PreviewComponent">
        <div
          ref={previewRef}
          style={{ width: `${componentLayouts.preview.width}%` }}
          className="min-w-[250px] relative focusable-component"
          tabIndex={0}
        >
          <PreviewComponent className="h-full" />
        </div>
      </ErrorBoundary>
    </div>
  );
}

export function NotebookLayout() {
  return (
    <FocusProvider>
      <NotebookLayoutInner />
    </FocusProvider>
  );
}