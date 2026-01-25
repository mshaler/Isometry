// Node (Card) types

export type NodeType = 'note' | 'task' | 'contact' | 'event' | 'project' | 'resource' | 'notebook';
export type TaskStatus = 'active' | 'pending' | 'completed' | 'archived';
export type EdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

export interface Node {
  id: string;
  nodeType: NodeType;
  name: string;
  content: string | null;
  summary: string | null;
  
  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
  
  // LATCH: Time
  createdAt: string;
  modifiedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  
  // LATCH: Category
  folder: string | null;
  tags: string[];
  status: TaskStatus | null;
  
  // LATCH: Hierarchy
  priority: number;
  importance: number;
  sortOrder: number;
  
  // Metadata
  source: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  deletedAt: string | null;
  version: number;
}

export interface Edge {
  id: string;
  edgeType: EdgeType;
  sourceId: string;
  targetId: string;
  label: string | null;
  weight: number;
  directed: boolean;
  sequenceOrder: number | null;
  channel: string | null;
  timestamp: string | null;
  subject: string | null;
  createdAt: string;
}

// Database row converters
export function rowToNode(row: Record<string, unknown>): Node {
  return {
    id: row.id as string,
    nodeType: row.node_type as NodeType,
    name: row.name as string,
    content: row.content as string | null,
    summary: row.summary as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    locationName: row.location_name as string | null,
    locationAddress: row.location_address as string | null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
    dueAt: row.due_at as string | null,
    completedAt: row.completed_at as string | null,
    eventStart: row.event_start as string | null,
    eventEnd: row.event_end as string | null,
    folder: row.folder as string | null,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    status: row.status as TaskStatus | null,
    priority: (row.priority as number) ?? 0,
    importance: (row.importance as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
    sourceUrl: row.source_url as string | null,
    deletedAt: row.deleted_at as string | null,
    version: (row.version as number) ?? 1,
  };
}
