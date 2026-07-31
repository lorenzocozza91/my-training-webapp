import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ActivitiesResponse } from '../models/activity';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);

  getActivities(from: string, to: string): Observable<ActivitiesResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<ActivitiesResponse>(`${environment.apiBaseUrl}/activities`, { params });
  }
}
