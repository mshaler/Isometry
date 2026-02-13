import { useEffect, useState, useRef } from 'react';
import { CaptureComponent } from './CaptureComponent';
import { ShellComponent } from './ShellComponent';
import { PreviewComponent } from './PreviewComponent';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { FocusProvider, useFocusContext, useFocusableComponent } from '../../context/FocusContext';
import { TerminalProvider } from '../../context/TerminalContext';

function NotebookLayoutInner() {
  const { focusComponent } = useFocusContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus management refs
  const captureRef = useFocusableComponent('capture');
  const shellRef = useFocusableComponent('shell');
  const previewRef = useFocusableComponent('preview');
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

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

  // Desktop: Three equal columns using CSS Grid (truly equal widths)
  return (
    <div
      ref={containerRef}
      className="h-full w-full grid grid-cols-3 gap-px p-1 overflow-hidden"
    >
      {/* Capture Component - 1/3 */}
      <ErrorBoundary level="feature" name="CaptureComponent">
        <div
          ref={captureRef}
          className="relative focusable-component overflow-hidden min-w-0"
          tabIndex={0}
        >
          <CaptureComponent className="h-full w-full" />
        </div>
      </ErrorBoundary>

      {/* Shell Component - 1/3 */}
      <ErrorBoundary level="feature" name="ShellComponent">
        <div
          ref={shellRef}
          className="relative focusable-component overflow-hidden min-w-0"
          tabIndex={0}
        >
          <ShellComponent className="h-full w-full" />
        </div>
      </ErrorBoundary>

      {/* Preview Component - 1/3 */}
      <ErrorBoundary level="feature" name="PreviewComponent">
        <div
          ref={previewRef}
          className="relative focusable-component overflow-hidden min-w-0"
          tabIndex={0}
        >
          <PreviewComponent className="h-full w-full" />
        </div>
      </ErrorBoundary>
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