// STUB -- placeholder for replacement in v13.1+
import type { CanvasBinding, CanvasComponent } from './projection';

export class ViewCanvasStub implements CanvasComponent {
  private _canvasId: string;
  private _binding: CanvasBinding;
  private _el: HTMLElement | null = null;
  private _renderCount = 0;

  constructor(canvasId: string, binding: CanvasBinding) {
    this._canvasId = canvasId;
    this._binding = binding;
  }

  mount(container: HTMLElement): void {
    this._renderCount++;
    const el = document.createElement('div');
    el.dataset['canvasType'] = 'View';
    el.dataset['renderCount'] = String(this._renderCount);
    el.textContent = `[View: ${this._canvasId}]`;
    if (this._binding === 'Bound') {
      const sidecar = document.createElement('div');
      sidecar.dataset['sidecar'] = '';
      el.appendChild(sidecar);
    }
    this._el = el;
    container.appendChild(el);
  }

  destroy(): void {
    this._el?.remove();
    this._el = null;
  }
}
