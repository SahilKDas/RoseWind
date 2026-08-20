import { Routes } from '@angular/router';
import { authGuard } from './core/auth.service';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((module) => module.Home), pathMatch: 'full' },
  { path: 'learn', loadComponent: () => import('./pages/learn/learn').then((module) => module.Learn) },
  { path: 'editor', canActivate: [authGuard], loadComponent: () => import('./pages/editor/editor').then((module) => module.Editor) },
  { path: '**', redirectTo: '' },
];
