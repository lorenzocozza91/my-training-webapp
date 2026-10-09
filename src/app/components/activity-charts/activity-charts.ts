import { Component, computed, input, signal } from '@angular/core';
import { ActivitySample } from '../../models/activity';

type MetricKey = Exclude<keyof ActivitySample, 'timestamp' | 'distanceMeters'>;
type Axis = 'distance' | 'time';
interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  inverted?: boolean;
}
const METRICS: MetricDefinition[] = [
  { key: 'heartRateBpm', label: 'Heart rate', unit: 'bpm', color: '#c62828' },
  {
    key: 'paceMinutesPerKilometer',
    label: 'Pace',
    unit: 'min/km',
    color: '#1565c0',
    inverted: true,
  },
  { key: 'altitudeMeters', label: 'Altitude', unit: 'm', color: '#387038' },
  { key: 'gradePercent', label: 'Grade', unit: '%', color: '#8e24aa' },
  {
    key: 'gapMinutesPerKilometer',
    label: 'Grade Adjusted Pace',
    unit: 'min/km',
    color: '#00796b',
    inverted: true,
  },
];
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

@Component({
  selector: 'app-activity-charts',
  templateUrl: './activity-charts.html',
  styleUrl: './activity-charts.css',
})
export class ActivityChartsComponent {
  readonly samples = input.required<ActivitySample[]>();
  protected readonly requestedAxis = signal<Axis>('distance');
  protected readonly selection = signal<number | null>(null);
  protected readonly window = signal<[number, number]>([0, 1]);
  protected readonly distanceAvailable = computed(() => {
    const values = this.samples()
      .map((s) => s.distanceMeters)
      .filter(finite);
    return values.length > 0 && values.some((value) => value !== values[0]);
  });
  protected readonly axis = computed<Axis>(() =>
    this.distanceAvailable() ? this.requestedAxis() : 'time',
  );
  private xValue(sample: ActivitySample): number | null {
    const value = this.axis() === 'distance' ? sample.distanceMeters : Date.parse(sample.timestamp);
    return finite(value) ? value : null;
  }
  protected readonly points = computed(() =>
    this.samples().map((sample, index) => ({ sample, index, x: this.xValue(sample) })),
  );
  protected readonly domain = computed<[number, number]>(() => {
    const xs = this.points()
      .map((p) => p.x)
      .filter(finite);
    let min = Infinity,
      max = -Infinity;
    for (const x of xs) {
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    if (!xs.length) return [0, 1];
    if (min === max) max = min + (this.axis() === 'time' ? 60000 : 1000);
    return [min, max];
  });
  protected readonly viewDomain = computed<[number, number]>(() => {
    const [min, max] = this.domain(),
      [from, to] = this.window();
    return [min + (max - min) * from, min + (max - min) * to];
  });
  protected readonly selected = computed(() => {
    const index = this.selection();
    return index === null ? null : (this.points()[index] ?? null);
  });
  protected readonly cursorX = computed(() => {
    const x = this.selected()?.x;
    const [min, max] = this.viewDomain();
    return x != null && x >= min && x <= max ? this.screenX(x) : null;
  });
  protected readonly xTicks = computed(() => {
    const [min, max] = this.viewDomain();
    return Array.from({ length: 5 }, (_, i) => ({
      x: 72 + i * 176,
      label: this.formatX(min + ((max - min) * i) / 4),
    }));
  });
  protected readonly charts = computed(() => {
    const [from, to] = this.viewDomain();
    return METRICS.map((metric) => {
      let min = Infinity,
        max = -Infinity;
      let hasData = false;
      for (const point of this.points()) {
        const value = point.sample[metric.key];
        if (point.x != null && point.x >= from && point.x <= to && finite(value)) {
          hasData = true;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
      if (!hasData)
        return {
          ...metric,
          hasData,
          path: '',
          dots: [] as { x: number; y: number }[],
          ticks: [] as { y: number; label: string }[],
        };
      const padding = max === min ? Math.max(Math.abs(min) * 0.05, 1) : (max - min) * 0.08;
      min -= padding;
      max += padding;
      const y = (value: number) =>
        20 + (metric.inverted ? (value - min) / (max - min) : (max - value) / (max - min)) * 160;
      let path = '',
        connected = false;
      const dots: { x: number; y: number }[] = [];
      for (const point of this.points()) {
        const value = point.sample[metric.key];
        if (point.x == null || point.x < from || point.x > to || !finite(value)) {
          connected = false;
          continue;
        }
        const sx = this.screenX(point.x),
          sy = y(value);
        path += `${connected ? 'L' : 'M'}${sx.toFixed(2)},${sy.toFixed(2)} `;
        if (!connected) dots.push({ x: sx, y: sy });
        connected = true;
      }
      const ticks = Array.from({ length: 4 }, (_, i) => {
        const value = min + ((max - min) * i) / 3;
        return { y: y(value), label: this.formatMetric(value, metric) };
      });
      return { ...metric, hasData, path, dots, ticks };
    });
  });
  private screenX(x: number): number {
    const [min, max] = this.viewDomain();
    return 72 + ((x - min) / (max - min)) * 704;
  }
  protected formatX(value: number): string {
    return this.axis() === 'distance' ? `${(value / 1000).toFixed(2)} km` : this.time(value);
  }
  protected sampleTime(timestamp: string): string {
    return this.time(Date.parse(timestamp));
  }
  protected time(value: number): string {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  protected formatMetric(value: number | null | undefined, metric: MetricDefinition): string {
    if (!finite(value)) return 'No data';
    if (metric.inverted) {
      const seconds = Math.round(value * 60);
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return value.toFixed(metric.key === 'gradePercent' ? 1 : 0);
  }
  protected setAxis(axis: Axis): void {
    this.requestedAxis.set(axis);
    this.window.set([0, 1]);
    this.selection.set(null);
  }
  protected selectAt(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const position = Math.max(
      0,
      Math.min(1, (((event.clientX - rect.left) / rect.width) * 800 - 72) / 704),
    );
    const [min, max] = this.viewDomain(),
      target = min + position * (max - min);
    let closest: number | null = null,
      delta = Infinity;
    for (const point of this.points()) {
      if (
        point.x != null &&
        point.x >= min &&
        point.x <= max &&
        Math.abs(point.x - target) < delta
      ) {
        closest = point.index;
        delta = Math.abs(point.x - target);
      }
    }
    this.selection.set(closest);
  }
  protected selectKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const [min, max] = this.viewDomain();
    const visible = this.points().filter((p) => p.x != null && p.x >= min && p.x <= max);
    if (!visible.length) return;
    const current = visible.findIndex((p) => p.index === this.selection());
    const next =
      current < 0
        ? 0
        : Math.max(
            0,
            Math.min(visible.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)),
          );
    this.selection.set(visible[next].index);
  }
  protected zoom(factor: number): void {
    const [from, to] = this.window(),
      [min, max] = this.domain();
    const selectedX = this.selected()?.x;
    const center = selectedX != null ? (selectedX - min) / (max - min) : (from + to) / 2;
    const width = Math.min(1, Math.max(0.01, (to - from) * factor));
    const start = Math.max(0, Math.min(1 - width, center - width / 2));
    this.window.set([start, start + width]);
  }
  protected resetZoom(): void {
    this.window.set([0, 1]);
  }
}
