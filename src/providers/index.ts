// Isometry v5 — Phase 4 Providers Public API
// Re-exports all provider types, allowlist utilities, and providers.
//
// Downstream consumers (views, StateManager, QueryBuilder) import from here.

// Allowlist sets and validation utilities
export {
	ALLOWED_AXIS_FIELDS,
	ALLOWED_FILTER_FIELDS,
	ALLOWED_OPERATORS,
	isValidAxisField,
	isValidFilterField,
	isValidOperator,
	setSchemaProvider,
	validateAxisField,
	validateFilterField,
	validateOperator,
} from './allowlist';
export { SchemaProvider } from './SchemaProvider';
export { setLatchSchemaProvider } from './latch';
export { DensityProvider } from './DensityProvider';

// Providers
export { FilterProvider } from './FilterProvider';
export { PAFVProvider } from './PAFVProvider';
// QueryBuilder types
export type { CardQueryOptions, CompiledQuery } from './QueryBuilder';
export { QueryBuilder } from './QueryBuilder';
export { SelectionProvider } from './SelectionProvider';
export { StateCoordinator } from './StateCoordinator';
export { StateManager } from './StateManager';
export { ThemeProvider } from './ThemeProvider';
// Type system
export type {
	AxisField,
	AxisMapping,
	CompiledAxis,
	CompiledDensity,
	CompiledFilter,
	Filter,
	FilterField,
	FilterOperator,
	PersistableProvider,
	SortDirection,
	ThemeMode,
	TimeGranularity,
	ViewFamily,
	ViewType,
} from './types';
