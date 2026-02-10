/**
 * Header Types - Shared interfaces for header modules
 */

import type {
  ProgressiveDisclosureConfig,
} from '../types/supergrid';
import { DEFAULT_PROGRESSIVE_CONFIG } from '../types/supergrid';

export interface SuperGridHeadersConfig {
  defaultHeaderHeight: number;
  expandIconSize: number;
  animationDuration: number;
  maxVisibleLevels: number;
  enableProgressiveRendering: boolean;
  performanceBudgetMs: number;

  // Progressive disclosure configuration
  progressiveDisclosure: ProgressiveDisclosureConfig;
}

export const DEFAULT_HEADER_CONFIG: SuperGridHeadersConfig = {
  defaultHeaderHeight: 40,
  expandIconSize: 16,
  animationDuration: 300,
  maxVisibleLevels: 5,
  enableProgressiveRendering: true,
  performanceBudgetMs: 16, // ~60fps budget

  // Progressive disclosure configuration
  progressiveDisclosure: DEFAULT_PROGRESSIVE_CONFIG
};