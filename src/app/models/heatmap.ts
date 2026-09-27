export type HeatmapSport = 'running' | 'cycling';

export interface HeatmapCell {
  latitude: number;
  longitude: number;
  count: number;
  intensity: number;
}

export interface HeatmapResponse {
  sport: HeatmapSport;
  from: string | null;
  to: string | null;
  zoom: number;
  maxCount: number;
  cells: HeatmapCell[];
}

export interface MapViewport {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
  zoom: number;
}

export interface HeatmapRequest extends MapViewport {
  sport: HeatmapSport;
  from?: string;
  to?: string;
}
