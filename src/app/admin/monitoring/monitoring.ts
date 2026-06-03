import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api/admin`;
const POLL_MS = 30_000; // refresh every 30 s

interface MonitoringData {
  timestamp: string;
  sessions: { activeUsers: number; activeAdmins: number };
  devices: { active: number; byType: Record<string, number> };
  signups: { last24h: number; lastHour: number };
  workforce: { active: number; total: number };
  compliance: { expiringVisas: number; expiredVisas: number; pendingWps: number };
  tenantsByStatus: Record<string, number>;
  newDevices: {
    id: string; user: string; tenant: string;
    deviceName: string; ipAddress: string | null; createdAt: string;
  }[];
  recentActivity: {
    id: string; action: string; actor: string;
    targetType?: string; targetId?: string; createdAt: string;
  }[];
}

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './monitoring.html',
})
export class MonitoringComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  data      = signal<MonitoringData | null>(null);
  loading   = signal(true);
  error     = signal('');
  lastFetch = signal<Date | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit()    { this.fetch(); this.timer = setInterval(() => this.fetch(), POLL_MS); }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  fetch() {
    this.http.get<MonitoringData>(`${API}/monitoring`).subscribe({
      next: (d) => { this.data.set(d); this.lastFetch.set(new Date()); this.loading.set(false); this.error.set(''); },
      error: () => { this.error.set('Failed to fetch monitoring data.'); this.loading.set(false); },
    });
  }

  actionStyle(action: string): { bg: string; color: string } {
    if (action.includes('SUSPEND') || action.includes('CANCEL')) return { bg: 'var(--danger-bg)',  color: 'var(--danger)'  };
    if (action.includes('CREATE')  || action.includes('ACTIV'))  return { bg: 'var(--success-bg)', color: 'var(--success)' };
    if (action.includes('UPDATE')  || action.includes('PLAN'))   return { bg: 'var(--info-bg)',    color: 'var(--info)'    };
    return { bg: 'var(--neutral-100)', color: 'var(--fg-3)' };
  }
}
