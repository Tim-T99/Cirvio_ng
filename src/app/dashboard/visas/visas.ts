import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api`;

interface VisaRecord {
  id: string; visaType: string; visaNumber?: string;
  expiryDate: string; issueDate?: string;
  status: string; emirate?: string;
  sponsorName?: string; sponsorId?: string;
  entryPermitNo?: string; entryPermitExpiry?: string;
  residenceVisaNo?: string; gracePeriodDays: number;
  medicalDoneAt?: string; biometricsDoneAt?: string;
  renewalInitiatedAt?: string; renewalCompletedAt?: string;
  notes?: string; createdAt: string;
  employee: { id: string; firstName: string; lastName: string; jobTitle?: string; department?: { name: string } };
}

interface VisaAlert {
  id: string; alertType: string; triggerDate: string;
  daysRemaining: number; status: string;
  visaRecord: { id: string; visaType: string; expiryDate: string };
  employee: { id: string; firstName: string; lastName: string };
}

interface VehicleDashboard {
  total: number; active: number; expiringSoon: number;
  expired: number; cancelled: number; renewalInProgress: number;
}

interface Employee { id: string; firstName: string; lastName: string; }

@Component({
  selector: 'app-visas',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './visas.html',
})
export class VisasComponent implements OnInit {
  private http = inject(HttpClient);

  records     = signal<VisaRecord[]>([]);
  alerts      = signal<VisaAlert[]>([]);
  dashboard   = signal<VehicleDashboard | null>(null);
  employees   = signal<Employee[]>([]);
  total       = signal(0);
  loading     = signal(true);
  error       = signal('');

  // Filters
  statusFilter  = signal('');
  typeFilter    = signal('');
  empFilter     = signal('');
  page          = signal(1);
  readonly pageSize = 20;
  totalPages    = computed(() => Math.ceil(this.total() / this.pageSize));

  // Create/edit panel
  showPanel    = signal(false);
  editingId    = signal<string | null>(null);
  form         = signal({
    employeeId: '', visaType: 'EMPLOYMENT', expiryDate: '',
    visaNumber: '', sponsorName: '', sponsorId: '',
    entryPermitNo: '', entryPermitExpiry: '',
    residenceVisaNo: '', issueDate: '',
    emirate: '', gracePeriodDays: 30, notes: '',
  });
  saving       = signal(false);
  saveError    = signal('');

  // Status update panel
  statusPanel  = signal<VisaRecord | null>(null);
  newStatus    = signal('');
  renewalDate  = signal('');
  statusReason = signal('');
  updatingStatus = signal(false);

  readonly VISA_TYPES = ['EMPLOYMENT','INVESTOR','DEPENDENT','FREELANCE','GOLDEN','TOURIST'];
  readonly VISA_STATUSES = ['ACTIVE','EXPIRING_SOON','EXPIRED','CANCELLED','RENEWAL_IN_PROGRESS'];
  readonly EMIRATES = [
    {value:'ABU_DHABI',label:'Abu Dhabi'},{value:'DUBAI',label:'Dubai'},
    {value:'SHARJAH',label:'Sharjah'},{value:'AJMAN',label:'Ajman'},
    {value:'UMM_AL_QUWAIN',label:'Umm Al Quwain'},{value:'RAS_AL_KHAIMAH',label:'Ras Al Khaimah'},
    {value:'FUJAIRAH',label:'Fujairah'},
  ];

  ngOnInit() {
    this.loadDashboard();
    this.loadAlerts();
    this.loadRecords();
    this.loadEmployees();
  }

  loadDashboard() {
    this.http.get<VehicleDashboard>(`${API}/visas/dashboard`).subscribe({
      next: (d) => this.dashboard.set(d),
    });
  }

  loadAlerts() {
    this.http.get<VisaAlert[]>(`${API}/visas/alerts`).subscribe({
      next: (a) => this.alerts.set(a),
    });
  }

  loadRecords() {
    this.loading.set(true);
    const params: Record<string, string> = { page: String(this.page()), pageSize: String(this.pageSize) };
    if (this.statusFilter()) params['status']     = this.statusFilter();
    if (this.typeFilter())   params['visaType']   = this.typeFilter();
    if (this.empFilter())    params['employeeId'] = this.empFilter();
    const qs = new URLSearchParams(params).toString();
    this.http.get<{ data: VisaRecord[]; total: number }>(`${API}/visas?${qs}`).subscribe({
      next: (r) => { this.records.set(r.data); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load visa records.'); this.loading.set(false); },
    });
  }

  loadEmployees() {
    this.http.get<{ data: Employee[] }>(`${API}/employees?pageSize=200`).subscribe({
      next: (r) => this.employees.set(r.data),
    });
  }

  applyFilter() { this.page.set(1); this.loadRecords(); }
  goPage(p: number) { this.page.set(p); this.loadRecords(); }

  openCreate() {
    this.editingId.set(null);
    this.form.set({ employeeId:'', visaType:'EMPLOYMENT', expiryDate:'', visaNumber:'', sponsorName:'', sponsorId:'', entryPermitNo:'', entryPermitExpiry:'', residenceVisaNo:'', issueDate:'', emirate:'', gracePeriodDays:30, notes:'' });
    this.saveError.set('');
    this.showPanel.set(true);
  }

  openEdit(record: VisaRecord) {
    this.editingId.set(record.id);
    this.form.set({
      employeeId: record.employee.id, visaType: record.visaType,
      expiryDate: record.expiryDate.substring(0,10), visaNumber: record.visaNumber ?? '',
      sponsorName: record.sponsorName ?? '', sponsorId: record.sponsorId ?? '',
      entryPermitNo: record.entryPermitNo ?? '',
      entryPermitExpiry: record.entryPermitExpiry ? record.entryPermitExpiry.substring(0,10) : '',
      residenceVisaNo: record.residenceVisaNo ?? '',
      issueDate: record.issueDate ? record.issueDate.substring(0,10) : '',
      emirate: record.emirate ?? '', gracePeriodDays: record.gracePeriodDays,
      notes: record.notes ?? '',
    });
    this.saveError.set('');
    this.showPanel.set(true);
  }

  setField(key: string, value: any) { this.form.update(f => ({ ...f, [key]: value })); }

  save() {
    const f = this.form();
    if (!f.employeeId) { this.saveError.set('Select an employee.'); return; }
    if (!f.expiryDate) { this.saveError.set('Expiry date is required.'); return; }
    this.saving.set(true); this.saveError.set('');
    const body: any = { ...f };
    ['visaNumber','sponsorName','sponsorId','entryPermitNo','entryPermitExpiry','residenceVisaNo','issueDate','emirate','notes'].forEach(k => { if (!body[k]) delete body[k]; });

    const id = this.editingId();
    const req = id
      ? this.http.patch(`${API}/visas/${id}`, body)
      : this.http.post(`${API}/visas`, body);
    req.subscribe({
      next: () => { this.showPanel.set(false); this.saving.set(false); this.loadRecords(); this.loadDashboard(); },
      error: (err) => { this.saveError.set(err.error?.error ?? 'Save failed.'); this.saving.set(false); },
    });
  }

  openStatusUpdate(record: VisaRecord) {
    this.statusPanel.set(record);
    this.newStatus.set(record.status);
    this.renewalDate.set('');
    this.statusReason.set('');
  }

  saveStatus() {
    const record = this.statusPanel();
    if (!record) return;
    this.updatingStatus.set(true);
    const body: any = { status: this.newStatus() };
    if (this.renewalDate()) body.renewalInitiatedAt = this.renewalDate();
    this.http.patch(`${API}/visas/${record.id}/status`, body).subscribe({
      next: () => { this.statusPanel.set(null); this.updatingStatus.set(false); this.loadRecords(); this.loadDashboard(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Status update failed.'); this.updatingStatus.set(false); },
    });
  }

  dismissAlert(alertId: string) {
    this.http.patch(`${API}/visas/alerts/${alertId}/dismiss`, {}).subscribe({
      next: () => this.alerts.update(a => a.filter(x => x.id !== alertId)),
    });
  }

  pages(): (number | '...')[] {
    const total = this.totalPages(); const cur = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const arr: (number | '...')[] = [1];
    if (cur > 3) arr.push('...');
    for (let i = Math.max(2, cur-1); i <= Math.min(total-1, cur+1); i++) arr.push(i);
    if (cur < total-2) arr.push('...');
    arr.push(total);
    return arr;
  }

  statusStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'ACTIVE':             return { bg:'var(--success-bg)',  color:'var(--success)'  };
      case 'EXPIRING_SOON':      return { bg:'var(--warning-bg)',  color:'var(--warning)'  };
      case 'RENEWAL_IN_PROGRESS':return { bg:'var(--info-bg)',     color:'var(--info)'     };
      case 'EXPIRED':case'CANCELLED': return { bg:'var(--danger-bg)', color:'var(--danger)' };
      default:                   return { bg:'var(--neutral-100)', color:'var(--fg-3)'     };
    }
  }

  alertLabel(t: string): string {
    return t.replace('_', ' ').replace('DAYS', 'days notice');
  }

  typeLabel(t: string): string { return t.replace(/_/g,' '); }

  emirateLabel(v: string): string {
    return this.EMIRATES.find(e => e.value === v)?.label ?? v;
  }

  daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  }
}
