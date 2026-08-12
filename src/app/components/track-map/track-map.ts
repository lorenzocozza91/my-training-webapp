import {
  Component,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  input,
  SimpleChanges,
  ElementRef,
  inject
} from '@angular/core';
import L from 'leaflet';

// Prevent Leaflet from trying to load default marker icon PNGs (we use circleMarker).
// Bundlers can't resolve the images referenced in leaflet.css.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(L.Icon.Default.prototype as any)._getIconUrl = undefined;

@Component({
  selector: 'app-track-map',
  template: '<div class="track-map-container" #mapEl></div>',
  styles: `
    :host { display: block; height: 240px; border-radius: 0 0 0.5rem 0.5rem; overflow: hidden; }
    .track-map-container { width: 100%; height: 100%; }
  `,
  standalone: true
})
export class TrackMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly coordinates = input<number[][]>([]);

  private readonly el = inject(ElementRef);
  private map: L.Map | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderTrack();

    const container = this.el.nativeElement.querySelector('.track-map-container') as HTMLElement;
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(container);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['coordinates'] && this.viewReady) {
      this.renderTrack();
    }
  }

  private renderTrack(): void {
    const coords = this.coordinates()
      .filter((coordinate) => coordinate.length >= 2)
      .map(([longitude, latitude]) => [latitude, longitude] as [number, number]);

    if (!this.viewReady || coords.length < 2) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    const container = this.el.nativeElement.querySelector('.track-map-container') as HTMLElement;

    this.map = L.map(container, {
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);

    L.polyline(coords, {
      color: '#fc4c02',
      weight: 4,
      opacity: 0.9
    }).addTo(this.map);

    if (coords.length > 0) {
      L.circleMarker(coords[0], {
        radius: 6,
        color: '#2e7d32',
        fillColor: '#4caf50',
        fillOpacity: 1
      }).addTo(this.map);

      L.circleMarker(coords[coords.length - 1], {
        radius: 6,
        color: '#c62828',
        fillColor: '#f44336',
        fillOpacity: 1
      }).addTo(this.map);
    }

    const bounds = L.latLngBounds(coords);
    this.map.fitBounds(bounds, { padding: [20, 20] });

    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }
}
