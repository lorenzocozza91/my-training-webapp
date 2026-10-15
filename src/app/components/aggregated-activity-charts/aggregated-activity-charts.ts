import { Component, computed, input, signal } from '@angular/core';
import { AggregatedActivitySample } from '../../models/activity';
import { formatDuration, formatMinutesPerKilometer } from '../../utils/format';

const METRICS = [
  { key: 'paceMinutesPerKilometer', label: 'Pace', unit: '/km', color: '#1565c0' },
  { key: 'gapMinutesPerKilometer', label: 'GAP', unit: '/km', color: '#8e24aa' },
  { key: 'heartRateBpm', label: 'Heart rate', unit: 'bpm', color: '#c62828' },
  { key: 'altitudeMeters', label: 'Altitude', unit: 'm', color: '#387038' },
] as const;

@Component({
  selector: 'app-aggregated-activity-charts',
  templateUrl: './aggregated-activity-charts.html',
  styleUrls: ['../activity-charts/activity-charts.css', './aggregated-activity-charts.css'],
})
export class AggregatedActivityChartsComponent {
  readonly samples = input.required<AggregatedActivitySample[]>();
  protected readonly showGap = signal(false);
  protected readonly formatDuration = formatDuration;
  protected readonly formatPace = formatMinutesPerKilometer;
  protected number(value: number | null, unit: string): string {
    return value == null || !Number.isFinite(value) ? '—' : `${Number(value.toFixed(1))} ${unit}`;
  }
  protected range(sample: AggregatedActivitySample): string {
    return `${sample.startDistanceMeters / 1000}–${sample.endDistanceMeters / 1000} km`;
  }
  private readonly domain = computed(() => {
    let min = Infinity,
      max = -Infinity;
    for (const sample of this.samples()) {
      min = Math.min(min, sample.startDistanceMeters);
      max = Math.max(max, sample.endDistanceMeters);
    }
    return Number.isFinite(min) && max > min ? [min, max] : [0, 1000];
  });
  private screenX(value: number): number {
    const [min, max] = this.domain();
    return 72 + ((value - min) / (max - min)) * 704;
  }
  protected readonly xTicks = computed(() => {
    const [min, max] = this.domain();
    return Array.from({ length: 5 }, (_, i) => ({
      x: 72 + i * 176,
      label: `${((min + ((max - min) * i) / 4) / 1000).toFixed(2)} km`,
    }));
  });
  protected readonly charts = computed(() =>
    METRICS.filter((metric) => this.showGap() || metric.key !== 'gapMinutesPerKilometer').map(
      (metric) => {
        const bars =
          metric.key === 'paceMinutesPerKilometer' || metric.key === 'gapMinutesPerKilometer';
        const values = this.samples()
          .map((s) => s[metric.key])
          .filter((v): v is number => v != null && Number.isFinite(v));
        // Pace and GAP share a scale so their bar heights can be compared directly.
        const scaleValues = bars
          ? this.samples()
              .flatMap((s) =>
                this.showGap()
                  ? [s.paceMinutesPerKilometer, s.gapMinutesPerKilometer]
                  : [s.paceMinutesPerKilometer],
              )
              .filter((v): v is number => v != null && Number.isFinite(v))
          : values;
        let min = Infinity,
          max = -Infinity;
        for (const value of scaleValues) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        if (bars) min *= 0.9;
        const padding = max === min ? Math.max(Math.abs(min) * 0.05, 1) : (max - min) * 0.08;
        if (!bars) min -= padding;
        max += padding;
        const y = (value: number) => 20 + ((max - value) / (max - min)) * 160;
        const points: { x: number; y: number }[] = [];
        const rectangles: { x: number; y: number; width: number; height: number; label: string }[] =
          [];
        let path = '',
          previous: { x: number; y: number } | null = null,
          previousEnd: number | null = null;
        for (const sample of this.samples()) {
          const value = sample[metric.key];
          if (value == null || !Number.isFinite(value)) {
            previous = null;
            previousEnd = null;
            continue;
          }
          const point = {
            x: this.screenX((sample.startDistanceMeters + sample.endDistanceMeters) / 2),
            y: y(value),
          };
          if (bars) {
            const startX = this.screenX(sample.startDistanceMeters);
            const width =
              (this.screenX(sample.endDistanceMeters) - startX) / (this.showGap() ? 2 : 1);
            rectangles.push({
              x: startX + (metric.key === 'gapMinutesPerKilometer' ? width : 0),
              y: point.y,
              width,
              height: 180 - point.y,
              label: [
                this.range(sample),
                `Pace: ${formatMinutesPerKilometer(sample.paceMinutesPerKilometer)}`,
                `GAP: ${formatMinutesPerKilometer(sample.gapMinutesPerKilometer)}`,
                `Heart rate: ${this.number(sample.heartRateBpm, 'bpm')}`,
                `Altitude: ${this.number(sample.altitudeMeters, 'm')}`,
              ].join('\n'),
            });
          } else {
            // Horizontal tangents create smooth, bounded curves without overshooting server values.
            if (previous && previousEnd === sample.startDistanceMeters) {
              const middle = (previous.x + point.x) / 2;
              path += `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y} `;
            } else {
              path += `M${point.x},${point.y} `;
            }
            points.push(point);
            previous = point;
            previousEnd = sample.endDistanceMeters;
          }
        }
        return {
          ...metric,
          bars,
          hasData: values.length > 0,
          path,
          points,
          rectangles,
          ticks:
            scaleValues.length && metric.key !== 'gapMinutesPerKilometer'
              ? Array.from({ length: 4 }, (_, i) => {
                  const value = min + ((max - min) * i) / 3;
                  return {
                    y: y(value),
                    label: bars ? formatMinutesPerKilometer(value) : value.toFixed(1),
                  };
                })
              : [],
        };
      },
    ),
  );
}
