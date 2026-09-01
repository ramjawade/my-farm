import * as L from 'leaflet';

export interface LayerToggleControlOptions extends L.ControlOptions {
  activeView: () => 'street' | 'satellite';
  setLayer: (layer: 'street' | 'satellite') => void;
}

/**
 * Custom Leaflet Layer Toggle Control class.
 */
export class LayerToggleControl extends L.Control {
  private button!: HTMLAnchorElement;
  private readonly toggleOptions: LayerToggleControlOptions;

  constructor(options: LayerToggleControlOptions) {
    const { activeView, setLayer, ...controlOptions } = options;
    super({
      position: 'bottomright',
      ...controlOptions
    });
    this.toggleOptions = options;
  }

  override onAdd(map: L.Map): HTMLElement {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', 'leaflet-layer-toggle-button', container);
    button.href = '#';
    this.button = button;

    this.updateUI(this.toggleOptions.activeView());

    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, 'click', (e) => {
      L.DomEvent.preventDefault(e);
      const current = this.toggleOptions.activeView();
      const target = current === 'street' ? 'satellite' : 'street';
      this.toggleOptions.setLayer(target);
      this.updateUI(target);
    });

    (container as any)._updateUI = (view: 'street' | 'satellite') => this.updateUI(view);
    return container;
  }

  updateUI(view: 'street' | 'satellite'): void {
    if (view === 'street') {
      this.button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-globe text-primary" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
          <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-1.2A8 8 0 0 0 1.3 4zm-.5 1H1.3a7 7 0 0 0 1.83 4H3.59A9.3 9.3 0 0 1 3.5 5zm.59 5H1.3a8 8 0 0 0 3.79 3.203 6.7 6.7 0 0 1-.598-1.2A9.3 9.3 0 0 1 4.09 10zm1.527 1a8 8 0 0 0 1.887 1.855V10H5.617zm2.383 1.855A8 8 0 0 0 9.883 10H8.383zm1.887-1.855A9.3 9.3 0 0 1 9.5 10h2.383a8 8 0 0 0-1.887 1.855zm1.536-1.855H9.5V5h3.09a9.3 9.3 0 0 1 .09 1z"/>
        </svg>
      `;
      this.button.title = 'Switch to Satellite View';
    } else {
      this.button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-map-fill text-success" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
          <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.5-.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 5 .98a.5.5 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5zM5 14.09V1.11l.5-.1 4 .8v12.98l-4-.8z"/>
        </svg>
      `;
      this.button.title = 'Switch to Street View';
    }
  }
}
