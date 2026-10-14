import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, catchError, merge, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Activity, ActivitySample, AggregatedActivitySample } from '../../models/activity';
import { ActivityChartsComponent } from '../../components/activity-charts/activity-charts';
import { AggregatedActivityChartsComponent } from '../../components/aggregated-activity-charts/aggregated-activity-charts';
import { getSportMeta } from '../../models/sport';
import { ActivityService } from '../../services/activity.service';
import { TrackMapComponent } from '../../components/track-map/track-map';
import {
  formatCalories,
  formatDistance,
  formatDuration,
  formatElevation,
  formatIntensity,
  formatPace,
  formatSpeed,
} from '../../utils/format';

interface Metric {
  label: string;
  value: string;
}

@Component({
  selector: 'app-activity-details',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TrackMapComponent,
    ActivityChartsComponent,
    AggregatedActivityChartsComponent,
  ],
  templateUrl: './activity-details.html',
  styleUrl: './activity-details.css',
})
export class ActivityDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ActivityService);
  protected readonly backParams = this.route.snapshot.queryParams;
  protected readonly activity = signal<Activity | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly coordinates = signal<number[][]>([]);
  protected readonly trackLoading = signal(false);
  protected readonly trackError = signal(false);
  protected readonly samples = signal<ActivitySample[]>([]);
  protected readonly samplesLoading = signal(false);
  protected readonly samplesError = signal<string | null>(null);
  private readonly samplesRetry = new Subject<void>();

  protected readonly aggregationIntervals = [0.5, 1, 2];
  protected readonly aggregationKilometers = signal(1);
  protected readonly aggregatedSamples = signal<AggregatedActivitySample[]>([]);
  protected readonly aggregatedLoading = signal(false);
  protected readonly aggregatedError = signal<string | null>(null);
  private readonly aggregationRequests = new BehaviorSubject<number>(1);

  protected selectAggregation(kilometers: number): void {
    if (!this.aggregationIntervals.includes(kilometers)) return;
    this.aggregationKilometers.set(kilometers);
    this.aggregationRequests.next(kilometers);
  }

  protected retryAggregation(): void {
    this.aggregationRequests.next(this.aggregationKilometers());
  }

  protected retrySamples(): void {
    this.samplesRetry.next();
  }

  protected readonly kind = computed(() => {
    const activity = this.activity();
    if (activity?.sport === 'running' || activity?.running) return 'running';
    if (activity?.sport === 'cycling' || activity?.cycling) return 'cycling';
    return 'training';
  });
  protected readonly meta = computed(() => getSportMeta(this.activity()?.sport ?? 'training'));
  protected readonly icon = computed(() =>
    this.kind() === 'running'
      ? 'directions_run'
      : this.kind() === 'cycling'
        ? 'directions_bike'
        : 'fitness_center',
  );
  protected readonly metrics = computed<Metric[]>(() => {
    const a = this.activity();
    if (!a) return [];
    const metrics: Metric[] = [];
    const add = (label: string, value: number | null, format: (n: number) => string) => {
      if (value != null && Number.isFinite(value)) metrics.push({ label, value: format(value) });
    };
    const unit = (suffix: string) => (n: number) => `${Math.round(n)} ${suffix}`;
    const outdoor = this.kind() !== 'training';
    if (outdoor) add('Distance', a.distanceMeters, formatDistance);
    add(outdoor ? 'Moving time' : 'Duration', a.durationSeconds, formatDuration);
    add('Elapsed time', a.elapsedTimeSeconds, formatDuration);
    if (outdoor) {
      add(
        this.kind() === 'running' ? 'Average pace' : 'Average speed',
        a.averageSpeedMetersPerSecond,
        this.kind() === 'running' ? formatPace : formatSpeed,
      );
      if (this.kind() === 'cycling') add('Maximum speed', a.maxSpeedMetersPerSecond, formatSpeed);
      add('Elevation gain', a.ascentMeters, formatElevation);
      add('Elevation loss', a.descentMeters, formatElevation);
    }
    add('Calories', a.calories, formatCalories);
    add('Average heart rate', a.averageHeartRateBpm, unit('bpm'));
    add('Maximum heart rate', a.maxHeartRateBpm, unit('bpm'));
    if (outdoor) {
      add('Average cadence', a.averageCadenceRpm, unit('rpm'));
      add('Maximum cadence', a.maxCadenceRpm, unit('rpm'));
      add('Average power', a.averagePowerWatts, unit('W'));
      add('Maximum power', a.maxPowerWatts, unit('W'));
    }
    add('Intensity', a.intensityFactor, formatIntensity);
    return metrics;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.activity.set(null);
          this.error.set(null);
          this.loading.set(true);
          this.coordinates.set([]);
          this.trackLoading.set(false);
          this.trackError.set(false);
          this.aggregatedSamples.set([]);
          this.aggregatedLoading.set(false);
          this.aggregatedError.set(null);
          this.samples.set([]);
          this.samplesLoading.set(false);
          this.samplesError.set(null);
        }),
        switchMap((params) => {
          const rawId = params.get('id');
          const id = Number(rawId);
          if (!rawId || !/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) {
            this.error.set('Activity not found.');
            this.loading.set(false);
            return of(null);
          }
          return this.service.getActivity(id).pipe(
            tap((activity) => {
              this.activity.set(activity);
              this.loading.set(false);
              this.trackLoading.set(true);
            }),
            switchMap((activity) =>
              merge(
                activity.sport === 'running' || activity.running
                  ? this.samplesRetry.pipe(
                      startWith(undefined),
                      tap(() => {
                        this.samplesLoading.set(true);
                        this.samplesError.set(null);
                      }),
                      switchMap(() =>
                        this.service.getActivitySamples(id).pipe(
                          tap((response) => {
                            this.samples.set(response.samples);
                            this.samplesLoading.set(false);
                          }),
                          catchError((error: HttpErrorResponse) => {
                            this.samplesError.set(
                              error.status === 404
                                ? 'Samples for this activity were not found.'
                                : 'Could not load activity samples. Please try again.',
                            );
                            this.samplesLoading.set(false);
                            return of(null);
                          }),
                        ),
                      ),
                    )
                  : of(null),
                activity.sport === 'running' || activity.running
                  ? this.aggregationRequests.pipe(
                      tap(() => {
                        this.aggregatedSamples.set([]);
                        this.aggregatedLoading.set(true);
                        this.aggregatedError.set(null);
                      }),
                      switchMap((kilometers) =>
                        this.service.getAggregatedActivitySamples(id, kilometers).pipe(
                          tap((response) => {
                            this.aggregatedSamples.set(response.samples);
                            this.aggregatedLoading.set(false);
                          }),
                          catchError((error: HttpErrorResponse) => {
                            this.aggregatedError.set(
                              error.status === 404
                                ? 'Segments for this activity were not found.'
                                : error.status === 400
                                  ? 'This aggregation interval cannot be loaded. Try a larger interval.'
                                  : 'Could not load running segments. Please try again.',
                            );
                            this.aggregatedLoading.set(false);
                            return of(null);
                          }),
                        ),
                      ),
                    )
                  : of(null),
                this.service.getActivityTrack(id).pipe(
                  tap((response) => {
                    this.coordinates.set(
                      (response.track.coordinates ?? []).filter(
                        (point) =>
                          point.length >= 2 &&
                          Number.isFinite(point[0]) &&
                          Number.isFinite(point[1]),
                      ),
                    );
                    this.trackLoading.set(false);
                  }),
                  catchError(() => {
                    this.trackError.set(true);
                    this.trackLoading.set(false);
                    return of(null);
                  }),
                ),
              ),
            ),
            catchError((error: HttpErrorResponse) => {
              this.error.set(
                error.status === 404
                  ? 'Activity not found.'
                  : 'Could not load this activity. Please try again.',
              );
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
