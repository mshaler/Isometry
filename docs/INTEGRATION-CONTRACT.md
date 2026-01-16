# Isometry Integration Contract

*How the pieces fit together*

## Provider Hierarchy

```tsx
<ThemeProvider>              {/* UI theme */}
  <DatabaseProvider>         {/* sql.js instance */}
    <FilterProvider>         {/* LATCH filter state */}
      <PAFVProvider>         {/* Axis assignments */}
        <SelectionProvider>  {/* Card selection */}
          <Layout />
        </SelectionProvider>
      </PAFVProvider>
    </FilterProvider>
  </DatabaseProvider>
</ThemeProvider>
```

## Data Flow

1. User changes filter → FilterContext updates
2. Components using useFilters() re-render
3. compileFilters() generates SQL WHERE clause
4. useSQLiteQuery() executes query
5. D3 view renders new data

## Key Hooks

- `useDatabase()` - Raw SQL execution
- `useSQLiteQuery(sql, params)` - Query with caching
- `useNodes(where, params)` - Convenience for node queries
- `useFilters()` - Filter state and setters
- `usePAFV()` - PAFV axis assignments
- `useSelection()` - Card selection state
- `useD3(renderFn, deps)` - D3 container management

## File Locations

- Types: `src/types/`
- Database: `src/db/`
- Hooks: `src/hooks/`
- State: `src/state/`
- Views: `src/views/`
- Filters: `src/filters/`
- Components: `src/components/`
