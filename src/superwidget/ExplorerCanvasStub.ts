// STUB -- placeholder for replacement in v13.1+
import type { CanvasComponent } from './projection';

export class ExplorerCanvasStub implements CanvasComponent {
  private _canvasId: string;
  private _el: HTMLElement | null = null;
  private _renderCount = 0;

  constructor(canvasId: string) {
    this._canvasId = canvasId;
  }

  mount(container: HTMLElement): void {
    this._renderCount++;
    const el = document.createElement('div');
    el.dataset['canvasType'] = 'Explorer';
    el.dataset['renderCount'] = String(this._renderCount);
    el.textContent = `[Explorer: ${this._canvasId}]`;
    this._el = el;
    container.appendChild(el);
  }

  destroy(): void {
    this._el?.remove();
    this._el = null;
  }
}
