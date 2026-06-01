import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api`;

interface WpsRecord {
  id: string;
  month: number; year: number;
  basicSalary: number; netSalary: number;
  housingAllowance: number; transportAllowance: number;
  otherAllowances: number; deductions: number;
  paymentDate?: string; status: string;
  isLate: boolean; lateByDays: number;
  violationRef?: string; notes?: string;
  submittedAt?: string; confirmedAt?: string;
  employee: { id: string; firstName: string; lastName: string; jobTitle?: string; department?: { name: string } };
}

interface SifFile {
  id: string; month: number; year: number;
  fileName: string; status: string;
  employeeCount: number; totalAmountAed: number;
  generatedAt: string; submittedAt?: string; confirmedAt?: string;
}

interface WpsDashboard {
  year: number;
  totalRecords: number; confirmed: number; pending: number;
  late: number; violations: number;
  monthly: { month: number; totalNetSalary: number; recordCount: number; confirmedCount: number }[];
}

interface Employee { id: string; firstName: string; lastName: string; }

type RecordForm = {
  employeeId: string; month: number; year: number;
  basicSalary: number | ''; housingAllowance: number | '';
  transportAllowance: number | ''; otherAllowances: number | '';
  deductions: number | ''; paymentDate: string; notes: string;
};

@Component({
  selector: 'app-wps',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './wps.html',
})
export class WpsComponent implements OnInit {
  private http = inject(HttpClient);

  dashboard   = signal<WpsDashboard | null>(null);
  records     = signal<WpsRecord[]>([]);
  sifFile     = signal<SifFile | null>(null);
  employees   = signal<Employee[]>([]);
  total       = signal(0);
  loading     = signal(true);
  error       = signal('');

  // Month/year selector
  selectedMonth = signal(new Date().getMonth() + 1);
  selectedYear  = signal(new Date().getFullYear());

  // Filters
  statusFilter = signal('');
  page         = signal(1);
  readonly pageSize = 20;
  totalPages   = computed(() => Math.ceil(this.total() / this.pageSize));

  // Create record panel
  showPanel  = signal(false);
  editingId  = signal<string | null>(null);
  form       = signal<RecordForm>({
    employeeId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    basicSalary: '', housingAllowance: '', transportAllowance: '',
    otherAllowances: '', deductions: '', paymentDate: '', notes: '',
  });
  saving     = signal(false);
  saveError  = signal('');

  // Bulk create
  bulkLoading   = signal(false);
  bulkOverrides = signal<Record<string, number>>({});

  // Violation modal
  violationRecord = signal<WpsRecord | null>(null);
  violationRef    = signal('');
  addingViolation = signal(false);

  // SIF workflow
  sifLoading      = signal(false);
  sifContent      = signal('');
  showSifPreview  = signal(false);

  readonly MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  readonly YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly WPS_STATUSES = ['PENDING','SUBMITTED','CONFIRMED','FAILED','EXEMPT'];

  ngOnInit() {
    this.loadEmployees();
    this.loadAll();
  }

  loadAll() {
    this.loadDashboard();
    this.loadRecords();
    this.loadSif();
  }

  loadDashboard() {
    this.http.get<WpsDashboard>(`${API}/wps/dashboard?year=${this.selectedYear()}`).subscribe({
      next: (d) => this.dashboard.set(d),
    });
  }

  loadRecords() {
    this.loading.set(true);
    const params: Record<string, string> = {
      page: String(this.page()), pageSize: String(this.pageSize),
      month: String(this.selectedMonth()), year: String(this.selectedYear()),
    };
    if (this.statusFilter()) params['status'] = this.statusFilter();
    const qs = new URLSearchParams(params).toString();
    this.http.get<{ data: WpsRecord[]; total: number }>(`${API}/wps?${qs}`).subscribe({
      next: (r) => { this.records.set(r.data); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load WPS records.'); this.loading.set(false); },
    });
  }

  loadSif() {
    this.http.get<SifFile[]>(`${API}/wps?month=${this.selectedMonth()}&year=${this.selectedYear()}&pageSize=1`).subscribe({
      // SIF is loaded via separate endpoint; try to infer from dashboard
    });
    // Load SIF file for this period — backend doesn't have a direct list endpoint for SIF
    // We'll show the SIF section based on what generateSif returns
  }

  loadEmployees() {
    this.http.get<{ data: Employee[] }>(`${API}/employees?pageSize=200&status=ACTIVE`).subscribe({
      next: (r) => this.employees.set(r.data),
    });
  }

  applyFilter() { this.page.set(1); this.loadRecords(); }
  goPage(p: number) { this.page.set(p); this.loadRecords(); }

  changePeriod() {
    this.page.set(1);
    this.sifFile.set(null);
    this.sifContent.set('');
    this.loadAll();
  }

  // ── Create / Edit ────────────────────────────────────────────────────────────

  openCreate() {
    this.editingId.set(null);
    this.form.set({
      employeeId: '', month: this.selectedMonth(), year: this.selectedYear(),
      basicSalary: '', housingAllowance: '', transportAllowance: '',
      otherAllowances: '', deductions: '', paymentDate: '', notes: '',
    });
    this.saveError.set('');
    this.showPanel.set(true);
  }

  openEdit(r: WpsRecord) {
    if (r.status === 'CONFIRMED') return;
    this.editingId.set(r.id);
    this.form.set({
      employeeId: r.employee.id,
      month: r.month, year: r.year,
      basicSalary: r.basicSalary, housingAllowance: r.housingAllowance,
      transportAllowance: r.transportAllowance, otherAllowances: r.otherAllowances,
      deductions: r.deductions,
      paymentDate: r.paymentDate ? r.paymentDate.substring(0, 10) : '',
      notes: r.notes ?? '',
    });
    this.saveError.set('');
    this.showPanel.set(true);
  }

  setField(key: keyof RecordForm, value: any) {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save() {
    const f = this.form();
    if (!f.employeeId && !this.editingId()) { this.saveError.set('Select an employee.'); return; }
    if (!f.basicSalary) { this.saveError.set('Basic salary is required.'); return; }
    this.saving.set(true); this.saveError.set('');

    const body: Record<string, unknown> = {
      month: f.month, year: f.year,
      basicSalary: +f.basicSalary,
    };
    if (!this.editingId()) body['employeeId'] = f.employeeId;
    if (f.housingAllowance   !== '') body['housingAllowance']   = +f.housingAllowance;
    if (f.transportAllowance !== '') body['transportAllowance'] = +f.transportAllowance;
    if (f.otherAllowances    !== '') body['otherAllowances']    = +f.otherAllowances;
    if (f.deductions         !== '') body['deductions']         = +f.deductions;
    if (f.paymentDate) body['paymentDate'] = f.paymentDate;
    if (f.notes) body['notes'] = f.notes;

    const id = this.editingId();
    const req = id
      ? this.http.patch(`${API}/wps/${id}`, body)
      : this.http.post(`${API}/wps`, body);

    req.subscribe({
      next: () => { this.showPanel.set(false); this.saving.set(false); this.loadAll(); },
      error: (err) => { this.saveError.set(err.error?.error ?? 'Save failed.'); this.saving.set(false); },
    });
  }

  // ── Bulk create ──────────────────────────────────────────────────────────────

  bulkCreate() {
    if (!confirm(`Create WPS records for all active employees for ${this.monthName(this.selectedMonth())} ${this.selectedYear()}? Existing records will be skipped.`)) return;
    this.bulkLoading.set(true);
    this.http.post<{ created: number; skipped: number }>(`${API}/wps/bulk`, {
      month: this.selectedMonth(),
      year: this.selectedYear(),
    }).subscribe({
      next: (r) => {
        this.bulkLoading.set(false);
        this.loadAll();
        alert(`Created ${r.created} records, skipped ${r.skipped} existing.`);
      },
      error: (err) => { this.error.set(err.error?.error ?? 'Bulk create failed.'); this.bulkLoading.set(false); },
    });
  }

  // ── SIF workflow ─────────────────────────────────────────────────────────────

  generateSif() {
    this.sifLoading.set(true);
    this.http.post<{ sifContent: string; sifFile: SifFile }>(`${API}/wps/sif/generate`, {
      month: this.selectedMonth(),
      year: this.selectedYear(),
    }).subscribe({
      next: (r) => {
        this.sifFile.set(r.sifFile);
        this.sifContent.set(r.sifContent);
        this.sifLoading.set(false);
      },
      error: (err) => { this.error.set(err.error?.error ?? 'SIF generation failed.'); this.sifLoading.set(false); },
    });
  }

  submitSif() {
    const sif = this.sifFile();
    if (!sif) return;
    if (!confirm('Submit this SIF file? All linked WPS records will be marked SUBMITTED.')) return;
    this.sifLoading.set(true);
    this.http.post<SifFile>(`${API}/wps/sif/${sif.id}/submit`, {}).subscribe({
      next: (f) => { this.sifFile.set(f); this.sifLoading.set(false); this.loadRecords(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Submit failed.'); this.sifLoading.set(false); },
    });
  }

  confirmSif() {
    const sif = this.sifFile();
    if (!sif) return;
    if (!confirm('Confirm this SIF? WPS records will be marked CONFIRMED and overdue alerts resolved.')) return;
    this.sifLoading.set(true);
    this.http.post<SifFile>(`${API}/wps/sif/${sif.id}/confirm`, {}).subscribe({
      next: (f) => { this.sifFile.set(f); this.sifLoading.set(false); this.loadAll(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Confirm failed.'); this.sifLoading.set(false); },
    });
  }

  downloadSif() {
    const content = this.sifContent();
    const sif = this.sifFile();
    if (!content || !sif) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = sif.fileName;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Violation ────────────────────────────────────────────────────────────────

  openViolation(r: WpsRecord) {
    this.violationRecord.set(r);
    this.violationRef.set('');
  }

  saveViolation() {
    const r = this.violationRecord();
    if (!r || !this.violationRef().trim()) return;
    this.addingViolation.set(true);
    this.http.post(`${API}/wps/${r.id}/violation`, { violationRef: this.violationRef() }).subscribe({
      next: () => { this.violationRecord.set(null); this.addingViolation.set(false); this.loadRecords(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Failed to record violation.'); this.addingViolation.set(false); },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  monthName(m: number): string { return this.MONTHS[m - 1] ?? String(m); }
  goPage2 = this.goPage;

  statusStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'CONFIRMED': return { bg: 'var(--success-bg)', color: 'var(--success)' };
      case 'SUBMITTED': return { bg: 'var(--info-bg)',    color: 'var(--info)'    };
      case 'PENDING':   return { bg: 'var(--neutral-100)',color: 'var(--fg-3)'    };
      case 'FAILED':    return { bg: 'var(--danger-bg)',  color: 'var(--danger)'  };
      case 'EXEMPT':    return { bg: 'var(--neutral-100)',color: 'var(--fg-2)'    };
      default:          return { bg: 'var(--neutral-100)',color: 'var(--fg-3)'    };
    }
  }

  sifStatusStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'CONFIRMED': return { bg: 'var(--success-bg)', color: 'var(--success)' };
      case 'SUBMITTED': return { bg: 'var(--info-bg)',    color: 'var(--info)'    };
      case 'READY':     return { bg: 'var(--warning-bg)', color: 'var(--warning)' };
      case 'REJECTED':  return { bg: 'var(--danger-bg)',  color: 'var(--danger)'  };
      default:          return { bg: 'var(--neutral-100)',color: 'var(--fg-3)'    };
    }
  }

  pages(): (number | '...')[] {
    const total = this.totalPages(); const cur = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const arr: (number | '...')[] = [1];
    if (cur > 3) arr.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) arr.push(i);
    if (cur < total - 2) arr.push('...');
    arr.push(total);
    return arr;
  }
}
