import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ActivityService } from '../../services/activity.service';
import { Activity } from '../../models/activity';
import { getSportMeta } from '../../models/sport';
import {
  toDateInputValue,
  formatDistance,
  formatDuration,
  formatSpeed,
  formatPace,
  formatElevation,
  formatCalories,
  formatIntensity
} from '../../utils/format';
import { TrackMapComponent } from '../../components/track-map/track-map';

export type SportFilter = 'all' | 'running' | 'cycling' | 'training';

interface ActivityGroup {
  date: Date;
  key: string;
  activities: Activity[];
}

@Component({
  selector: 'app-home',
  imports: [
    FormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TrackMapComponent
  ],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private readonly activityService = inject(ActivityService);

  protected readonly rangeStart = signal<Date | null>(this.defaultStart());
  protected readonly rangeEnd = signal<Date | null>(this.defaultEnd());
  protected readonly sportFilter = signal<SportFilter>('all');
  protected readonly activities = signal<Activity[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filterOptions = [
    { label: 'All', value: 'all' as const },
    { label: 'Run', value: 'running' as const },
    { label: 'Bike', value: 'cycling' as const },
    { label: 'Train', value: 'training' as const }
  ];

  protected readonly fmt = {
    distance: formatDistance,
    duration: formatDuration,
    speed: formatSpeed,
    pace: formatPace,
    elevation: formatElevation,
    calories: formatCalories,
    intensity: formatIntensity
  };

  protected readonly expandedIds = signal<Set<number>>(new Set());
  protected readonly tracks = signal<Record<number, number[][]>>({});
  protected readonly trackLoadingIds = signal<Set<number>>(new Set());

  protected readonly filtered = computed<Activity[]>(() => {
    const filter = this.sportFilter();
    const list = [...this.activities()];
    list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    if (filter === 'all') {
      return list;
    }
    return list.filter((a) => a.sport === filter);
  });

  protected readonly groups = computed<ActivityGroup[]>(() => {
    const byDay = new Map<string, ActivityGroup>();
    for (const activity of this.filtered()) {
      const date = new Date(activity.startedAt);
      const key = toDateInputValue(date);
      let group = byDay.get(key);
      if (!group) {
        group = { date, key, activities: [] };
        byDay.set(key, group);
      }
      group.activities.push(activity);
    }
    return [...byDay.values()];
  });

  protected readonly totals = computed(() => {
    const list = this.filtered();
    return {
      count: list.length,
      distance: list.reduce((sum, a) => sum + (a.distanceMeters || 0), 0),
      duration: list.reduce((sum, a) => sum + (a.durationSeconds || 0), 0),
      ascent: list.reduce((sum, a) => sum + (a.ascentMeters || 0), 0),
      calories: list.reduce((sum, a) => sum + (a.calories || 0), 0)
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const [from, to] = this.effectiveRange();
    this.loading.set(true);
    this.error.set(null);
    this.activityService.getActivities(toDateInputValue(from), toDateInputValue(to)).subscribe({
      next: (response) => {
        this.activities.set(response.activities);
        this.loadTracks(response.activities);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load activities. Make sure the server is running.');
        this.loading.set(false);
      }
    });
  }

  protected applyRange(): void {
    this.load();
  }

  protected toggleTrack(id: number): void {
    const expanded = new Set(this.expandedIds());
    if (expanded.has(id)) {
      expanded.delete(id);
      this.expandedIds.set(expanded);
      return;
    }

    expanded.add(id);
    this.expandedIds.set(expanded);
    if (this.tracks()[id] || this.trackLoadingIds().has(id)) return;

    this.loadTrack(id);
  }

  protected isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  protected trackCoords(id: number): number[][] {
    return this.tracks()[id] ?? [];
  }

  protected trackLoading(id: number): boolean {
    return this.trackLoadingIds().has(id);
  }

  private loadTracks(activities: Activity[]): void {
    this.expandedIds.set(new Set());
    this.tracks.set({});
    this.trackLoadingIds.set(new Set(activities.map((activity) => activity.id)));

    for (const activity of activities) {
      this.loadTrack(activity.id, true);
    }
  }

  private loadTrack(id: number, autoExpand = false): void {
    const loading = new Set(this.trackLoadingIds());
    loading.add(id);
    this.trackLoadingIds.set(loading);

    this.activityService.getActivityTrack(id).subscribe({
      next: (response) => {
        const coords = response.track.coordinates ?? [];
        this.tracks.update((tracks) => ({ ...tracks, [id]: coords }));
        this.finishTrackLoading(id);
        if (autoExpand && coords.length >= 2) {
          this.expandedIds.update((ids) => new Set(ids).add(id));
        }
      },
      error: () => {
        this.finishTrackLoading(id);
      }
    });
  }

  private finishTrackLoading(id: number): void {
    this.trackLoadingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  protected sportMeta(sport: string) {
    return getSportMeta(sport);
  }

  protected sportIcon(sport: string): string {
    switch (sport) {
      case 'running': return 'directions_run';
      case 'cycling': return 'directions_bike';
      default: return 'fitness_center';
    }
  }

  protected groupTotals(group: ActivityGroup) {
    return {
      distance: group.activities.reduce((sum, a) => sum + (a.distanceMeters || 0), 0),
      duration: group.activities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0)
    };
  }

  private defaultStart(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }

  private defaultEnd(): Date {
    return new Date();
  }

  private effectiveRange(): Date[] {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    if (start && end) {
      return [start, end];
    }
    return [this.defaultStart(), this.defaultEnd()];
  }
}
