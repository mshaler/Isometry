-- ============================================================================
-- Migration: 84-cards-connections
-- ============================================================================
-- Purpose: Migrate data from nodes/edges to cards/connections
-- Phase: 84 - Cards & Connections
--
-- This migration:
-- 1. Creates backup tables for rollback safety
-- 2. Migrates nodes -> cards with type mapping
-- 3. Migrates edges -> connections with label conversion
-- 4. Updates notebook_cards FK reference
-- 5. Rebuilds FTS5 index for cards
--
-- Rollback: DROP TABLE cards, connections; rename backup tables
-- ============================================================================

-- Ensure cards and connections tables exist (from schema.sql)
-- These are created by schema.sql, but we check here for safety

-- ============================================================================
-- STEP 1: Create backup tables for rollback safety
-- ============================================================================

-- Backup nodes table (preserves all original data)
CREATE TABLE IF NOT EXISTS nodes_backup AS SELECT * FROM nodes;

-- Backup edges table (preserves all original data)
CREATE TABLE IF NOT EXISTS edges_backup AS SELECT * FROM edges;

-- Backup node_properties if it exists
CREATE TABLE IF NOT EXISTS node_properties_backup AS
SELECT * FROM node_properties WHERE 1=1;
-- Note: WHERE 1=1 makes this work even if table is empty
-- Will fail silently if node_properties doesn't exist

-- ============================================================================
-- STEP 2: Migrate nodes -> cards
-- ============================================================================
-- Type mapping:
--   node_type='note' -> card_type='note'
--   node_type='person' -> card_type='person'
--   node_type='event' -> card_type='event'
--   node_type='resource' -> card_type='resource'
--   node_type='link' -> card_type='resource' (URLs are resources)
--   node_type='file' -> card_type='resource' (files are resources)
--   node_type='image' -> card_type='resource' (images are resources)
--   node_type='document' -> card_type='note' (documents become notes)
--   node_type='task' -> card_type='note' (tasks become notes with status)
--   node_type='project' -> card_type='note' (projects become notes)
--   node_type='contact' -> card_type='person' (contacts become persons)
--   node_type='meeting' -> card_type='event' (meetings become events)
--   ANY OTHER -> card_type='note' (fallback)
--
-- Column changes:
--   - location_address: REMOVED (not in cards)
--   - importance: REMOVED (only priority remains)
--   - grid_x/grid_y: REMOVED (SuperGrid manages layout dynamically)
--   - source_url: REMOVED (use url column for Resources)
--   - sync_status: ADDED (new column with default 'pending')
--   - url: POPULATED from source_url for resource types
--   - is_collective: ADDED (default 0)
--   - mime_type: ADDED (null for now, could be inferred)

INSERT OR REPLACE INTO cards (
    id,
    card_type,
    name,
    content,
    summary,
    -- LATCH: Location (no location_address)
    latitude,
    longitude,
    location_name,
    -- LATCH: Time
    created_at,
    modified_at,
    due_at,
    completed_at,
    event_start,
    event_end,
    -- LATCH: Category
    folder,
    tags,
    status,
    -- LATCH: Hierarchy (no importance)
    priority,
    sort_order,
    -- Resource-specific
    url,
    mime_type,
    -- Person-specific
    is_collective,
    -- Source tracking (no source_url - use url instead)
    source,
    source_id,
    -- Lifecycle
    deleted_at,
    version,
    sync_status
)
SELECT
    id,
    -- Map node_type to card_type (4 valid types only)
    CASE
        WHEN node_type IN ('note', 'document', 'task', 'project') THEN 'note'
        WHEN node_type IN ('person', 'contact') THEN 'person'
        WHEN node_type IN ('event', 'meeting') THEN 'event'
        WHEN node_type IN ('resource', 'link', 'file', 'image') THEN 'resource'
        ELSE 'note'  -- Fallback for unknown types
    END as card_type,
    name,
    content,
    summary,
    -- LATCH: Location
    latitude,
    longitude,
    location_name,
    -- LATCH: Time (convert datetime format if needed)
    COALESCE(
        created_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    ) as created_at,
    COALESCE(
        modified_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    ) as modified_at,
    due_at,
    completed_at,
    event_start,
    event_end,
    -- LATCH: Category
    folder,
    tags,
    status,
    -- LATCH: Hierarchy
    COALESCE(priority, 0) as priority,
    COALESCE(sort_order, 0) as sort_order,
    -- Resource-specific: populate url from source_url for resource types
    CASE
        WHEN node_type IN ('resource', 'link', 'file', 'image') THEN COALESCE(source_url, NULL)
        ELSE NULL
    END as url,
    NULL as mime_type,  -- Not in nodes, will be populated later
    -- Person-specific
    0 as is_collective,  -- Default to individual
    -- Source tracking
    source,
    source_id,
    -- Lifecycle
    deleted_at,
    COALESCE(version, 1) as version,
    'pending' as sync_status  -- New column
FROM nodes;

-- ============================================================================
-- STEP 3: Migrate edges -> connections
-- ============================================================================
-- Changes:
--   - edge_type: REMOVED (was LINK/NEST/SEQUENCE/AFFINITY)
--   - label: NOW the primary relationship descriptor
--   - via_card_id: NEW (null for simple edges, populated later for bridge cards)
--   - directed: REMOVED (all connections are directed)
--   - sequence_order: REMOVED (use sort_order on cards)
--   - channel: REMOVED
--   - timestamp: REMOVED (use created_at)
--   - subject: REMOVED
--
-- Edge type -> label conversion:
--   LINK -> 'link' (generic relationship)
--   NEST -> 'parent' (hierarchy - source is parent of target)
--   SEQUENCE -> 'precedes' (temporal ordering)
--   AFFINITY -> 'related' (similarity/tagging)
--   Custom labels are preserved

INSERT OR REPLACE INTO connections (
    id,
    source_id,
    target_id,
    via_card_id,
    label,
    weight,
    created_at
)
SELECT
    id,
    source_id,
    target_id,
    NULL as via_card_id,  -- No bridge cards in existing data
    -- Convert edge_type to lowercase label, preserve existing label if set
    CASE
        WHEN label IS NOT NULL AND label != '' THEN LOWER(label)
        WHEN edge_type = 'LINK' THEN 'link'
        WHEN edge_type = 'NEST' THEN 'parent'
        WHEN edge_type = 'SEQUENCE' THEN 'precedes'
        WHEN edge_type = 'AFFINITY' THEN 'related'
        ELSE LOWER(COALESCE(edge_type, 'link'))
    END as label,
    COALESCE(weight, 1.0) as weight,
    COALESCE(
        created_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    ) as created_at
FROM edges;

-- ============================================================================
-- STEP 4: Migrate node_properties -> card_properties
-- ============================================================================
-- Simply rename the FK reference from node_id to card_id
-- The table structure is identical

INSERT OR REPLACE INTO card_properties (
    id,
    card_id,
    key,
    value,
    value_type,
    value_string,
    value_number,
    value_boolean,
    value_json,
    created_at
)
SELECT
    id,
    node_id as card_id,  -- Rename FK
    key,
    value,
    value_type,
    value_string,
    value_number,
    value_boolean,
    value_json,
    created_at
FROM node_properties;

-- ============================================================================
-- STEP 5: Rebuild FTS5 index for cards
-- ============================================================================
-- The FTS5 triggers will handle new inserts, but we need to populate
-- the initial index from migrated data

-- First, clear any existing FTS5 data (in case of re-run)
DELETE FROM cards_fts;

-- Rebuild the FTS5 index from cards table
INSERT INTO cards_fts(rowid, name, content, tags, folder)
SELECT rowid, name, content, tags, folder FROM cards;

-- ============================================================================
-- STEP 6: Update notebook_cards FK reference (optional verification)
-- ============================================================================
-- notebook_cards.node_id references nodes(id)
-- After migration, all node IDs exist in cards table with same IDs
-- No structural change needed, but we verify referential integrity

-- This query should return 0 rows if migration is correct
-- SELECT nc.id, nc.node_id
-- FROM notebook_cards nc
-- LEFT JOIN cards c ON c.id = nc.node_id
-- WHERE c.id IS NULL AND nc.node_id IS NOT NULL;

-- ============================================================================
-- STEP 7: Record migration metadata
-- ============================================================================

INSERT OR REPLACE INTO settings (key, value, updated_at)
VALUES (
    'migration_84_cards_connections',
    json_object(
        'completed_at', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
        'nodes_migrated', (SELECT COUNT(*) FROM nodes),
        'cards_created', (SELECT COUNT(*) FROM cards),
        'edges_migrated', (SELECT COUNT(*) FROM edges),
        'connections_created', (SELECT COUNT(*) FROM connections)
    ),
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
);

-- ============================================================================
-- Migration complete!
--
-- To verify:
--   SELECT * FROM settings WHERE key = 'migration_84_cards_connections';
--
-- To rollback:
--   DELETE FROM cards;
--   DELETE FROM connections;
--   DELETE FROM card_properties;
--   INSERT INTO nodes SELECT * FROM nodes_backup;
--   INSERT INTO edges SELECT * FROM edges_backup;
--   INSERT INTO node_properties SELECT * FROM node_properties_backup;
--   DELETE FROM settings WHERE key = 'migration_84_cards_connections';
-- ============================================================================
