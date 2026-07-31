import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { Home } from '@primeicons/angular/home';
import { Bolt } from '@primeicons/angular/bolt';
import { ChartLine } from '@primeicons/angular/chart-line';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Menubar, Home, Bolt, ChartLine],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('my-training-webapp');

  protected readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', routerLink: ['/'] },
    { label: 'Training', icon: 'training', routerLink: ['/training'], disabled: true },
    { label: 'Statistics', icon: 'statistics', routerLink: ['/statistics'], disabled: true }
  ];
}
