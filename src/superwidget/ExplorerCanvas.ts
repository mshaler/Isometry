import type { CanvasComponent } from './projection';
import { DataExplorerPanel } from '../ui/DataExplorerPanel';
import type { DataExplorerPanelConfig } from '../ui/DataExplorerPanel';

export class ExplorerCanvas implements CanvasComponent {
  private _config: DataExplorerPanelConfig;
  private _panel: DataExplorerPanel | null = null;
  private _wrapperEl: HTMLElement | null = null;

  constructor(config: DataExplorerPanelConfig) {
    this._config = config;
  }

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'explorer-canvas';
    this._wrapperEl = wrapper;
    this._panel = new DataExplorerPanel(this._config);
    this._panel.mount(wrapper);
    container.appendChild(wrapper);
  }

  destroy(): void {
    this._panel?.destroy();
    this._panel = null;
    this._wrapperEl?.remove();
    this._wrapperEl = null;
  }

  getPanel(): DataExplorerPanel | null {
    return this._panel;
  }
}
