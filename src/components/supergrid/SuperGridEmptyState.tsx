/**
 * SuperGridEmptyState - Informative empty state variants (UX-01)
 *
 * Part of Phase 93 - Polish & Performance
 *
 * Three variants per UX research:
 * 1. first-use: No data yet, guide user to add items
 * 2. no-results: Filters active, no matches found
 * 3. error: Query or load failed
 *
 * Each variant has:
 * - Clear explanation (why empty)
 * - Actionable CTA (what to do next)
 * - Visual icon
 */

import { type ReactNode } from 'react';

export type EmptyStateType = 'first-use' | 'no-results' | 'error';

interface SuperGridEmptyStateProps {
  /** Type of empty state to display */
  type: EmptyStateType;
  /** Optional error message for 'error' type */
  errorMessage?: string;
  /** Optional custom action button */
  action?: ReactNode;
  /** Optional SQL query for debugging */
  sql?: string;
}

interface EmptyStateConfig {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHandler?: () => void;
}

function getEmptyStateConfig(type: EmptyStateType, errorMessage?: string): EmptyStateConfig {
  switch (type) {
    case 'first-use':
      return {
        icon: '\u{1F4CA}', // Bar chart emoji (Unicode escape)
        title: 'No Data Yet',
        description: 'Import data from Apple Notes, Markdown files, or create your first card to get started.',
        actionLabel: 'Import Data',
        actionHandler: () => {
          // Dispatch custom event for Shell to handle import
          window.dispatchEvent(new CustomEvent('supergrid:import-request'));
        },
      };

    case 'no-results':
      return {
        icon: '\u{1F50D}', // Magnifying glass emoji (Unicode escape)
        title: 'No Matching Results',
        description: "Your current filters don't match any items. Try adjusting your LATCH filters or clearing the search.",
        actionLabel: 'Clear Filters',
        actionHandler: () => {
          // Dispatch custom event for FilterContext to clear
          window.dispatchEvent(new CustomEvent('supergrid:clear-filters'));
        },
      };

    case 'error':
      return {
        icon: '\u{26A0}\u{FE0F}', // Warning emoji (Unicode escape)
        title: 'Failed to Load Data',
        description: errorMessage || 'An error occurred while loading the grid data. Please try again.',
        actionLabel: 'Retry',
        actionHandler: () => {
          // Dispatch custom event to trigger reload
          window.dispatchEvent(new CustomEvent('supergrid:retry-load'));
        },
      };
  }
}

/**
 * SuperGridEmptyState - Informative empty state display
 *
 * @example
 * ```tsx
 * // First use - no data
 * <SuperGridEmptyState type="first-use" />
 *
 * // No results after filtering
 * <SuperGridEmptyState type="no-results" />
 *
 * // Error state with details
 * <SuperGridEmptyState
 *   type="error"
 *   errorMessage="Database connection failed"
 *   sql={query}
 * />
 * ```
 */
export function SuperGridEmptyState({
  type,
  errorMessage,
  action,
  sql,
}: SuperGridEmptyStateProps): JSX.Element {
  const config = getEmptyStateConfig(type, errorMessage);

  return (
    <div
      className="supergrid-empty-state"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        minHeight: '300px',
        background: '#fafafa',
        borderRadius: '8px',
        border: '1px dashed #e5e7eb',
      }}
    >
      {/* Icon */}
      <div
        className="supergrid-empty-state__icon"
        style={{
          fontSize: '48px',
          marginBottom: '16px',
          opacity: 0.8,
        }}
        aria-hidden="true"
      >
        {config.icon}
      </div>

      {/* Title */}
      <h3
        className="supergrid-empty-state__title"
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f2937',
          margin: '0 0 8px 0',
        }}
      >
        {config.title}
      </h3>

      {/* Description */}
      <p
        className="supergrid-empty-state__description"
        style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '0 0 24px 0',
          maxWidth: '400px',
          lineHeight: 1.5,
        }}
      >
        {config.description}
      </p>

      {/* Action button */}
      {action ? (
        action
      ) : config.actionLabel ? (
        <button
          className="supergrid-empty-state__action"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#ffffff',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          onClick={config.actionHandler}
        >
          {config.actionLabel}
        </button>
      ) : null}

      {/* Debug info for error state */}
      {type === 'error' && sql && (
        <details
          style={{
            marginTop: '24px',
            fontSize: '12px',
            color: '#9ca3af',
            maxWidth: '100%',
          }}
        >
          <summary style={{ cursor: 'pointer' }}>SQL Query (Debug)</summary>
          <code
            style={{
              display: 'block',
              marginTop: '8px',
              padding: '8px',
              background: '#f3f4f6',
              borderRadius: '4px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {sql}
          </code>
        </details>
      )}
    </div>
  );
}
