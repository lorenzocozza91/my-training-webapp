import { TestBed } from '@angular/core/testing';
import { AggregatedActivityChartsComponent } from './aggregated-activity-charts';
import { AggregatedActivitySample } from '../../models/activity';

const segment = (
  start: number,
  end: number,
  overrides: Partial<AggregatedActivitySample> = {},
): AggregatedActivitySample => ({
  startedAt: '2026-10-14T08:00:00Z',
  endedAt: '2026-10-14T08:05:00Z',
  startDistanceMeters: start,
  endDistanceMeters: end,
  durationSeconds: 300,
  heartRateBpm: 151.5,
  paceMinutesPerKilometer: 5.5,
  altitudeMeters: 312.4,
  gradePercent: -3.1,
  gapMinutesPerKilometer: 4.8,
  ...overrides,
});

describe('Aggregated activity charts', () => {
  function setup(samples: AggregatedActivitySample[]) {
    const fixture = TestBed.createComponent(AggregatedActivityChartsComponent);
    fixture.componentRef.setInput('samples', samples);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('uses actual distance ranges and bar widths for a late start and partial final segment', () => {
    const page = setup([segment(200, 1000), segment(1000, 2000), segment(2000, 2400)]);
    const bars = page.querySelectorAll('rect');
    expect(bars).toHaveLength(3);
    expect(Number(bars[0].getAttribute('x'))).toBe(72);
    expect(
      Number(bars[2].getAttribute('width')) / Number(bars[1].getAttribute('width')),
    ).toBeCloseTo(0.4);
    expect(page.textContent).toContain('0.2–1 km');
    expect(page.textContent).toContain('2–2.4 km');
    expect(page.querySelectorAll('path')).toHaveLength(2);
    expect(page.querySelector('path')?.getAttribute('d')).toContain('C');
  });

  it('shows all six returned segments for a 5.4 km run', () => {
    const samples = Array.from({ length: 6 }, (_, i) =>
      segment(i * 1000, Math.min((i + 1) * 1000, 5400)),
    );
    const page = setup(samples);
    expect(page.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(page.querySelectorAll('rect')).toHaveLength(6);
    expect(page.querySelector('tbody tr:last-child')?.textContent).toContain('5–5.4 km');
  });

  it('formats server values and decimal pace without deriving pace from duration', () => {
    const page = setup([
      segment(0, 1000),
      segment(1000, 2000, { paceMinutesPerKilometer: 5.999, gapMinutesPerKilometer: 0 }),
    ]);
    const rows = page.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('5:30 /km');
    expect(rows[0].textContent).toContain('4:48 /km');
    expect(rows[0].textContent).toContain('151.5 bpm');
    expect(rows[0].textContent).toContain('312.4 m');
    expect(rows[0].textContent).toContain('-3.1 %');
    expect(rows[0].textContent).toContain('5:00');
    expect(rows[1].textContent).toContain('6:00 /km');
    expect(rows[1].textContent).toContain('0:00 /km');
  });

  it('displays nulls as dashes and splits smooth paths across missing measurements', () => {
    const page = setup([
      segment(0, 1000),
      segment(1000, 2000, {
        heartRateBpm: null,
        altitudeMeters: null,
        gradePercent: null,
        gapMinutesPerKilometer: null,
      }),
      segment(2000, 3000),
      segment(3000, 4000),
    ]);
    const cells = page.querySelectorAll('tbody tr')[1].querySelectorAll('td');
    expect(Array.from(cells).filter((cell) => cell.textContent?.trim() === '—')).toHaveLength(4);
    for (const path of page.querySelectorAll('path')) {
      expect(path.getAttribute('d')?.match(/M/g)).toHaveLength(2);
      expect(path.getAttribute('d')?.match(/C/g)).toHaveLength(1);
    }
  });

  it('shows empty nullable charts and supports a single segment', () => {
    const page = setup([segment(5000, 5400, { heartRateBpm: null, altitudeMeters: null })]);
    expect(page.querySelectorAll('rect')).toHaveLength(1);
    expect(page.textContent).toContain('No heart rate data available.');
    expect(page.textContent).toContain('No altitude data available.');
    expect(page.textContent).not.toContain('NaN');
    expect(page.textContent).toContain('5–5.4 km');
  });
});
