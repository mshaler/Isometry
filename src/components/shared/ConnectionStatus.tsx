/**
 * ConnectionStatus Component - User-facing connection status display
 *
 * Hidden by default, appears only when connection problems occur. Provides
 * subtle loading indicators, clear offline/online status with adaptive behavior
 * messaging, progress display for background sync, and theme system compatibility.
 */

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useConnectionQuality, useOfflineQueue } from '../../context/ConnectionContext';
import { useLiveDataMetrics } from '../../contexts/LiveDataContext';

interface ConnectionStatusProps {
  /** Always show status (for debugging/monitoring) */
  alwaysVisible?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Show detailed metrics */
  showMetrics?: boolean;
}

export function ConnectionStatus({
  alwaysVisible = false,
  className = '',
  compact = false,
  showMetrics = false
}: ConnectionStatusProps) {
  const { isConnected, status, quality, uptime, forceReconnection } = useConnection();
  const { isDegraded, isHealthy } = useConnectionQuality();
  const { hasQueuedOperations, queueStatus, pendingOperations } = useOfflineQueue();
  const { metrics: liveDataMetrics } = useLiveDataMetrics();

  // Local state
  const [isVisible, setIsVisible] = useState(alwaysVisible);
  const [_lastStatusChange, setLastStatusChange] = useState(Date.now());
  const [showDetails, setShowDetails] = useState(false);
  const [animateSync, setAnimateSync] = useState(false);

  // Auto-hide logic - show when there are problems, hide when healthy
  useEffect(() => {
    if (alwaysVisible) return;

    const shouldShow = !isConnected || isDegraded || hasQueuedOperations || status === 'reconnecting';

    if (shouldShow !== isVisible) {
      setIsVisible(shouldShow);
      setLastStatusChange(Date.now());
    }
  }, [isConnected, isDegraded, hasQueuedOperations, status, isVisible, alwaysVisible]);

  // Animate sync indicator when syncing
  useEffect(() => {
    if (status === 'syncing' || hasQueuedOperations) {
      setAnimateSync(true);
      const timer = setInterval(() => {
        setAnimateSync(prev => !prev);
      }, 1000);

      return () => clearInterval(timer);
    }

    setAnimateSync(false);
  }, [status, hasQueuedOperations]);

  // Format uptime display
  const formatUptime = useCallback((uptimeMs: number): string => {
    if (uptimeMs < 1000) return '< 1s';

    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  // Get status color theme
  const getStatusTheme = useCallback(() => {
    if (!isConnected) return 'error';
    if (status === 'reconnecting') return 'warning';
    if (isDegraded) return 'warning';
    if (hasQueuedOperations) return 'info';
    return 'success';
  }, [isConnected, status, isDegraded, hasQueuedOperations]);

  // Get status message
  const getStatusMessage = useCallback(() => {
    if (!isConnected) {
      switch (status) {
        case 'reconnecting':
          return 'Reconnecting...';
        case 'error':
          return 'Connection failed';
        default:
          return 'Offline';
      }
    }

    if (status === 'syncing' || hasQueuedOperations) {
      return `Syncing ${pendingOperations} operations...`;
    }

    if (isDegraded) {
      if (quality.latency > 1000) return 'Slow connection';
      if (quality.reliability < 90) return 'Unstable connection';
      return 'Connection degraded';
    }

    if (isHealthy) return 'Connected';

    return 'Online';
  }, [isConnected, status, hasQueuedOperations, pendingOperations, isDegraded, isHealthy, quality]);

  // Get adaptive behavior message
  const getAdaptiveMessage = useCallback(() => {
    if (!isConnected) {
      return 'Working offline - changes will sync when connection is restored';
    }

    if (isDegraded) {
      if (quality.latency > 1000) {
        return 'Reducing update frequency due to high latency';
      }
      if (quality.reliability < 85) {
        return 'Using cached data to maintain performance';
      }
      return 'Adapting to connection quality';
    }

    if (hasQueuedOperations) {
      return `Background sync in progress`;
    }

    return null;
  }, [isConnected, isDegraded, quality, hasQueuedOperations]);

  // Handle manual reconnection
  const handleReconnection = useCallback(async () => {
    try {
      await forceReconnection();
    } catch (error) {
      console.error('Manual reconnection failed:', error);
    }
  }, [forceReconnection]);

  // Don't render if not visible
  if (!isVisible) return null;

  const theme = getStatusTheme();
  const statusMessage = getStatusMessage();
  const adaptiveMessage = getAdaptiveMessage();

  return (
    <div className={`connection-status connection-status--${theme} ${compact ? 'connection-status--compact' : ''} ${className}`}>
      {/* Main status indicator */}
      <div className="connection-status__main">
        <div className={`connection-status__indicator ${animateSync ? 'connection-status__indicator--animate' : ''}`}>
          <StatusIcon status={status} theme={theme} />
        </div>

        <div className="connection-status__content">
          <div className="connection-status__message">
            {statusMessage}
          </div>

          {adaptiveMessage && !compact && (
            <div className="connection-status__adaptive">
              {adaptiveMessage}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="connection-status__actions">
          {!isConnected && (
            <button
              className="connection-status__action connection-status__action--primary"
              onClick={handleReconnection}
              title="Retry connection"
            >
              Retry
            </button>
          )}

          {!compact && (
            <button
              className="connection-status__action connection-status__action--secondary"
              onClick={() => setShowDetails(!showDetails)}
              title="Show details"
            >
              {showDetails ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Sync progress bar */}
      {(hasQueuedOperations || status === 'syncing') && (
        <div className="connection-status__progress">
          <div className="connection-status__progress-bar">
            <div
              className="connection-status__progress-fill"
              style={{
                width: `${Math.min(100, ((liveDataMetrics?.[0]?.eventCount || 0) / Math.max(1, pendingOperations)) * 100)}%`
              }}
            />
          </div>
          <div className="connection-status__progress-text">
            {pendingOperations} pending
          </div>
        </div>
      )}

      {/* Detailed metrics (expandable) */}
      {showDetails && showMetrics && (
        <div className="connection-status__details">
          <div className="connection-status__metrics">
            <div className="connection-status__metric">
              <span className="connection-status__metric-label">Latency</span>
              <span className="connection-status__metric-value">
                {Math.round(quality.latency)}ms
              </span>
            </div>

            <div className="connection-status__metric">
              <span className="connection-status__metric-label">Reliability</span>
              <span className="connection-status__metric-value">
                {Math.round(quality.reliability)}%
              </span>
            </div>

            <div className="connection-status__metric">
              <span className="connection-status__metric-label">Uptime</span>
              <span className="connection-status__metric-value">
                {formatUptime(uptime)}
              </span>
            </div>

            {hasQueuedOperations && (
              <div className="connection-status__metric">
                <span className="connection-status__metric-label">Queue</span>
                <span className="connection-status__metric-value">
                  H:{queueStatus.byPriority.high} N:{queueStatus.byPriority.normal} L:{queueStatus.byPriority.low}
                </span>
              </div>
            )}
          </div>

          {(liveDataMetrics?.[0]?.outOfOrderPercentage || 0) > 0 && (
            <div className="connection-status__warning">
              Out-of-order events: {(liveDataMetrics?.[0]?.outOfOrderPercentage || 0).toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Status icon component with animations
 */
function StatusIcon({ status, theme: _theme }: { status: string; theme: string }) {
  switch (status) {
    case 'connected':
      return (
        <svg className="connection-status__icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" fill="currentColor" />
        </svg>
      );

    case 'reconnecting':
      return (
        <svg className="connection-status__icon connection-status__icon--spin" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            fill="currentColor"
            opacity="0.3"
          />
          <path
            d="M12 2C17.52 2 22 6.48 22 12h-2C20 7.58 16.42 4 12 4V2z"
            fill="currentColor"
          />
        </svg>
      );

    case 'syncing':
      return (
        <svg className="connection-status__icon connection-status__icon--pulse" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );

    case 'disconnected':
    case 'error':
      return (
        <svg className="connection-status__icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
          <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" />
        </svg>
      );

    case 'degraded':
      return (
        <svg className="connection-status__icon" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
            opacity="0.6"
          />
        </svg>
      );

    default:
      return (
        <svg className="connection-status__icon" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8" fill="currentColor" />
        </svg>
      );
  }
}

/* CSS Styles (would be in a separate .css file) */
export const connectionStatusStyles = `
.connection-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: var(--bg-overlay);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.75rem;
  min-width: 16rem;
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
  z-index: 1000;
  font-size: 0.875rem;
  transition: all 0.3s ease;
}

.connection-status--compact {
  min-width: 12rem;
  padding: 0.5rem;
}

.connection-status--success {
  border-color: var(--success-color);
  color: var(--success-text);
}

.connection-status--warning {
  border-color: var(--warning-color);
  color: var(--warning-text);
}

.connection-status--error {
  border-color: var(--error-color);
  color: var(--error-text);
}

.connection-status--info {
  border-color: var(--info-color);
  color: var(--info-text);
}

.connection-status__main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.connection-status__indicator {
  flex-shrink: 0;
}

.connection-status__icon {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 0.2s ease;
}

.connection-status__icon--spin {
  animation: spin 1s linear infinite;
}

.connection-status__icon--pulse {
  animation: pulse 2s ease-in-out infinite;
}

.connection-status__indicator--animate {
  transform: scale(1.1);
}

.connection-status__content {
  flex: 1;
}

.connection-status__message {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.connection-status__adaptive {
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.3;
}

.connection-status__actions {
  display: flex;
  gap: 0.5rem;
}

.connection-status__action {
  border: none;
  background: transparent;
  color: currentColor;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.connection-status__action--primary {
  background: var(--accent-color);
  color: var(--accent-text);
}

.connection-status__action:hover {
  background: var(--hover-color);
}

.connection-status__progress {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.connection-status__progress-bar {
  flex: 1;
  height: 0.25rem;
  background: var(--bg-secondary);
  border-radius: 0.125rem;
  overflow: hidden;
}

.connection-status__progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.connection-status__progress-text {
  font-size: 0.75rem;
  white-space: nowrap;
}

.connection-status__details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.connection-status__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.connection-status__metric {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.connection-status__metric-label {
  opacity: 0.7;
}

.connection-status__metric-value {
  font-weight: 500;
}

.connection-status__warning {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--warning-text);
  text-align: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Theme compatibility */
.theme-nextstep .connection-status {
  font-family: var(--font-mono);
  border-color: var(--nextstep-border);
  background: var(--nextstep-bg-panel);
}

.theme-modern .connection-status {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
}

/* Compact mode adjustments */
.connection-status--compact .connection-status__adaptive {
  display: none;
}

.connection-status--compact .connection-status__metrics {
  grid-template-columns: 1fr;
}
`;

export default ConnectionStatus;