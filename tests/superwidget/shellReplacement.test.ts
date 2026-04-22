// Smoke test: SuperWidget as top-level container (SHEL-01..SHEL-06)
// Verifies the big-bang swap in Phase 175 Plan 02:
//   - WorkbenchShell.ts is deleted
//   - workbench.css has no shell layout rules
//   - SuperWidget wiring is complete before any async bridge calls
//
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// jsdom does not implement setPointerCapture — stub it
if (!('setPointerCapture' in Element.prototype)) {
  (Element.prototype as unknown as Record<string, unknown>)['setPointerCapture'] = vi.fn();
  (Element.prototype as unknown as Record<string, unknown>)['releasePointerCapture'] = vi.fn();
}

// jsdom does not implement ResizeObserver — provide a minimal stub
if (typeof ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>)['ResizeObserver'] = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import { CommandBar } from '../../src/ui/CommandBar';
import { getCanvasFactory } from '../../src/superwidget/registry';

const SRC_ROOT = path.resolve(__dirname, '../../src');

describe('Shell replacement smoke test', () => {
  it('WorkbenchShell.ts does not exist (SHEL-04)', () => {
    const shellPath = path.join(SRC_ROOT, 'ui/WorkbenchShell.ts');
    expect(fs.existsSync(shellPath)).toBe(false);
  });

  it('workbench.css has no .workbench-shell rule (SHEL-06)', () => {
    const cssPath = path.join(SRC_ROOT, 'styles/workbench.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).not.toContain('.workbench-shell {');
    expect(css).not.toContain('.workbench-body {');
    expect(css).not.toContain('.workbench-sidebar {');
    expect(css).not.toContain('.workbench-main {');
    expect(css).not.toContain('.workbench-slot-top {');
    expect(css).not.toContain('.workbench-slot-bottom {');
    // Kept rules still present
    expect(css).toContain('.workbench-command-bar {');
    expect(css).toContain('.collapsible-section {');
  });

  it('SuperWidget with commandBar produces correct 5-slot DOM (SHEL-01)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const commandBar = new CommandBar({ onMenuAction: () => {} });
    const sw = new SuperWidget(getCanvasFactory(), undefined, commandBar);
    sw.mount(container);

    // sidebar slot present
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).not.toBeNull();
    expect(sidebar!.parentElement).toBe(sw.rootEl);

    // header slot contains commandBar
    const header = container.querySelector('[data-slot="header"]');
    expect(header).not.toBeNull();
    expect(header!.querySelector('.workbench-command-bar')).not.toBeNull();

    // tabs, canvas, status slots
    expect(container.querySelector('[data-slot="tabs"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="canvas"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="status"]')).not.toBeNull();

    sw.destroy();
    container.remove();
  });

  it('sidebarEl is DOM-attached after mount (SHEL-02)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const sw = new SuperWidget(getCanvasFactory());
    sw.mount(container);

    expect(sw.sidebarEl.parentElement).not.toBeNull();
    expect(sw.sidebarEl.isConnected).toBe(true);

    sw.destroy();
    container.remove();
  });

  it('getCommandBar() returns the injected CommandBar (SHEL-03)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const commandBar = new CommandBar({ onMenuAction: () => {} });
    const sw = new SuperWidget(getCanvasFactory(), undefined, commandBar);
    sw.mount(container);

    expect(sw.getCommandBar()).toBe(commandBar);

    sw.destroy();
    container.remove();
  });

  it('sidecarTopEl and sidecarBottomEl return HTMLElements in sidecar sub-slots (SHEL-02)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const sw = new SuperWidget(getCanvasFactory());
    sw.mount(container);

    const top = sw.sidecarTopEl;
    const bottom = sw.sidecarBottomEl;

    expect(top).toBeInstanceOf(HTMLElement);
    expect(top.dataset['sidecarSlot']).toBe('top-slot');
    expect(bottom).toBeInstanceOf(HTMLElement);
    expect(bottom.dataset['sidecarSlot']).toBe('bottom-slot');

    sw.destroy();
    container.remove();
  });

  it('SuperWidget is fully wired synchronously before any async calls — ordering guarantee (SHEL-05)', () => {
    // This test verifies the D-08 ordering guarantee:
    // SuperWidget construction + mount + all slot accessors complete synchronously
    // BEFORE any bridge.send() (async) calls fire.
    //
    // Proof: all assertions below succeed without any awaits.
    const container = document.createElement('div');
    document.body.appendChild(container);

    const commandBar = new CommandBar({ onMenuAction: () => {} });
    const sw = new SuperWidget(getCanvasFactory(), undefined, commandBar);

    // Step 1: mount (synchronous)
    sw.mount(container);

    // Step 2: wire all slot accessors (synchronous)
    const sidebar = sw.sidebarEl;
    const top = sw.sidecarTopEl;
    const bottom = sw.sidecarBottomEl;
    const cb = sw.getCommandBar();

    // All fully wired — no async awaits needed
    expect(sidebar.isConnected).toBe(true);
    expect(top).toBeInstanceOf(HTMLElement);
    expect(bottom).toBeInstanceOf(HTMLElement);
    expect(cb).toBe(commandBar);

    // canvasEl available for viewContentEl injection
    expect(sw.canvasEl).toBeInstanceOf(HTMLElement);
    expect(sw.canvasEl.isConnected).toBe(true);

    sw.destroy();
    container.remove();
  });
});
