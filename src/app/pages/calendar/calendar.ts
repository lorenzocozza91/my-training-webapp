import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, catchError, of, switchMap, tap } from 'rxjs';
import { Activity } from '../../models/activity';
import { getSportMeta } from '../../models/sport';
import { ActivityService } from '../../services/activity.service';
import {
  formatDistance,
  formatDuration,
  formatMinutesPerKilometer,
  formatSpeed,
  toDateInputValue,
} from '../../utils/format';

@Component({
  selector: 'app-calendar',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class CalendarComponent {
  private readonly service = inject(ActivityService);
  private readonly today = new Date();
  protected readonly todayKey = toDateInputValue(this.today);
  protected readonly month = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  private readonly requests = new BehaviorSubject(this.month());
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly activities = signal<Activity[]>([]);
  private summarize(activities: Activity[]) {
    const running = activities.filter((activity) => activity.sport === 'running');
    const cycling = activities.filter((activity) => activity.sport === 'cycling');
    const time = (list: Activity[]) => {
      const seconds = list.reduce((sum, activity) => sum + (activity.durationSeconds || 0), 0);
      return seconds === 0 ? '0:00' : formatDuration(seconds);
    };
    const distance = (list: Activity[]) => {
      const meters = list.reduce((sum, activity) => sum + (activity.distanceMeters || 0), 0);
      return meters === 0 ? '0.00 km' : formatDistance(meters);
    };
    return [
      { label: 'Total time', value: time(activities) },
      { label: 'Total activities', value: String(activities.length) },
      { label: 'Run time', value: time(running) },
      { label: 'Run distance', value: distance(running) },
      { label: 'Cycling time', value: time(cycling) },
      { label: 'Cycling distance', value: distance(cycling) },
    ];
  }
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly sports = computed(() =>
    [...new Set(this.activities().map((activity) => activity.sport))].map((sport) => ({
      sport,
      ...getSportMeta(sport),
    })),
  );
  protected readonly isCurrentMonth = computed(
    () =>
      this.month().getFullYear() === this.today.getFullYear() &&
      this.month().getMonth() === this.today.getMonth(),
  );
  protected readonly days = computed(() => {
    const month = this.month();
    const offset = (month.getDay() + 6) % 7;
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const byDay = new Map<string, Activity[]>();
    for (const activity of this.activities()) {
      const key = toDateInputValue(new Date(activity.startedAt));
      const activities = byDay.get(key) ?? [];
      activities.push(activity);
      byDay.set(key, activities);
    }
    return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1);
      const key = toDateInputValue(date);
      const inMonth = date.getMonth() === month.getMonth();
      return { date, key, inMonth, activities: byDay.get(key) ?? [] };
    });
  });
  protected readonly weeks = computed(() => {
    const days = this.days();
    return Array.from({ length: days.length / 7 }, (_, index) => {
      const week = days.slice(index * 7, index * 7 + 7);
      return {
        key: week[0].key,
        days: week,
        summary: this.summarize(week.flatMap((day) => day.activities)),
      };
    });
  });

  private calendarRange(month: Date): [Date, Date] {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
    return [start, end];
  }

  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
          this.activities.set([]);
        }),
        switchMap((month) => {
          const [start, end] = this.calendarRange(month);
          return this.service.getActivities(toDateInputValue(start), toDateInputValue(end)).pipe(
            catchError(() => {
              this.error.set(true);
              return of({ activities: [] as Activity[] });
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ activities }) => {
        const now = Date.now();
        this.activities.set(
          activities
            .filter((activity) => new Date(activity.startedAt).getTime() <= now)
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        );
        this.loading.set(false);
      });
  }

  protected changeMonth(offset: number): void {
    const current = this.month();
    const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    if (next > this.today) return;
    this.month.set(next);
    this.reload();
  }

  protected currentMonth(): void {
    this.month.set(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
    this.reload();
  }

  protected reload(): void {
    this.requests.next(this.month());
  }

  protected readonly sportMeta = getSportMeta;

  protected activityTitle(activity: Activity): string {
    const label = activity.sport === 'running' ? 'Run' : getSportMeta(activity.sport).label;
    const speed = activity.averageSpeedMetersPerSecond;
    const rate =
      speed != null && speed > 0 && Number.isFinite(speed)
        ? activity.sport === 'cycling'
          ? formatSpeed(speed)
          : formatMinutesPerKilometer(1000 / speed / 60)
        : '—';
    return `${label} · ${formatDistance(activity.distanceMeters)} · ${rate}`;
  }
}
