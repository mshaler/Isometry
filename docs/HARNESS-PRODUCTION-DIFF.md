# Harness vs Production SuperGrid: Intentional Differences

Both `HarnessShell` and `ProductionSuperGrid` call `registerCatalog()` to populate a
`PluginRegistry` with all 28 plugins. Their configurations then diverge intentionally.

## Shared Foundation

| Aspect | HarnessShell | ProductionSuperGrid |
|--------|-------------|---------------------|
| Plugin registration | `registerCatalog(this._registry)` | `registerCatalog(this._registry)` |
| Plugin count | 28 | 28 |
| Base plugins enabled | yes (defaultEnabled: true) | yes (defaultEnabled: true) |

## Intentional Differences

| Aspect | HarnessShell | ProductionSuperGrid |
|--------|-------------|---------------------|
| Non-base plugin enablement | Preserves `defaultEnabled: false` — user toggles via FeaturePanel | Forces all 25 non-base plugins enabled at construction |
| Toggle state persistence | Saves/restores from `localStorage` (`isometry:harness:toggles`) | No toggle UI — all plugins always on |
| Toggle UI | `FeaturePanel` sidebar with per-plugin checkboxes | None |
| Data source | `MockDataAdapter` (no providers, no bridge) | `BridgeDataAdapter` wrapping PAFVProvider, FilterProvider, SuperDensityProvider, bridge |
| Data flow | Static mock cells rebuilt on `rerender()` | Bridge-driven: coordinator subscription triggers re-render |
| Shell container | `HarnessShell` (self-contained, mounts its own sidebar + main layout) | `ProductionSuperGrid` implements `IView` — mounted by `ViewManager` inside `.workbench-view-content` |
| Explorer panels | None (harness has its own FeaturePanel toggle tree) | WorkbenchShell panels (CalcExplorer, PropertiesExplorer, etc.) wired via `setCalcExplorer()`, `setSchemaProvider()`, `setDepthGetter()` |
| Entry point | `harness.html` → `harness-entry.ts` | `index.html` → `main.ts` |
| `window.__harness` | Exposed — programmatic enable/disable for E2E tests | Not exposed |
| `window.__harnessReady` | Set to `true` on mount | Not set |

## Why Keep Both

- **HarnessShell** is a development/testing tool: individual plugins are toggled on/off to verify
  their isolated behavior. Mock data keeps the harness dependency-free (no sql.js, no providers).
- **ProductionSuperGrid** is the shipping implementation: all plugins always on, real data from
  the bridge, lifecycle managed by ViewManager.

The two paths verify complementary properties:
- Harness: per-plugin isolation and feature toggle correctness
- Production smoke E2E: full integration with real data and all 28 plugins active simultaneously
