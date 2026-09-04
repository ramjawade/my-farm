import * as L from 'leaflet';

export interface LayerToggleControlOptions extends L.ControlOptions {
  activeView: () => 'street' | 'satellite';
  setLayer: (layer: 'street' | 'satellite') => void;
}

/**
 * Custom Leaflet Layer Toggle Control class.
 */
export class LayerToggleControl extends L.Control {
  private button!: HTMLElement;
  private readonly toggleOptions: LayerToggleControlOptions;

  constructor(options: LayerToggleControlOptions) {
    const { activeView, setLayer, ...controlOptions } = options;
    super({
      position: 'bottomright',
      ...controlOptions,
    });
    this.toggleOptions = options;
  }

  override onAdd(map: L.Map): HTMLElement {
    const container = L.DomUtil.create('div', 'leaflet-basemap-toggle');
    container.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      background: rgba(255, 255, 255, 0.96);
      border-radius: 50rem;
      padding: 3px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
      z-index: 999;
      gap: 2px;
    `;

    const streetBtn = L.DomUtil.create('span', 'basemap-option', container);
    streetBtn.textContent = 'Street';
    streetBtn.style.cssText = `
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.4rem 0.9rem;
      border-radius: 50rem;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    `;

    const satelliteBtn = L.DomUtil.create('span', 'basemap-option active', container);
    satelliteBtn.textContent = 'Satellite';
    satelliteBtn.style.cssText = `
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.4rem 0.9rem;
      border-radius: 50rem;
      background: linear-gradient(135deg, #2e7d32, #1b5e20);
      color: #fff;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    `;

    this.button = streetBtn;
    const activeBtn = satelliteBtn;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(streetBtn, 'click', () => {
      this.toggleOptions.setLayer('street');
      this.updateUI('street', streetBtn, satelliteBtn);
    });

    L.DomEvent.on(satelliteBtn, 'click', () => {
      this.toggleOptions.setLayer('satellite');
      this.updateUI('satellite', streetBtn, satelliteBtn);
    });

    (container as any)._updateUI = (view: 'street' | 'satellite') =>
      this.updateUI(view, streetBtn, satelliteBtn);

    return container;
  }

  updateUI(view: 'street' | 'satellite', streetBtn?: HTMLElement, satelliteBtn?: HTMLElement): void {
    if (!streetBtn || !satelliteBtn) return;

    if (view === 'street') {
      streetBtn.style.cssText = `
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.4rem 0.9rem;
        border-radius: 50rem;
        background: linear-gradient(135deg, #2e7d32, #1b5e20);
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      `;
      streetBtn.classList.add('active');

      satelliteBtn.style.cssText = `
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.4rem 0.9rem;
        border-radius: 50rem;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      `;
      satelliteBtn.classList.remove('active');
    } else {
      streetBtn.style.cssText = `
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.4rem 0.9rem;
        border-radius: 50rem;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      `;
      streetBtn.classList.remove('active');

      satelliteBtn.style.cssText = `
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.4rem 0.9rem;
        border-radius: 50rem;
        background: linear-gradient(135deg, #2e7d32, #1b5e20);
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      `;
      satelliteBtn.classList.add('active');
    }
  }
}
