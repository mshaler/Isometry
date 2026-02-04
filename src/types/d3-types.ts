/**
 * D3 Component Interface Types
 *
 * Centralized type definitions for D3 React component props
 * to ensure consistent interfaces across the application.
 */

import type { Node } from './node';

/** Props interface for D3ListView component */
export interface D3ListViewProps {
  /** SQL query to execute and observe for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Direct data array (alternative to SQL query) */
  data?: Node[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}

/** Props interface for D3GridView component */
export interface D3GridViewProps {
  /** SQL query to execute and observe for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Direct data array (alternative to SQL query) */
  data?: Node[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}