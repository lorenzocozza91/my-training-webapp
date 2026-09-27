import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, catchError, debounceTime, defer, finalize, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeatmapMapComponent } from '../../components/heatmap-map/heatmap-map';
import { HeatmapCell, HeatmapRequest, HeatmapSport, MapViewport } from '../../models/heatmap';
import { HeatmapService } from '../../services/heatmap.service';
import { toDateInputValue } from '../../utils/format';

@Component({
  selector: 'app-heatmap',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    HeatmapMapComponent,
  ],
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.css',
})
export class HeatmapComponent implements OnInit {
  private readonly heatmapService = inject(HeatmapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<HeatmapRequest>();
  private viewport: MapViewport | null = null;

  protected readonly rangeStart = signal<Date | null>(null);
  protected readonly rangeEnd = signal<Date | null>(null);
  protected readonly sport = signal<HeatmapSport>('running');
  protected readonly cells = signal<HeatmapCell[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasLoaded = signal(false);

  ngOnInit(): void {
    this.requests
      .pipe(
        debounceTime(300),
        switchMap((request) =>
          defer(() => {
            this.loading.set(true);
            this.error.set(null);
            return this.heatmapService.getHeatmap(request).pipe(
              catchError(() => {
                this.cells.set([]);
                this.error.set('Could not load heatmap data. Please try again.');
                return of(null);
              }),
              finalize(() => this.loading.set(false)),
            );
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (response) {
          this.cells.set(response.cells ?? []);
          this.hasLoaded.set(true);
        }
      });
  }

  protected onViewportChange(viewport: MapViewport): void {
    this.viewport = viewport;
    this.requestData();
  }

  protected filtersChanged(): void {
    this.requestData();
  }

  protected retry(): void {
    this.requestData();
  }

  private requestData(): void {
    if (!this.viewport) return;

    const request: HeatmapRequest = { ...this.viewport, sport: this.sport() };
    const from = this.rangeStart();
    const to = this.rangeEnd();
    if (from && to) {
      request.from = toDateInputValue(from);
      request.to = toDateInputValue(to);
    }
    this.requests.next(request);
  }
}
