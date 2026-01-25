import { useEffect, useState, useRef, useCallback } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import { CaptureComponent } from './CaptureComponent';
import { ShellComponent } from './ShellComponent';
import { PreviewComponent } from './PreviewComponent';

interface ComponentLayout {
  width: number;
  height: number;
}

export function NotebookLayout() {
  const { layout, updateLayout } = useNotebook();
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey)) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            // Focus capture component (implement focus logic later)
            break;
          case '2':
            event.preventDefault();
            // Focus shell component
            break;
          case '3':
            event.preventDefault();
            // Focus preview component
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag resize functionality
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startWidth: 0 });

  const handleMouseDown = useCallback((divider: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(divider);
    setDragStart({
      x: event.clientX,
      y: event.clientY,
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
  const renderDivider = (type: string, className: string) => (
    <div
      className={`${className} group`}
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
        <div className="flex-1 min-h-[300px]">
          <CaptureComponent className="h-full" />
        </div>
        <div className="flex-1 min-h-[200px]">
          <ShellComponent className="h-full" />
        </div>
        <div className="flex-1 min-h-[200px]">
          <PreviewComponent className="h-full" />
        </div>
      </div>
    );
  }

  if (screenSize === 'tablet') {
    // Tablet: Capture on top, Shell and Preview side-by-side below
    return (
      <div ref={containerRef} className="h-full flex flex-col gap-2 p-2">
        <div className="flex-1 min-h-[300px]">
          <CaptureComponent className="h-full" />
        </div>
        <div className="flex-1 flex gap-2 min-h-[300px]">
          <div className="flex-1 min-w-[300px]">
            <ShellComponent className="h-full" />
          </div>
          <div className="flex-1 min-w-[300px]">
            <PreviewComponent className="h-full" />
          </div>
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
      <div
        style={{ width: `${componentLayouts.capture.width}%` }}
        className="min-w-[300px] relative"
      >
        <CaptureComponent className="h-full" />
      </div>

      {/* Capture-Shell Divider */}
      {renderDivider('capture-shell', 'w-1 h-full')}

      {/* Shell Component */}
      <div
        style={{ width: `${componentLayouts.shell.width}%` }}
        className="min-w-[250px] relative"
      >
        <ShellComponent className="h-full" />
      </div>

      {/* Shell-Preview Divider */}
      {renderDivider('shell-preview', 'w-1 h-full')}

      {/* Preview Component */}
      <div
        style={{ width: `${componentLayouts.preview.width}%` }}
        className="min-w-[250px] relative"
      >
        <PreviewComponent className="h-full" />
      </div>
    </div>
  );
}