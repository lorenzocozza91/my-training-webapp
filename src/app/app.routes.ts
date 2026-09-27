import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { HeatmapComponent } from './pages/heatmap/heatmap';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'heatmap', component: HeatmapComponent },
  { path: '**', redirectTo: '' }
];
