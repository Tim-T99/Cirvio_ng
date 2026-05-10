import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';

export interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './audit.html',
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly expandedId = signal<string | null>(null);

  readonly limit = 20;

  ngOnInit(): void {
    this.fetchAudit();
  }

  fetchAudit(): void {
    this.loading.set(true);
    this.error.set('');
    const s = this.search() ? `&search=${encodeURIComponent(this.search())}` : '';
    this.http
      .get<AuditResponse>(`/api/admin/audit?page=${this.page()}&limit=${this.limit}${s}`)
      .subscribe({
        next: (data) => {
          this.entries.set(data.entries ?? []);
          this.total.set(data.total ?? 0);
          this.totalPages.set(data.totalPages ?? 1);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load audit log.');
          this.loading.set(false);
        },
      });
  }

  onSearch(val: string): void {
    this.search.set(val);
    this.page.set(1);
    this.fetchAudit();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.fetchAudit();
  }

  toggleExpand(id: string): void {
    this.expandedId.update(cur => (cur === id ? null : id));
  }

  hasMeta(entry: AuditEntry): boolean {
    return !!entry.meta && Object.keys(entry.meta).length > 0;
  }

  metaJson(entry: AuditEntry): string {
    return JSON.stringify(entry.meta, null, 2);
  }

  actionStyle(action: string): { background: string; color: string } {
    const a = action?.toLowerCase() ?? '';
    if (a.includes('create') || a.includes('add'))    return { background: 'var(--success-bg)', color: 'var(--success)' };
    if (a.includes('delete') || a.includes('remove') || a.includes('cancel'))  return { background: 'var(--danger-bg)',  color: 'var(--danger)' };
    if (a.includes('suspend') || a.includes('disable') || a.includes('deactivate')) return { background: 'var(--warning-bg)', color: 'var(--warning)' };
    if (a.includes('update') || a.includes('edit') || a.includes('patch')) return { background: 'var(--info-bg)', color: 'var(--info)' };
    if (a.includes('login') || a.includes('logout') || a.includes('auth')) return { background: 'rgba(140,201,181,0.15)', color: 'var(--cirvio-hunter)' };
    return { background: 'var(--neutral-100)', color: 'var(--fg-2)' };
  }

  readonly pages = computed(() => {
    const total = this.totalPages();
    const cur = this.page();
    const arr: (number | '...')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) arr.push(i);
    } else {
      arr.push(1);
      if (cur > 3) arr.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) arr.push(i);
      if (cur < total - 2) arr.push('...');
      arr.push(total);
    }
    return arr;
  });
}
