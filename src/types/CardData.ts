// Shared CardData interface used across all views
export interface CardData {
  id: string;
  name: string;
  content: string | null;
  category: string | null;
  status: string | null;
  priority: number;
  parent_id: string | null;
  created: string | null;
  due: string | null;
  dataset_id?: string;
}
