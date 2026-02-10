import React, { useState } from 'react';

// Router and providers are handled by parent MVPDemo component

// Import all Figma components
import { Toolbar } from './Toolbar';
import { Navigator } from './Navigator';
import { HeaderBar } from './chrome/HeaderBar';
import { Sidebar } from './chrome/Sidebar';
import { RightSidebar } from './RightSidebar';
import { Canvas } from './Canvas';
import { NavigatorFooter } from './NavigatorFooter';
import { CommandBar } from './CommandBar';
import { ErrorBoundary } from './ui/ErrorBoundary';
//import { NotificationSystem } from './ui/NotificationSystem';
import { EnvironmentDebug } from './debug/EnvironmentDebug';
import { ConflictResolutionModal, type ResolutionDecision } from './ConflictResolutionModal';
import { useConflictResolution } from '@/hooks';

/**
 * Unified App Component
 *
 * Combines our working MVP Canvas with all Figma-designed UI components
 * following the architectural layout:
 *
 * - Toolbar (menu + commands)
 * - Navigator (app/view selectors)
 * - PAFVNavigator (axis wells)
 * - MainContent
 *   - Sidebar (LATCH filters)
 *   - Canvas (with MVP data visualization)
 *   - RightSidebar (formats/settings)
 * - NavigatorFooter (map + time)
 * - CommandBar (DSL input)
 */
export function UnifiedApp() {
  // State for chrome layout coordination
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize conflict resolution (will not show modal unless conflicts exist)
  const {
    conflicts,
    pendingConflictDiff,
    resolveConflict,
    toasts,
    hasUnresolvedConflicts,
    isResolving,
  } = useConflictResolution();

  // Development: Log conflict resolution state changes only
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Conflict Resolution State Changed:', {
        conflictCount: conflicts.length,
        hasUnresolvedConflicts,
        pendingConflictDiff: !!pendingConflictDiff,
        toastCount: toasts.length,
        isResolving,
      });
    }
  }, [conflicts.length, hasUnresolvedConflicts, !!pendingConflictDiff, toasts.length, isResolving]);

  const handleResolve = async (decision: ResolutionDecision) => {
    if (conflicts[0]) {
      await resolveConflict(conflicts[0].nodeId, decision);
    }
  };

  const handleCancel = () => {
    // Just close modal by not showing it
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Environment Debug Info */}
      <EnvironmentDebug />

      {/* Toolbar: Menu bar + command buttons */}
      <ErrorBoundary level="component" name="Toolbar">
        <Toolbar />
      </ErrorBoundary>

      {/* HeaderBar: Breadcrumbs + Search + Actions */}
      <ErrorBoundary level="component" name="HeaderBar">
        <HeaderBar
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
      </ErrorBoundary>

      {/* Navigator: App/View/Dataset selectors */}
      <ErrorBoundary level="component" name="Navigator">
        <Navigator />
      </ErrorBoundary>

      {/* PAFVNavigator: Already included in Navigator component above */}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: LATCH filters + Templates */}
        <ErrorBoundary level="feature" name="Sidebar">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </ErrorBoundary>

        {/* Central Canvas: Main data visualization */}
        <div className="flex-1 flex flex-col">
          <ErrorBoundary level="feature" name="Canvas">
            <Canvas />
          </ErrorBoundary>
        </div>

        {/* Right Sidebar: Formats + Settings */}
        <ErrorBoundary level="feature" name="RightSidebar">
          <RightSidebar />
        </ErrorBoundary>
      </div>

      {/* Navigator Footer: Location map + Time slider */}
      <ErrorBoundary level="component" name="NavigatorFooter">
        <NavigatorFooter />
      </ErrorBoundary>

      {/* Command Bar: DSL command input */}
      <ErrorBoundary level="feature" name="CommandBar">
        <CommandBar />
      </ErrorBoundary>

      {/* Conflict Resolution Modal - only shows when conflicts exist */}
      <ConflictResolutionModal
        conflict={conflicts[0] || null}
        conflictDiff={pendingConflictDiff}
        isVisible={hasUnresolvedConflicts && !!pendingConflictDiff}
        onResolve={handleResolve}
        onCancel={handleCancel}
        isResolving={isResolving}
      />

      {/* Toast notifications for conflict resolution */}
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`fixed top-4 right-4 p-3 rounded shadow-lg text-white text-sm z-50 ${
            toast.type === 'error' ? 'bg-red-500' :
            toast.type === 'auto-resolved' ? 'bg-green-500' :
            'bg-blue-500'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
