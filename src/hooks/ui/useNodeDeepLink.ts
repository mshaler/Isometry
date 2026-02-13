/**
 * useNodeDeepLink - Deep link hook for node focusing via URL parameter
 *
 * Reads `nodeId` from URL search params and:
 * 1. Validates node exists in database
 * 2. Triggers selection and scroll-to-view
 * 3. Keeps URL param for shareability (enables copy-paste sharing)
 *
 * Usage: Add to App component to enable ?nodeId={id} deep linking
 *
 * @see Phase 78-01: URL Deep Linking
 */
import { useEffect, useRef } from 'react';
import { useSQLite } from '../../db/SQLiteProvider';
import { useSelection } from '../../state/SelectionContext';
import { devLogger } from '../../utils/logging';

/**
 * Hook that handles deep linking to specific nodes via URL parameter.
 *
 * When the app loads with ?nodeId=xxx, this hook:
 * - Validates the node exists
 * - Selects the node
 * - Scrolls it into view (if scrollToNode is registered by the view)
 *
 * The URL parameter is preserved for shareability.
 */
export function useNodeDeepLink(): void {
  const { db, loading } = useSQLite();
  const { select, scrollToNode } = useSelection();

  // Track if we've already processed the deep link (prevent re-triggering)
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for database to be ready
    if (loading || !db) return;

    // Read nodeId from URL
    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get('nodeId');

    // No nodeId or already processed this one
    if (!nodeId || processedRef.current === nodeId) return;

    // Validate node exists in database
    try {
      const result = db.exec(
        `SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL`,
        [nodeId]
      );

      if (result.length === 0 || result[0].values.length === 0) {
        devLogger.warn('Deep link node not found', { nodeId });
        // Mark as processed to avoid repeated warnings
        processedRef.current = nodeId;
        return;
      }

      // Node exists - select it
      devLogger.info('Deep link activated', { nodeId });
      select(nodeId);

      // Scroll to node if view has registered a scroll function
      if (scrollToNode) {
        // Small delay to ensure view has rendered
        requestAnimationFrame(() => {
          scrollToNode(nodeId);
        });
      }

      // Mark as processed
      processedRef.current = nodeId;

      // Note: We intentionally keep the URL param for shareability
      // Users can copy the URL to share the deep link with others
    } catch (error) {
      devLogger.error('Deep link error', {
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      });
      processedRef.current = nodeId;
    }
  }, [db, loading, select, scrollToNode]);
}
