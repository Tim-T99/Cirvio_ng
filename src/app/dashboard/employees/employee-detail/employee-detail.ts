import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';

const API = `${environment.apiUrl}/api`;

interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
  email?: string;
}

interface EmployeeFull {
  id: string;
  firstName: string; lastName: string; middleName?: string;
  dateOfBirth?: string; gender?: string; nationality?: string;
  workEmail?: string; personalEmail?: string; phone?: string;
  photoUrl?: string | null;
  jobTitle?: string; employeeNo?: string;
  employmentType: string; status: string;
  startDate?: string; endDate?: string;
  eidNumber?: string; eidExpiry?: string;
  passportNumber?: string; passportExpiry?: string; labourCardNo?: string;
  basicSalaryAed?: number; allowancesAed?: number;
  emergencyContact?: EmergencyContact | null;
  wpsPersonId?: string; wpsBankCode?: string;
  managerId?: string | null; jobLevel?: number | null;
  createdAt: string; updatedAt: string;
  department?: { id: string; name: string };
  manager?: { id: string; firstName: string; lastName: string; jobTitle?: string } | null;
  reports?: { id: string; firstName: string; lastName: string; jobTitle?: string; status: string }[];
  user?: { id: string; email: string; role: string; isActive: boolean } | null;
  _count: { visaRecords: number; documents: number; wpsRecords: number; reports: number };
}

interface CurrentUserProfile {
  id: string;
  email: string;
  role: string;
  employeeId?: string | null;
  employee?: { id: string } | null;
}

interface VisaRecord {
  id: string; visaType: string; visaNumber?: string;
  expiryDate: string; status: string; emirate?: string;
  issueDate?: string; sponsorName?: string; entryPermitNo?: string; notes?: string;
  renewalInitiatedAt?: string; renewalCompletedAt?: string;
}

interface WpsRecord {
  id: string; month: number; year: number;
  netSalary: number; basicSalary: number; status: string;
  paymentDate?: string; isLate: boolean; lateByDays: number;
}

interface Document {
  id: string; fileName: string; documentType: string;
  fileSizeKb: number; mimeType: string; expiryDate?: string;
  createdAt: string; notes?: string;
}

interface Department { id: string; name: string; }

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './employee-detail.html',
})
export class EmployeeDetailComponent implements OnInit {
  private http   = inject(HttpClient);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  employee  = signal<EmployeeFull | null>(null);
  visas     = signal<VisaRecord[]>([]);
  wpsRecords = signal<WpsRecord[]>([]);
  documents = signal<Document[]>([]);
  departments = signal<Department[]>([]);
  currentUserRole = signal<string | null>(null);

  loading   = signal(true);
  error     = signal('');
  activeTab = signal<'overview' | 'visas' | 'wps' | 'docs'>('overview');
  readonly isViewer = computed(() => this.currentUserRole() === 'VIEWER');

  // Edit state
  editing   = signal(false);
  editForm  = signal<Record<string, any>>({});
  saving    = signal(false);
  saveError = signal('');
  depts     = signal<Department[]>([]);

  // Add visa panel
  showVisaPanel  = signal(false);
  visaForm       = signal({ visaType: 'EMPLOYMENT', expiryDate: '', visaNumber: '', sponsorName: '', entryPermitNo: '', issueDate: '', emirate: '', notes: '' });
  visaSaving     = signal(false);
  visaError      = signal('');
  editingVisaId  = signal<string | null>(null);

  // Upload document
  uploading   = signal(false);
  uploadError = signal('');

  // Status update
  updatingStatus = signal(false);

  // Terminate
  showTerminate   = signal(false);
  terminateDate   = signal('');
  terminateReason = signal('');
  terminating     = signal(false);

  readonly VISA_TYPES   = ['EMPLOYMENT','INVESTOR','DEPENDENT','FREELANCE','GOLDEN','TOURIST'];
  readonly VISA_STATUS  = ['ACTIVE','EXPIRING_SOON','EXPIRED','CANCELLED','RENEWAL_IN_PROGRESS'];
  readonly EMIRATES     = ['ABU_DHABI','DUBAI','SHARJAH','AJMAN','UMM_AL_QUWAIN','RAS_AL_KHAIMAH','FUJAIRAH'];
  readonly EMP_TYPES    = ['FULL_TIME','PART_TIME','CONTRACT','FREELANCE'];

  readonly MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  managerOptions = signal<{ id: string; firstName: string; lastName: string; jobTitle?: string }[]>([]);

  ngOnInit() {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'visas' || requestedTab === 'wps' || requestedTab === 'docs') {
      this.activeTab.set(requestedTab);
    }
    this.http.get<CurrentUserProfile>(`${API}/users/me`).subscribe({
      next: (u) => {
        this.currentUserRole.set(u.role ?? null);
        const routeId = this.route.snapshot.paramMap.get('id');
        const targetId = routeId === 'me' ? (u.employeeId ?? u.employee?.id ?? null) : routeId;
        if (!targetId) {
          this.error.set('Your account is not linked to an employee profile.');
          this.loading.set(false);
          return;
        }
        this.loadEmployee(targetId);
      },
      error: () => {
        this.currentUserRole.set(null);
        const routeId = this.route.snapshot.paramMap.get('id');
        if (routeId) this.loadEmployee(routeId);
        else this.loading.set(false);
      },
    });

    this.http.get<Department[]>(`${API}/employees/departments/list`).subscribe({ next: d => this.depts.set(d) });
    this.http.get<{ data: { id: string; firstName: string; lastName: string; jobTitle?: string }[] }>(
      `${API}/employees?pageSize=500`
    ).subscribe({ next: r => this.managerOptions.set(r.data ?? []) });
  }

  // Candidate managers: everyone except this employee (avoids self-reporting).
  managerChoices() {
    const id = this.employee()?.id;
    return this.managerOptions().filter(e => e.id !== id);
  }

  loadEmployee(id: string) {
    this.loading.set(true);
    this.http.get<EmployeeFull>(`${API}/employees/${id}/records`).subscribe({
      next: (e: any) => {
        this.employee.set(e);
        this.visas.set(e.visaRecords ?? []);
        this.wpsRecords.set(e.wpsRecords ?? []);
        this.documents.set(e.documents ?? []);
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load employee.'); this.loading.set(false); },
    });
  }

  startEdit() {
    const e = this.employee()!;
    const base = {
      firstName: e.firstName, lastName: e.lastName, middleName: e.middleName ?? '',
      gender: e.gender ?? '', dateOfBirth: e.dateOfBirth?.substring(0,10) ?? '',
      nationality: e.nationality ?? '', workEmail: e.workEmail ?? '',
      personalEmail: e.personalEmail ?? '', phone: e.phone ?? '',
      jobTitle: e.jobTitle ?? '', departmentId: e.department?.id ?? '',
      managerId: e.managerId ?? '', jobLevel: e.jobLevel ?? '',
      employmentType: e.employmentType, startDate: e.startDate?.substring(0,10) ?? '',
      employeeNo: e.employeeNo ?? '',
      eidNumber: e.eidNumber ?? '', eidExpiry: e.eidExpiry?.substring(0,10) ?? '',
      passportNumber: e.passportNumber ?? '', passportExpiry: e.passportExpiry?.substring(0,10) ?? '',
      labourCardNo: e.labourCardNo ?? '',
      basicSalaryAed: e.basicSalaryAed ?? '', allowancesAed: e.allowancesAed ?? '',
      wpsPersonId: e.wpsPersonId ?? '', wpsBankCode: e.wpsBankCode ?? '',
    };

    if (this.isViewer()) {
      this.editForm.set({
        firstName: base.firstName,
        lastName: base.lastName,
        middleName: base.middleName,
        phone: base.phone,
        workEmail: base.workEmail,
        personalEmail: base.personalEmail,
        jobTitle: base.jobTitle,
      });
    } else {
      this.editForm.set(base);
    }

    this.saveError.set('');
    this.editing.set(true);
  }

  setEdit(key: string, value: any) { this.editForm.update(f => ({ ...f, [key]: value })); }

  saveEdit() {
    const id = this.employee()!.id;
    const body = { ...this.editForm() };

    if (this.isViewer()) {
      for (const key of Object.keys(body)) {
        if (!['firstName', 'lastName', 'middleName', 'phone', 'workEmail', 'personalEmail', 'jobTitle'].includes(key)) {
          delete body[key];
        }
      }
    }

    if (!body['departmentId']) delete body['departmentId'];
    ['basicSalaryAed','allowancesAed','jobLevel'].forEach(k => { if (body[k] === '') delete body[k]; });
    // managerId sent as-is ('' clears the manager; backend normalises to null)
    ['gender','dateOfBirth','nationality','workEmail','personalEmail','phone','middleName',
     'eidNumber','eidExpiry','passportNumber','passportExpiry','labourCardNo','wpsPersonId','wpsBankCode',
    ].forEach(k => { if (body[k] === '') delete body[k]; });

    this.saving.set(true);
    this.http.patch<EmployeeFull>(`${API}/employees/${id}`, body).subscribe({
      next: () => { this.editing.set(false); this.loadEmployee(id); this.saving.set(false); },
      error: (err) => { this.saveError.set(err.error?.error ?? 'Save failed.'); this.saving.set(false); },
    });
  }

  openTerminate() {
    this.terminateDate.set(new Date().toISOString().substring(0, 10));
    this.terminateReason.set('');
    this.showTerminate.set(true);
  }

  confirmTerminate() {
    const id = this.employee()!.id;
    this.terminating.set(true);
    this.http.post(`${API}/employees/${id}/terminate`, {
      endDate: this.terminateDate(),
      reason: this.terminateReason() || undefined,
    }).subscribe({
      next: () => { this.showTerminate.set(false); this.terminating.set(false); this.loadEmployee(id); },
      error: (err) => { this.error.set(err.error?.error ?? 'Terminate failed.'); this.terminating.set(false); },
    });
  }

  // ── Visas ─────────────────────────────────────────────────────────────────────

  openAddVisa(visa?: VisaRecord) {
    if (visa) {
      this.editingVisaId.set(visa.id);
      this.visaForm.set({
        visaType: visa.visaType, expiryDate: visa.expiryDate.substring(0,10),
        visaNumber: visa.visaNumber ?? '', sponsorName: visa.sponsorName ?? '',
        entryPermitNo: visa.entryPermitNo ?? '',
        issueDate: visa.issueDate ? visa.issueDate.substring(0,10) : '',
        emirate: visa.emirate ?? '', notes: visa.notes ?? '',
      } as any);
    } else {
      this.editingVisaId.set(null);
      this.visaForm.set({ visaType: 'EMPLOYMENT', expiryDate: '', visaNumber: '', sponsorName: '', entryPermitNo: '', issueDate: '', emirate: '', notes: '' });
    }
    this.visaError.set('');
    this.showVisaPanel.set(true);
  }

  saveVisa() {
    const f = this.visaForm();
    if (!f.expiryDate) { this.visaError.set('Expiry date is required.'); return; }
    this.visaSaving.set(true);
    this.visaError.set('');
    const body: any = { ...f, employeeId: this.employee()!.id };
    ['visaNumber','sponsorName','entryPermitNo','issueDate','emirate','notes'].forEach(k => { if (!body[k]) delete body[k]; });

    const id = this.editingVisaId();
    const req = id
      ? this.http.patch(`${API}/visas/${id}`, body)
      : this.http.post(`${API}/visas`, body);

    req.subscribe({
      next: () => {
        this.showVisaPanel.set(false);
        this.visaSaving.set(false);
        this.loadEmployee(this.employee()!.id);
      },
      error: (err) => { this.visaError.set(err.error?.error ?? 'Save failed.'); this.visaSaving.set(false); },
    });
  }

  updateVisaStatus(visaId: string, status: string) {
    this.http.patch(`${API}/visas/${visaId}/status`, { status }).subscribe({
      next: () => this.loadEmployee(this.employee()!.id),
      error: (err) => this.error.set(err.error?.error ?? 'Status update failed.'),
    });
  }

  // ── Documents ─────────────────────────────────────────────────────────────────

  onDocUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.uploadError.set('');

    // 1. Get presigned upload URL
    this.http.post<{ uploadUrl: string; bucketKey: string }>(`${API}/documents/upload-url`, {
      fileName: file.name,
      mimeType: file.type,
      fileSizeKb: Math.ceil(file.size / 1024),
      employeeId: this.employee()!.id,
    }).subscribe({
      next: ({ uploadUrl, bucketKey }) => {
        // 2. PUT file directly to storage
        fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          .then(res => {
            if (!res.ok) throw new Error('Upload failed');
            // 3. Register document metadata
            return this.http.post(`${API}/documents`, {
              employeeId: this.employee()!.id,
              fileName: file.name,
              fileUrl: bucketKey,
              fileSizeKb: Math.ceil(file.size / 1024),
              mimeType: file.type,
              documentType: 'OTHER',
            }).toPromise();
          })
          .then(() => {
            this.uploading.set(false);
            this.loadEmployee(this.employee()!.id);
            input.value = '';
          })
          .catch(() => { this.uploadError.set('Upload failed.'); this.uploading.set(false); });
      },
      error: () => { this.uploadError.set('Failed to get upload URL.'); this.uploading.set(false); },
    });
  }

  downloadDoc(doc: Document) {
    this.http.get<{ downloadUrl: string }>(`${API}/documents/${doc.id}/download-url`).subscribe({
      next: ({ downloadUrl }) => window.open(downloadUrl, '_blank'),
      error: () => this.uploadError.set('Download failed.'),
    });
  }

  deleteDoc(doc: Document) {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    this.http.delete(`${API}/documents/${doc.id}`).subscribe({
      next: () => this.loadEmployee(this.employee()!.id),
      error: (err) => this.uploadError.set(err.error?.error ?? 'Delete failed.'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  back() {
    const role = this.currentUserRole();
    this.router.navigate([role === 'VIEWER' ? '/dashboard' : '/dashboard/employees']);
  }

  statusStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'ACTIVE':case'CONFIRMED': return { bg:'var(--success-bg)',color:'var(--success)' };
      case 'ON_LEAVE':case'RENEWAL_IN_PROGRESS': return { bg:'var(--warning-bg)',color:'var(--warning)' };
      case 'SUSPENDED':case'EXPIRING_SOON':case'PENDING': return { bg:'var(--info-bg)',color:'var(--info)' };
      case 'TERMINATED':case'EXPIRED':case'CANCELLED':case'FAILED': return { bg:'var(--danger-bg)',color:'var(--danger)' };
      default: return { bg:'var(--neutral-100)',color:'var(--fg-3)' };
    }
  }

  fileSizeLabel(kb: number): string {
    return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`;
  }

  initials(emp: EmployeeFull | null): string {
    if (!emp) return '';
    const a = emp.firstName?.trim()[0] ?? '';
    const b = emp.lastName?.trim()[0] ?? '';
    return `${a}${b}`.toUpperCase();
  }

  teamReports(): { id: string; firstName: string; lastName: string; jobTitle?: string; status: string }[] {
    return this.employee()?.reports ?? [];
  }

  formatCurrency(value?: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `AED ${value.toLocaleString()}`;
  }

  tenureLabel(startDate?: string): string {
    if (!startDate) return '—';
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return '—';
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    const totalMonths = (years * 12) + months;
    if (totalMonths <= 0) return 'New hire';
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    if (y && m) return `${y}y ${m}m`;
    if (y) return `${y}y`;
    return `${m}m`;
  }

  typeLabel(t: string): string { return t.replace(/_/g, ' '); }

  monthName(m: number): string { return this.MONTHS[m - 1] ?? String(m); }
}
