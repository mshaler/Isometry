/**
 * Filter Types - LATCH filtering system
 */

export interface LATCHFilter {
  id: string;
  dimension: 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
  value: unknown;
  displayValue: string;
  label: string;
  category: 'user' | 'system' | 'suggested';
}