import { Routes } from '@angular/router';
import { AssetsComponent } from './components/assets/assets.component';

export const routes: Routes = [
  { path: 'assets', component: AssetsComponent },
  { path: '', redirectTo: '/assets', pathMatch: 'full' },
  { path: '**', redirectTo: '/assets' },
];
