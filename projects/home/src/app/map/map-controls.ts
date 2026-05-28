import * as L from 'leaflet';

export interface LayerToggleControlOptions extends L.ControlOptions {
  activeView: () => 'street' | 'satellite';
  setLayer: (layer: 'street' | 'satellite') => void;
}

/**
 * Creates a custom Leaflet Home Control button.
 */
export function createHomeControl(options?: L.ControlOptions): L.Control {
  const HomeControlClass = L.Control.extend({
    options: {
      position: 'bottomright',
      ...options
    },
    onAdd(map: L.Map) {
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
  });

  return new (HomeControlClass as any)();
}

/**
 * Creates a custom Leaflet Layer Toggle Control button with Globe/Map icons.
 */
export function createLayerToggleControl(options: LayerToggleControlOptions): L.Control {
  const LayerToggleControlClass = L.Control.extend({
    options: {
      position: 'bottomright',
      ...options
    },
    onAdd(map: L.Map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const button = L.DomUtil.create('a', 'leaflet-layer-toggle-button', container);
      button.href = '#';
      
      const updateUI = (view: 'street' | 'satellite') => {
        if (view === 'street') {
          button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-globe text-primary" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
              <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-1.2A8 8 0 0 0 1.3 4zm-.5 1H1.3a7 7 0 0 0 1.83 4H3.59A9.3 9.3 0 0 1 3.5 5zm.59 5H1.3a8 8 0 0 0 3.79 3.203 6.7 6.7 0 0 1-.598-1.2A9.3 9.3 0 0 1 4.09 10zm1.527 1a8 8 0 0 0 1.887 1.855V10H5.617zm2.383 1.855A8 8 0 0 0 9.883 10H8.383zm1.887-1.855A9.3 9.3 0 0 1 9.5 10h2.383a8 8 0 0 0-1.887 1.855zm1.536-1.855H9.5V5h3.09a9.3 9.3 0 0 1 .09 1z"/>
            </svg>
          `;
          button.title = 'Switch to Satellite View';
        } else {
          button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-map-fill text-success" viewBox="0 0 16 16" style="vertical-align: middle; margin-top: -3px;">
              <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.598-.49L10.5.99 5.5-.01a.5.5 0 0 0-.196 0l-5 1A.5.5 0 0 0 0 1.5v14a.5.5 0 0 0 .598.49l4.902-.98 5 .98a.5.5 0 0 0 .196 0l5-1A.5.5 0 0 0 16 14.5zM5 14.09V1.11l.5-.1 4 .8v12.98l-4-.8z"/>
            </svg>
          `;
          button.title = 'Switch to Street View';
        }
      };

      updateUI(options.activeView());

      L.DomEvent.disableClickPropagation(button);
      L.DomEvent.on(button, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        const current = options.activeView();
        const target = current === 'street' ? 'satellite' : 'street';
        options.setLayer(target);
        updateUI(target);
      });

      (container as any)._updateUI = updateUI;
      return container;
    }
  });

  return new (LayerToggleControlClass as any)();
}
