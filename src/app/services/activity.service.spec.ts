import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivityService } from './activity.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('ActivityService aggregated samples', () => {
  let service: ActivityService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ActivityService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each([0.5, 1, 2])('requests %s km segments with existing authentication', (interval) => {
    service.getAggregatedActivitySamples(42, interval).subscribe();
    const request = http.expectOne(
      `${environment.apiBaseUrl}/activities/42/samples-aggregated/aggr-km/${interval}`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(
      `Basic ${btoa(`api:${environment.apiKey}`)}`,
    );
    request.flush({ id: 42, aggregationKilometers: interval, samples: [] });
  });

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'rejects invalid interval %s without a request',
    (interval) => {
      const error = vi.fn();
      service.getAggregatedActivitySamples(42, interval).subscribe({ error });
      expect(error).toHaveBeenCalled();
      http.expectNone((request) => request.url.includes('samples-aggregated'));
    },
  );
});
