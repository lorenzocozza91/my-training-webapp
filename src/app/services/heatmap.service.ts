import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HeatmapRequest, HeatmapResponse } from '../models/heatmap';

@Injectable({ providedIn: 'root' })
export class HeatmapService {
  private readonly http = inject(HttpClient);

  getHeatmap(request: HeatmapRequest): Observable<HeatmapResponse> {
    const bbox = [
      request.minLongitude,
      request.minLatitude,
      request.maxLongitude,
      request.maxLatitude,
    ].join(',');

    let params = new HttpParams()
      .set('sport', request.sport)
      .set('zoom', request.zoom)
      .set('bbox', bbox);

    if (request.from && request.to) {
      params = params.set('from', request.from).set('to', request.to);
    }

    return this.http.get<HeatmapResponse>(`${environment.apiBaseUrl}/heatmap`, { params });
  }
}
