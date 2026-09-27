import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { HeatmapService } from './heatmap.service';

describe('HeatmapService', () => {
  let service: HeatmapService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HeatmapService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('constructs viewport and date query parameters', () => {
    service
      .getHeatmap({
        sport: 'running',
        zoom: 13,
        minLongitude: 9.1,
        minLatitude: 45.4,
        maxLongitude: 9.2,
        maxLatitude: 45.5,
        from: '2026-01-01',
        to: '2026-09-27',
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiBaseUrl}/heatmap`,
    );
    expect(request.request.params.get('sport')).toBe('running');
    expect(request.request.params.get('zoom')).toBe('13');
    expect(request.request.params.get('bbox')).toBe('9.1,45.4,9.2,45.5');
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-09-27');
    request.flush({ sport: 'running', from: null, to: null, zoom: 13, maxCount: 0, cells: [] });
  });

  it('omits both date parameters unless both are supplied', () => {
    service
      .getHeatmap({
        sport: 'cycling',
        zoom: 12,
        minLongitude: 8,
        minLatitude: 44,
        maxLongitude: 10,
        maxLatitude: 46,
        from: '2026-01-01',
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiBaseUrl}/heatmap`,
    );
    expect(request.request.params.has('from')).toBe(false);
    expect(request.request.params.has('to')).toBe(false);
    request.flush({ sport: 'cycling', from: null, to: null, zoom: 12, maxCount: 0, cells: [] });
  });
});
