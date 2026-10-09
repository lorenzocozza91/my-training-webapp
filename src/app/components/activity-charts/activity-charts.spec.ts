import { TestBed } from '@angular/core/testing';
import { ActivityChartsComponent } from './activity-charts';
import { ActivitySample } from '../../models/activity';

const sample = (
  seconds: number,
  distance: number | null,
  heartRate: number | null,
): ActivitySample => ({
  timestamp: new Date(Date.UTC(2026, 9, 9, 14, 10, seconds)).toISOString(),
  distanceMeters: distance,
  heartRateBpm: heartRate,
  paceMinutesPerKilometer: 5.5,
  altitudeMeters: 68,
  gradePercent: null,
  gapMinutesPerKilometer: null,
});

describe('Activity charts', () => {
  function setup(
    samples: ActivitySample[] = [sample(0, 0, 140), sample(10, 100, null), sample(40, 500, 160)],
  ) {
    const fixture = TestBed.createComponent(ActivityChartsComponent);
    fixture.componentRef.setInput('samples', samples);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const click = (text: string) => {
      Array.from(page.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === text)!
        .click();
      fixture.detectChanges();
    };
    return { fixture, page, click };
  }

  it('renders five metrics, defaults to distance, and keeps nulls as gaps', () => {
    const { page } = setup();
    expect(page.querySelectorAll('.chart-card')).toHaveLength(5);
    expect(page.querySelector('button[aria-pressed=true]')?.textContent).toContain('Distance');
    const heartRatePath = page.querySelector('.chart-card path')!.getAttribute('d')!;
    expect(heartRatePath.match(/M/g)).toHaveLength(2);
    expect(heartRatePath).not.toContain('L');
    expect(page.textContent).toContain('No grade data');
    expect(page.textContent).toContain('No grade adjusted pace data');
  });

  it('uses actual irregular timestamps when changing to time', () => {
    const { page, click } = setup();
    click('Time (HH:mm)');
    const pace = page.querySelectorAll('.chart-card')[1];
    const path = pace.querySelector('path')!.getAttribute('d')!;
    // The middle sample is one quarter of the way through the 40-second interval.
    expect(path).toContain('L248.00,');
    expect(page.querySelector('button[aria-pressed=true]')?.textContent).toContain('Time');
    expect(page.querySelector('svg text:last-of-type')?.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it('shows shared sample values using the keyboard and zooms around selection', () => {
    const { fixture, page, click } = setup();
    page
      .querySelector('svg')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(page.querySelectorAll('.cursor')).toHaveLength(3);
    expect(page.querySelectorAll('output')[1].textContent).toContain('5:30');
    const before = page.querySelector('svg text:last-of-type')!.textContent;
    click('Zoom in');
    expect(page.querySelector('svg text:last-of-type')!.textContent).not.toBe(before);
    click('Reset zoom');
    expect(page.querySelector('svg text:last-of-type')!.textContent).toBe(before);
  });

  it('inverts pace so faster values are higher', () => {
    const slower = { ...sample(10, 100, 140), paceMinutesPerKilometer: 6 };
    const { page } = setup([sample(0, 0, 140), slower]);
    const path = page.querySelectorAll('.chart-card')[1].querySelector('path')!.getAttribute('d')!;
    const coordinates = Array.from(path.matchAll(/[ML]([\d.]+),([\d.]+)/g));
    expect(Number(coordinates[0][2])).toBeLessThan(Number(coordinates[1][2]));
  });

  it('falls back to time for absent distance and handles a single record', () => {
    const { page } = setup([sample(0, null, 150)]);
    expect(page.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(page.querySelector('button[aria-pressed=true]')?.textContent).toContain('Time');
    expect(page.querySelector('.chart-card circle')).toBeTruthy();
    expect(page.textContent).not.toContain('Cumulative distance');
  });
});
