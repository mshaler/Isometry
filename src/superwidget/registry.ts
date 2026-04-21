// Isometry v13.0 -- Phase 165 Canvas Stubs + Registry
// Requirements: CANV-04, CANV-05, CANV-06
import type { CanvasBinding, CanvasComponent, CanvasType } from './projection';
import type { CanvasFactory } from './SuperWidget';
import { ExplorerCanvasStub } from './ExplorerCanvasStub';
import { EditorCanvasStub } from './EditorCanvasStub';

export interface CanvasRegistryEntry {
  canvasType: CanvasType;
  create: (binding?: CanvasBinding) => CanvasComponent;
  defaultExplorerId?: string;
}

const _registry = new Map<string, CanvasRegistryEntry>();

export function register(canvasId: string, entry: CanvasRegistryEntry): void {
  _registry.set(canvasId, entry);
}

export function getRegistryEntry(canvasId: string): CanvasRegistryEntry | undefined {
  return _registry.get(canvasId);
}

export function getCanvasFactory(): CanvasFactory {
  return (canvasId: string, binding: CanvasBinding): CanvasComponent | undefined => {
    const entry = _registry.get(canvasId);
    return entry?.create(binding);
  };
}

export function clearRegistry(): void {
  _registry.clear();
}

export function registerAllStubs(): void {
  register('explorer-1', {
    canvasType: 'Explorer',
    create: () => new ExplorerCanvasStub('explorer-1'),
  });
  // view-1 is registered with the real ViewCanvas in main.ts (CANV-06)
  register('editor-1', {
    canvasType: 'Editor',
    create: () => new EditorCanvasStub('editor-1'),
  });
}
