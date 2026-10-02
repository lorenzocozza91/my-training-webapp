import { Component, input } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Activity } from '../../models/activity';
import { ActivityService } from '../../services/activity.service';
import { TrackMapComponent } from '../../components/track-map/track-map';
import { environment } from '../../../environments/environment';
import { ActivityDetailsComponent } from './activity-details';
import { HomeComponent } from '../home/home';

@Component({ selector: 'app-track-map', template: '<div class="test-map"></div>' })
class TestMapComponent {
  readonly coordinates = input<number[][]>([]);
}

const activity: Activity = {
  id: 7,
  name: 'Morning activity',
  sport: 'running',
  subSport: 'generic',
  startedAt: '2026-10-01T08:00:00Z',
  durationSeconds: 1800,
  elapsedTimeSeconds: 1900,
  distanceMeters: 5000,
  calories: 300,
  averageHeartRateBpm: 140,
  maxHeartRateBpm: 170,
  averageSpeedMetersPerSecond: 3,
  maxSpeedMetersPerSecond: 5,
  ascentMeters: 50,
  descentMeters: 45,
  averageCadenceRpm: 80,
  maxCadenceRpm: 95,
  averagePowerWatts: 200,
  maxPowerWatts: 300,
  intensityFactor: 0.75,
  cycling: false,
  running: true,
};

describe('Activity details', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const url = `${environment.apiBaseUrl}/activities/7`;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNativeDateAdapter(),
        provideRouter([
          { path: '', component: HomeComponent },
          { path: 'activities/:id', component: ActivityDetailsComponent },
        ]),
      ],
    });
    TestBed.overrideComponent(ActivityDetailsComponent, {
      remove: { imports: [TrackMapComponent] },
      add: { imports: [TestMapComponent] },
    });
    TestBed.overrideComponent(HomeComponent, {
      remove: { imports: [TrackMapComponent] },
      add: { imports: [TestMapComponent] },
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('opens details from the dashboard while keeping its map toggle independent and restores filters on return', async () => {
    const router = TestBed.inject(Router);
    const dashboardUrl = '/?from=2026-09-01&to=2026-10-01&sport=running';
    const listUrl = `${environment.apiBaseUrl}/activities?from=2026-09-01&to=2026-10-01`;
    await harness.navigateByUrl(dashboardUrl);
    http.expectOne(listUrl).flush({ activities: [activity] });
    http.expectOne(`${url}/track`).flush({ id: 7, track: { type: 'LineString', coordinates: [] } });
    harness.detectChanges();

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.map-toggle')!.click();
    harness.detectChanges();
    expect(router.url).toBe(dashboardUrl);
    expect(harness.routeNativeElement!.textContent).toContain('No track data available.');

    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('.activity-open')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/activities/7?from=2026-09-01&to=2026-10-01&sport=running');
    http.expectNone(url);
    http.expectOne(`${url}/track`).flush({ id: 7, track: { type: 'LineString', coordinates: [] } });
    harness.detectChanges();

    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe(dashboardUrl);
    http.expectOne(listUrl).flush({ activities: [activity] });
    http.expectOne(`${url}/track`).flush({ id: 7, track: { type: 'LineString', coordinates: [] } });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('.activity-name')?.textContent).toContain(
      activity.name,
    );
  });

  async function open(
    sport = 'running',
    coordinates: number[][] = [
      [9, 45],
      [9.1, 45.1],
    ],
  ) {
    await harness.navigateByUrl('/activities/7?from=2026-09-01&to=2026-10-01&sport=running');
    http
      .expectOne(url)
      .flush({ ...activity, sport, running: sport === 'running', cycling: sport === 'cycling' });
    http.expectOne(`${url}/track`).flush({ id: 7, track: { type: 'LineString', coordinates } });
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  it('loads a direct link and shows run metrics, route, and a filtered back link', async () => {
    const page = await open();
    expect(page.textContent).toContain('Average pace');
    expect(page.textContent).not.toContain('Average speed');
    expect(page.querySelector('app-track-map')).toBeTruthy();
    expect(page.querySelector('a')?.getAttribute('href')).toBe(
      '/?from=2026-09-01&to=2026-10-01&sport=running',
    );
  });

  it('shows cycling speed, cadence, and power', async () => {
    const page = await open('cycling');
    expect(page.textContent).toContain('Average speed');
    expect(page.textContent).toContain('Average power');
    expect(page.textContent).toContain('80 rpm');
    expect(page.textContent).not.toContain('Average pace');
  });

  it('shows training metrics and omits the map when there is no GPS track', async () => {
    const page = await open('training', []);
    expect(page.textContent).toContain('Duration');
    expect(page.textContent).toContain('Calories');
    expect(page.textContent).toContain('Average heart rate');
    expect(page.textContent).not.toContain('Distance');
    expect(page.textContent).not.toContain('Average power');
    expect(page.querySelector('.map-section')).toBeNull();
  });

  it('shows a map for cardio when GPS data exists', async () => {
    const page = await open('cardio');
    expect(page.textContent).toContain('Cardio');
    expect(page.querySelector('app-track-map')).toBeTruthy();
  });

  it('keeps metrics visible if the track request fails', async () => {
    await harness.navigateByUrl('/activities/7');
    http.expectOne(url).flush(activity);
    http.expectOne(`${url}/track`).flush({}, { status: 500, statusText: 'Server error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Morning activity');
    expect(harness.routeNativeElement?.textContent).toContain('Could not load the route map.');
  });

  it('shows an empty map state for a run without a track', async () => {
    const page = await open('running', []);
    expect(page.textContent).toContain('No track data available.');
  });

  it('handles invalid IDs without sending requests', async () => {
    await harness.navigateByUrl('/activities/invalid');
    expect(harness.routeNativeElement?.textContent).toContain('Activity not found.');
  });

  it('handles missing activities', async () => {
    await harness.navigateByUrl('/activities/7');
    http.expectOne(url).flush({}, { status: 404, statusText: 'Not found' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Activity not found.');
  });

  it('opens a cached dashboard activity without a single-activity request and omits null metrics', async () => {
    TestBed.inject(ActivityService).getActivities('2026-09-01', '2026-10-01').subscribe();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/activities`)
      .flush({ activities: [{ ...activity, calories: null }] });
    await harness.navigateByUrl('/activities/7');
    http.expectNone(url);
    http.expectOne(`${url}/track`).flush({ id: 7, track: { type: 'LineString', coordinates: [] } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Morning activity');
    expect(harness.routeNativeElement?.textContent).not.toContain('Calories');
  });
});
