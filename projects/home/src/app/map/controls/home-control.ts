import * as L from 'leaflet';

/**
 * Custom Leaflet Home Control class.
 */
export class HomeControl extends L.Control {
  constructor(options?: L.ControlOptions) {
    super({
      position: 'bottomright',
      ...options
    });
  }

  override onAdd(map: L.Map): HTMLElement {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('a', 'leaflet-home-button', container);
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-house-door-fill text-success" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
        <path d="M6.5 14.5v-3.507c0-.235.19-.425.424-.425h2.152c.234 0 .424.19.424.425v3.507c0 .235-.19.425-.424.425H6.924a.424.424 0 0 1-.424-.425z"/>
        <path d="M7.293 1.5a1 1 0 0 1 1.414 0l6.647 6.646a.5.5 0 0 1-.708.708L8 2.207 1.354 8.854a.5.5 0 1 1-.708-.708z"/>
      </svg>
    `;
    button.href = '#';
    button.title = 'Go to starting map overview';
    
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, 'click', (e) => {
      L.DomEvent.preventDefault(e);
      map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
    });
    return container;
  }
}
