import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Activity } from '../../models/activity';
import { environment } from '../../../environments/environment';
import { CalendarComponent } from './calendar';

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 7,
  name: 'Morning run',
  sport: 'running',
  subSport: 'generic',
  startedAt: '2026-10-01T08:00:00',
  durationSeconds: 1650,
  elapsedTimeSeconds: 1650,
  distanceMeters: 5000,
  averageSpeedMetersPerSecond: 1000 / 330,
  calories: null,
  averageHeartRateBpm: null,
  maxHeartRateBpm: null,
  maxSpeedMetersPerSecond: null,
  ascentMeters: null,
  descentMeters: null,
  averageCadenceRpm: null,
  maxCadenceRpm: null,
  averagePowerWatts: null,
  maxPowerWatts: null,
  intensityFactor: null,
  cycling: false,
  running: true,
  ...overrides,
});

describe('Calendar', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00'));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function setup() {
    const fixture = TestBed.createComponent(CalendarComponent);
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  function request(from: string, to: string) {
    return http.expectOne(
      (req) =>
        req.url === `${environment.apiBaseUrl}/activities` &&
        req.params.get('from') === from &&
        req.params.get('to') === to,
    );
  }

  it('groups past activities by day, colours sports, and links to existing details', () => {
    const { fixture, page } = setup();
    expect(page.textContent).toContain('Loading activities');
    request('2026-09-28', '2026-11-01').flush({
      activities: [
        activity(),
        activity({
          id: 8,
          sport: 'cycling',
          running: false,
          cycling: true,
          averageSpeedMetersPerSecond: 7.5,
        }),
        activity({ id: 9, startedAt: '2026-10-20T08:00:00' }),
      ],
    });
    fixture.detectChanges();
    const links = page.querySelectorAll<HTMLAnchorElement>('.calendar-activity');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain('Run · 5.00 km · 5:30 /km');
    expect(links[1].textContent).toContain('Cycling · 5.00 km · 27.0 km/h');
    expect(links[0].getAttribute('href')).toBe('/activities/7');
    expect(links[0].closest('.day')?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-01',
    );
    expect(links[1].style.borderLeftColor).not.toBe(links[0].style.borderLeftColor);
    expect(page.querySelector('.day time')?.getAttribute('datetime')).toBe('2026-09-28');
    expect(page.querySelector<HTMLButtonElement>('[aria-label="Next month"]')?.disabled).toBe(true);
    expect(page.querySelector('[aria-current="date"]')?.getAttribute('datetime')).toBe(
      '2026-10-15',
    );
  });

  it('summarizes each Monday–Sunday week including neighbouring months', () => {
    const { fixture, page } = setup();
    const summaryValues = (weekIndex = 0) =>
      Object.fromEntries(
        [...page.querySelectorAll('.summary')[weekIndex].querySelectorAll('dl > div')].map(
          (row) => [
            row.querySelector('dt')!.textContent!.trim(),
            row.querySelector('dd')!.textContent!.trim(),
          ],
        ),
      );
    request('2026-09-28', '2026-11-01').flush({
      activities: [
        activity({ durationSeconds: 1800 }),
        activity({
          id: 8,
          startedAt: '2026-09-30T08:00:00',
          sport: 'cycling',
          running: false,
          cycling: true,
          durationSeconds: 3600,
          distanceMeters: 20000,
        }),
        activity({
          id: 9,
          sport: 'training',
          running: false,
          durationSeconds: 900,
          distanceMeters: 0,
        }),
        activity({ id: 10, startedAt: '2026-10-20T08:00:00', durationSeconds: 7200 }),
        activity({
          id: 11,
          startedAt: '2026-10-05T08:00:00',
          durationSeconds: 600,
          distanceMeters: 2000,
        }),
      ],
    });
    fixture.detectChanges();
    expect(summaryValues()).toEqual({
      'Total time': '1:45:00',
      'Total activities': '3',
      'Run time': '30:00',
      'Run distance': '5.00 km',
      'Cycling time': '1:00:00',
      'Cycling distance': '20.00 km',
    });
    expect(page.querySelectorAll('.summary')).toHaveLength(5);
    expect(page.querySelectorAll('.weekday')[7].textContent?.trim()).toBe('Summary');
    expect(summaryValues(1)).toEqual({
      'Total time': '10:00',
      'Total activities': '1',
      'Run time': '10:00',
      'Run distance': '2.00 km',
      'Cycling time': '0:00',
      'Cycling distance': '0.00 km',
    });
    page.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.click();
    fixture.detectChanges();
    expect(Object.values(summaryValues()).every((value) => value === '—')).toBe(true);
    request('2026-08-31', '2026-10-04').flush({ activities: [] });
    fixture.detectChanges();
    expect(summaryValues()).toEqual({
      'Total time': '0:00',
      'Total activities': '0',
      'Run time': '0:00',
      'Run distance': '0.00 km',
      'Cycling time': '0:00',
      'Cycling distance': '0.00 km',
    });
  });

  it('handles leap years, year boundaries and returning to this month', () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    const { fixture, page } = setup();
    request('2024-02-26', '2024-03-31').flush({ activities: [] });
    const previous = page.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!;
    previous.click();
    request('2024-01-29', '2024-03-03').flush({ activities: [] });
    fixture.detectChanges();
    expect(page.querySelectorAll('.day:not(.outside-month)')).toHaveLength(29);
    expect(page.querySelector<HTMLButtonElement>('[aria-label="Next month"]')?.disabled).toBe(
      false,
    );
    previous.click();
    request('2024-01-01', '2024-02-04').flush({ activities: [] });
    previous.click();
    request('2023-11-27', '2023-12-31').flush({ activities: [] });
    fixture.detectChanges();
    expect(page.textContent).toContain('December 2023');
    const current = [...page.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('This month'),
    )!;
    current.click();
    request('2024-02-26', '2024-03-31').flush({ activities: [] });
    fixture.detectChanges();
    expect(page.textContent).toContain('March 2024');
  });

  it('cancels stale month requests and shows an empty state', () => {
    const { fixture, page } = setup();
    const old = request('2026-09-28', '2026-11-01');
    page.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!.click();
    expect(old.cancelled).toBe(true);
    request('2026-08-31', '2026-10-04').flush({ activities: [] });
    fixture.detectChanges();
    expect(page.textContent).toContain('No past activities in these weeks.');
  });

  it('allows retry after a failed request', () => {
    const { fixture, page } = setup();
    request('2026-09-28', '2026-11-01').flush({}, { status: 500, statusText: 'Server error' });
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load activities',
    );
    page.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    request('2026-09-28', '2026-11-01').flush({
      activities: [activity({ averageSpeedMetersPerSecond: null })],
    });
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelector('.calendar-activity')?.textContent).toContain('Run · 5.00 km · —');
  });
});
