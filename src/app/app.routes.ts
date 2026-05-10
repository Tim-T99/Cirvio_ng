import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { DashboardComponent } from './dashboard/dashboard';
import { ChatComponent } from './dashboard/chat/chat';
import { DocumentsComponent } from './dashboard/documents/documents';
import { SettingsComponent } from './dashboard/settings/settings';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    children: [
      { path: '', component: ChatComponent },
      { path: 'documents', component: DocumentsComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
