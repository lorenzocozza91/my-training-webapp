import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { Button } from 'primeng/button';
import { Avatar } from 'primeng/avatar';
import { Skeleton } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Bolt } from '@primeicons/angular/bolt';
import { ArrowUp } from '@primeicons/angular/arrow-up';
import { Hashtag } from '@primeicons/angular/hashtag';
import { MapMarker } from '@primeicons/angular/map-marker';
import { Clock } from '@primeicons/angular/clock';
import { Heart } from '@primeicons/angular/heart';
import { ChartLine } from '@primeicons/angular/chart-line';

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
  formatCalories
} from '../../utils/format';

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
    DatePicker,
    SelectButton,
    Button,
    Avatar,
    Skeleton,
    Message,
    Bolt,
    ArrowUp,
    Hashtag,
    MapMarker,
    Clock,
    Heart,
    ChartLine
  ],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private readonly activityService = inject(ActivityService);

  protected readonly range = signal<Date[] | null>(this.defaultRange());
  protected readonly sportFilter = signal<SportFilter>('all');
  protected readonly activities = signal<Activity[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filterOptions = [
    { label: 'All', value: 'all' as const },
    { label: 'Running', value: 'running' as const },
    { label: 'Cycling', value: 'cycling' as const },
    { label: 'Training', value: 'training' as const }
  ];

  protected readonly fmt = {
    distance: formatDistance,
    duration: formatDuration,
    speed: formatSpeed,
    pace: formatPace,
    elevation: formatElevation,
    calories: formatCalories
  };

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

  protected applyRange(): void {
    this.load();
  }

  protected load(): void {
    const [from, to] = this.effectiveRange();
    this.loading.set(true);
    this.error.set(null);
    this.activityService.getActivities(toDateInputValue(from), toDateInputValue(to)).subscribe({
      next: (response) => {
        this.activities.set(response.activities);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load activities. Make sure the server is running and reachable.');
        this.loading.set(false);
      }
    });
  }

  protected sportMeta(sport: string) {
    return getSportMeta(sport);
  }

  protected groupTotals(group: ActivityGroup) {
    return {
      distance: group.activities.reduce((sum, a) => sum + (a.distanceMeters || 0), 0),
      duration: group.activities.reduce((sum, a) => sum + (a.durationSeconds || 0), 0)
    };
  }

  private defaultRange(): Date[] {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return [from, to];
  }

  private effectiveRange(): Date[] {
    const value = this.range();
    return value && value.length === 2 ? value : this.defaultRange();
  }
}
