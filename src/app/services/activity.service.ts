import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Activity, ActivitiesResponse, TrackResponse } from '../models/activity';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly activities = new Map<number, Activity>();

  getActivities(from: string, to: string): Observable<ActivitiesResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ActivitiesResponse>(`${environment.apiBaseUrl}/activities`, { params }).pipe(
      tap(({ activities }) => activities.forEach((activity) => this.activities.set(activity.id, activity)))
    );
  }

  getActivity(id: number): Observable<Activity> {
    const cached = this.activities.get(id);
    if (cached) return of(cached);

    return this.http.get<Activity | { activity: Activity }>(`${environment.apiBaseUrl}/activities/${id}`).pipe(
      map((response) => 'activity' in response ? response.activity : response),
      tap((activity) => this.activities.set(activity.id, activity))
    );
  }

  getActivityTrack(id: number): Observable<TrackResponse> {
    return this.http.get<TrackResponse>(`${environment.apiBaseUrl}/activities/${id}/track`);
  }
}
