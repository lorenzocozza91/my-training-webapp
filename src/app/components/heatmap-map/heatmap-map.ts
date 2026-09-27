import {
  AfterViewInit,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  input,
  output,
} from '@angular/core';
import L from 'leaflet';
import 'leaflet.heat';
import { HeatmapCell, MapViewport } from '../../models/heatmap';

export function toHeatPoints(cells: HeatmapCell[]): L.HeatLatLngTuple[] {
  return cells.map((cell) => [cell.latitude, cell.longitude, cell.intensity]);
}

@Component({
  selector: 'app-heatmap-map',
  template: '<div class="heatmap-map-container"></div>',
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .heatmap-map-container {
      width: 100%;
      height: 100%;
    }
  `,
})
export class HeatmapMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly cells = input<HeatmapCell[]>([]);
  readonly viewportChange = output<MapViewport>();

  private readonly el = inject(ElementRef);
  private map: L.Map | null = null;
  private heatLayer: L.HeatLayer | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const container = this.el.nativeElement.querySelector('.heatmap-map-container') as HTMLElement;
    this.map = L.map(container, {
      center: [51.9616, 7.6282],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.heatLayer = L.heatLayer([], {
      radius: 22,
      blur: 18,
      minOpacity: 0.25,
      max: 1,
      gradient: { 0.2: '#3f51b5', 0.45: '#00bcd4', 0.7: '#ffeb3b', 1: '#f44336' },
    }).addTo(this.map);

    this.updateHeatLayer();
    this.map.on('moveend zoomend', this.emitViewport, this);

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(container);

    setTimeout(() => {
      this.map?.invalidateSize();
      this.emitViewport();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cells']) {
      this.updateHeatLayer();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.off('moveend zoomend', this.emitViewport, this);
    this.map?.remove();
    this.map = null;
    this.heatLayer = null;
  }

  private updateHeatLayer(): void {
    this.heatLayer?.setLatLngs(toHeatPoints(this.cells()));
  }

  private readonly emitViewport = (): void => {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    this.viewportChange.emit({
      minLongitude: bounds.getWest(),
      minLatitude: bounds.getSouth(),
      maxLongitude: bounds.getEast(),
      maxLatitude: bounds.getNorth(),
      zoom: this.map.getZoom(),
    });
  };
}
