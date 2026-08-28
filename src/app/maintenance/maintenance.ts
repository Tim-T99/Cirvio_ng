import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../shared/logo/logo';

@Component({
  selector: 'app-maintenance',
  imports: [RouterLink, LogoComponent],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceComponent {}
