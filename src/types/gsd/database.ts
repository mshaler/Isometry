/**
 * GSD Database Types
 *
 * TypeScript interfaces for GSD SQLite schema
 * Provides type safety for database operations
 */

// ============================================================================
// Core GSD Database Types
// ============================================================================

export interface GSDProject {
  id: string;
  name: string;
  content?: string;
  summary?: string;
  created_at: string;
  modified_at: string;
  tags?: string[]; // JSON parsed
  status?: string;
  priority?: number;
}

export interface GSDSession {
  id: string;
  project_node_id: string;
  session_name: string;
  session_type: 'standard' | 'research' | 'planning' | 'execution';

  // Session state
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'archived';
  current_phase: number;
  total_phases: number;
  progress_percentage: number;

  // Context and configuration
  context?: Record<string, unknown>; // JSON parsed
  configuration?: Record<string, unknown>; // JSON parsed
  claude_session_id?: string;

  // Timestamps
  started_at: string;
  last_activity_at: string;
  completed_at?: string;
  archived_at?: string;

  // Metadata
  created_by?: string;
  notes?: string;
  version: number;
}

export interface GSDPhase {
  id: string;
  session_id: string;
  phase_node_id?: string;

  // Phase identification
  phase_number: number;
  phase_name: string;
  phase_type: 'research' | 'planning' | 'implementation' | 'testing' | 'documentation' | 'review';

  // Phase state
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'blocked';
  progress_percentage: number;

  // Phase content
  description?: string;
  goals?: string[]; // JSON parsed
  acceptance_criteria?: string[]; // JSON parsed
  artifacts?: string[]; // JSON parsed
  dependencies?: string[]; // JSON parsed

  // Execution tracking
  started_at?: string;
  completed_at?: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;

  // Results and output
  results?: Record<string, unknown>; // JSON parsed
  artifacts_produced?: string[]; // JSON parsed
  notes?: string;
}

export interface GSDDecision {
  id: string;
  session_id: string;
  phase_id?: string;

  // Decision context
  decision_point: string;
  decision_type: 'choice' | 'input' | 'confirmation' | 'branch';
  decision_context?: Record<string, unknown>; // JSON parsed

  // Options and choice
  options_presented?: string[]; // JSON parsed
  choice_made: string;
  choice_reasoning?: string;

  // Execution impact
  impact_on_workflow?: Record<string, unknown>; // JSON parsed
  alternative_paths?: Record<string, unknown>; // JSON parsed

  // Timestamps
  presented_at: string;
  decided_at: string;

  // Metadata
  auto_decided: boolean;
  confidence_score?: number;
  decision_source?: 'user' | 'auto' | 'claude' | 'template';
}

export interface GSDCommand {
  id: string;
  session_id: string;
  phase_id?: string;

  // Command identification
  command_type: string;
  command_label: string;
  slash_command?: string;

  // Command state
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;

  // Command data
  input_data?: Record<string, unknown>; // JSON parsed
  output_data?: Record<string, unknown>; // JSON parsed
  error_data?: Record<string, unknown>; // JSON parsed

  // Execution tracking
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;

  // Backend tracking
  claude_command_id?: string;
  backend_response?: string;

  // Parent/child relationships
  parent_command_id?: string;
  sequence_order: number;
}

export interface GSDTemplate {
  id: string;
  template_name: string;
  template_type: 'project' | 'phase' | 'workflow' | 'decision-tree';

  // Template content
  description?: string;
  template_data: Record<string, unknown>; // JSON parsed
  default_configuration?: Record<string, unknown>; // JSON parsed

  // Template metadata
  category?: string;
  tags?: string[]; // JSON parsed
  complexity_level: 'simple' | 'medium' | 'complex';
  estimated_duration_minutes?: number;

  // Usage tracking
  usage_count: number;
  last_used_at?: string;

  // Versioning and sharing
  version: string;
  author?: string;
  is_public: boolean;
  is_system: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface GSDAnalytics {
  id: string;
  session_id?: string;

  // Analytics type and scope
  metric_type: string;
  metric_scope: 'session' | 'phase' | 'command' | 'decision' | 'global';

  // Metric data
  metric_value: number;
  metric_unit: string;
  metric_context?: Record<string, unknown>; // JSON parsed

  // Timestamps
  recorded_at: string;
  period_start?: string;
  period_end?: string;

  // Metadata
  tags?: string[]; // JSON parsed
  notes?: string;
}

// ============================================================================
// View Types (for complex queries)
// ============================================================================

export interface GSDActiveProject {
  project_id: string;
  project_name: string;
  project_description?: string;
  project_created: string;
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  last_activity?: string;
  avg_progress: number;
}

export interface GSDSessionProgress {
  session_id: string;
  session_name: string;
  session_status: string;
  session_progress: number;
  total_phases: number;
  completed_phases: number;
  active_phases: number;
  blocked_phases: number;
  started_at: string;
  last_activity_at: string;
}

export interface GSDDecisionHistory {
  decision_id: string;
  decision_point: string;
  decision_type: string;
  choice_made: string;
  decided_at: string;
  session_name: string;
  phase_name?: string;
  confidence_score?: number;
  decision_source?: string;
}

// ============================================================================
// Database Operation Types
// ============================================================================

export interface CreateGSDProjectParams {
  name: string;
  description?: string;
  tags?: string[];
  priority?: number;
}

export interface CreateGSDSessionParams {
  project_node_id: string;
  session_name: string;
  session_type?: GSDSession['session_type'];
  context?: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  created_by?: string;
}

export interface CreateGSDPhaseParams {
  session_id: string;
  phase_number: number;
  phase_name: string;
  phase_type: GSDPhase['phase_type'];
  description?: string;
  goals?: string[];
  acceptance_criteria?: string[];
  estimated_duration_minutes?: number;
}

export interface UpdateGSDPhaseProgressParams {
  phase_id: string;
  status?: GSDPhase['status'];
  progress_percentage?: number;
  results?: Record<string, unknown>;
  artifacts_produced?: string[];
  notes?: string;
}

export interface CreateGSDDecisionParams {
  session_id: string;
  phase_id?: string;
  decision_point: string;
  decision_type: GSDDecision['decision_type'];
  options_presented?: string[];
  choice_made: string;
  choice_reasoning?: string;
  confidence_score?: number;
  decision_source?: GSDDecision['decision_source'];
}

export interface CreateGSDCommandParams {
  session_id: string;
  phase_id?: string;
  command_type: string;
  command_label: string;
  slash_command?: string;
  input_data?: Record<string, unknown>;
  parent_command_id?: string;
}

export interface UpdateGSDCommandParams {
  command_id: string;
  status?: GSDCommand['status'];
  progress_percentage?: number;
  output_data?: Record<string, unknown>;
  error_data?: Record<string, unknown>;
  claude_command_id?: string;
  backend_response?: string;
}

// ============================================================================
// Query Builder Types
// ============================================================================

export interface GSDSessionFilter {
  project_id?: string;
  status?: GSDSession['status'][];
  session_type?: GSDSession['session_type'][];
  created_by?: string;
  start_date?: string;
  end_date?: string;
  has_activity_since?: string;
}

export interface GSDPhaseFilter {
  session_id?: string;
  status?: GSDPhase['status'][];
  phase_type?: GSDPhase['phase_type'][];
  has_dependencies?: boolean;
  is_blocked?: boolean;
}

export interface GSDDecisionFilter {
  session_id?: string;
  phase_id?: string;
  decision_type?: GSDDecision['decision_type'][];
  decision_source?: GSDDecision['decision_source'][];
  confidence_min?: number;
  date_range?: { start: string; end: string };
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface GSDProductivityMetrics {
  avg_session_duration_hours: number;
  avg_phases_per_session: number;
  phase_completion_rate: number;
  decision_speed_avg_minutes: number;
  most_used_templates: Array<{
    template_name: string;
    usage_count: number;
  }>;
  productivity_trend: Array<{
    period: string;
    sessions_completed: number;
    avg_progress: number;
  }>;
}

export interface GSDSessionAnalytics {
  session_id: string;
  total_duration_hours: number;
  phases_completed: number;
  decisions_made: number;
  commands_executed: number;
  avg_decision_confidence: number;
  productivity_score: number; // Calculated metric
  bottleneck_phases: string[]; // Phases that took longest
}

// ============================================================================
// Integration Types (with existing Isometry schema)
// ============================================================================

export interface GSDNodeIntegration {
  // How GSD entities map to existing nodes
  gsd_entity_type: 'project' | 'session' | 'phase' | 'artifact';
  gsd_entity_id: string;
  node_id: string;
  integration_metadata?: Record<string, unknown>;
  sync_status: 'synced' | 'pending' | 'conflict' | 'error';
  last_sync_at: string;
}

export interface GSDNotebookIntegration {
  // How GSD sessions integrate with notebook cards
  session_id: string;
  capture_card_id?: string; // For session context and notes
  shell_card_id?: string; // For command execution
  preview_card_id?: string; // For results and artifacts
  integration_config?: Record<string, unknown>;
}