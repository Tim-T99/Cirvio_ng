import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api`;

export interface Department {
  id: string;
  name: string;
  description?: string;
  _count: { employees: number };
}

export interface Employee {
  id: string;
  firstName: string; lastName: string; middleName?: string;
  jobTitle?: string; employeeNo?: string; status: string;
  employmentType: string; nationality?: string;
  workEmail?: string; phone?: string;
  startDate?: string; createdAt: string;
  department?: { id: string; name: string };
}

type EmployeeForm = {
  firstName: string; lastName: string; middleName: string;
  gender: string; dateOfBirth: string; nationality: string;
  workEmail: string; personalEmail: string; phone: string;
  jobTitle: string; departmentId: string; managerId: string; jobLevel: number | '';
  employmentType: string;
  startDate: string; employeeNo: string;
  eidNumber: string; eidExpiry: string;
  passportNumber: string; passportExpiry: string; labourCardNo: string;
  basicSalaryAed: number | ''; allowancesAed: number | '';
  wpsPersonId: string; wpsBankCode: string;
};

function emptyForm(): EmployeeForm {
  return {
    firstName: '', lastName: '', middleName: '', gender: '',
    dateOfBirth: '', nationality: '', workEmail: '', personalEmail: '',
    phone: '', jobTitle: '', departmentId: '', managerId: '', jobLevel: '',
    employmentType: 'FULL_TIME',
    startDate: '', employeeNo: '', eidNumber: '', eidExpiry: '',
    passportNumber: '', passportExpiry: '', labourCardNo: '',
    basicSalaryAed: '', allowancesAed: '', wpsPersonId: '', wpsBankCode: '',
  };
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './employees.html',
})
export class EmployeesComponent implements OnInit {
  private http   = inject(HttpClient);
  private router = inject(Router);

  // ── Data ────────────────────────────────────────────────────────────────────
  employees   = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  // Lightweight full roster for the manager picker (the main list is paginated)
  managerOptions = signal<{ id: string; firstName: string; lastName: string; jobTitle?: string }[]>([]);
  total       = signal(0);
  loading     = signal(true);
  error       = signal('');

  // ── Filters / pagination ─────────────────────────────────────────────────────
  search        = signal('');
  statusFilter  = signal('');
  deptFilter    = signal('');
  typeFilter    = signal('');
  page          = signal(1);
  readonly pageSize = 20;
  totalPages    = computed(() => Math.ceil(this.total() / this.pageSize));

  // ── Create / Edit panel ──────────────────────────────────────────────────────
  showPanel    = signal(false);
  editingId    = signal<string | null>(null);
  form         = signal<EmployeeForm>(emptyForm());
  formSection  = signal<'basic' | 'contact' | 'employment' | 'identity' | 'salary'>('basic');
  saving       = signal(false);
  saveError    = signal('');

  // ── Terminate modal ─────────────────────────────────────────────────────────
  terminatingId  = signal<string | null>(null);
  terminateDate  = signal('');
  terminateReason = signal('');
  terminating    = signal(false);

  // ── Status update ────────────────────────────────────────────────────────────
  statusMenuId   = signal<string | null>(null);

  // ── Departments panel ────────────────────────────────────────────────────────
  showDeptPanel  = signal(false);
  deptForm       = signal({ name: '', description: '' });
  deptEditId     = signal<string | null>(null);
  deptSaving     = signal(false);
  deptError      = signal('');

  // ── Enums ─────────────────────────────────────────────────────────────────────
  readonly EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'];
  readonly GENDERS          = ['MALE', 'FEMALE', 'UNSPECIFIED'];
  readonly STATUS_OPTS      = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'];

  ngOnInit() {
    this.loadDepartments();
    this.loadManagerOptions();
    this.loadEmployees();
  }

  // ── Loaders ──────────────────────────────────────────────────────────────────

  loadDepartments() {
    this.http.get<Department[]>(`${API}/employees/departments/list`).subscribe({
      next: (d) => this.departments.set(d),
    });
  }

  loadManagerOptions() {
    this.http.get<{ data: { id: string; firstName: string; lastName: string; jobTitle?: string }[] }>(
      `${API}/employees?pageSize=500`
    ).subscribe({
      next: (r) => this.managerOptions.set(r.data ?? []),
    });
  }

  // Candidate managers for the form: everyone except the employee being edited.
  managerChoices() {
    const id = this.editingId();
    return this.managerOptions().filter(e => e.id !== id);
  }

  loadEmployees() {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {
      page: String(this.page()),
      pageSize: String(this.pageSize),
    };
    if (this.search())       params['search']        = this.search();
    if (this.statusFilter()) params['status']        = this.statusFilter();
    if (this.deptFilter())   params['departmentId']  = this.deptFilter();
    if (this.typeFilter())   params['employmentType'] = this.typeFilter();

    const qs = new URLSearchParams(params).toString();
    this.http.get<{ data: Employee[]; total: number }>(`${API}/employees?${qs}`).subscribe({
      next: (r) => { this.employees.set(r.data); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load employees.'); this.loading.set(false); },
    });
  }

  applyFilter() { this.page.set(1); this.loadEmployees(); }
  clearFilters() { this.search.set(''); this.statusFilter.set(''); this.deptFilter.set(''); this.typeFilter.set(''); this.page.set(1); this.loadEmployees(); }
  goPage(p: number) { this.page.set(p); this.loadEmployees(); }

  // ── Create / Edit ─────────────────────────────────────────────────────────────

  openCreate() {
    this.editingId.set(null);
    this.form.set(emptyForm());
    this.formSection.set('basic');
    this.saveError.set('');
    this.showPanel.set(true);
  }

  openEdit(emp: Employee) {
    this.editingId.set(emp.id);
    // Load full record
    this.http.get<any>(`${API}/employees/${emp.id}`).subscribe({
      next: (e) => {
        this.form.set({
          firstName:      e.firstName ?? '',
          lastName:       e.lastName ?? '',
          middleName:     e.middleName ?? '',
          gender:         e.gender ?? '',
          dateOfBirth:    e.dateOfBirth ? e.dateOfBirth.substring(0, 10) : '',
          nationality:    e.nationality ?? '',
          workEmail:      e.workEmail ?? '',
          personalEmail:  e.personalEmail ?? '',
          phone:          e.phone ?? '',
          jobTitle:       e.jobTitle ?? '',
          departmentId:   e.department?.id ?? '',
          managerId:      e.managerId ?? '',
          jobLevel:       e.jobLevel ?? '',
          employmentType: e.employmentType ?? 'FULL_TIME',
          startDate:      e.startDate ? e.startDate.substring(0, 10) : '',
          employeeNo:     e.employeeNo ?? '',
          eidNumber:      e.eidNumber ?? '',
          eidExpiry:      e.eidExpiry ? e.eidExpiry.substring(0, 10) : '',
          passportNumber: e.passportNumber ?? '',
          passportExpiry: e.passportExpiry ? e.passportExpiry.substring(0, 10) : '',
          labourCardNo:   e.labourCardNo ?? '',
          basicSalaryAed: e.basicSalaryAed ?? '',
          allowancesAed:  e.allowancesAed ?? '',
          wpsPersonId:    e.wpsPersonId ?? '',
          wpsBankCode:    e.wpsBankCode ?? '',
        });
        this.formSection.set('basic');
        this.saveError.set('');
        this.showPanel.set(true);
      },
    });
  }

  setField<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save() {
    const f = this.form();
    if (!f.firstName || !f.lastName) { this.saveError.set('First and last name are required.'); return; }
    this.saving.set(true);
    this.saveError.set('');
    const body: Record<string, unknown> = { ...f };
    if (body['basicSalaryAed'] === '') delete body['basicSalaryAed'];
    if (body['allowancesAed']  === '') delete body['allowancesAed'];
    if (body['jobLevel']       === '') delete body['jobLevel'];
    if (!body['departmentId'])         delete body['departmentId'];
    // managerId is sent as-is: '' clears the manager on update (backend
    // normalises it to null), and is treated as "no manager" on create.
    // Remove empty strings for optional fields
    ['gender','dateOfBirth','nationality','workEmail','personalEmail','phone','middleName',
     'eidNumber','eidExpiry','passportNumber','passportExpiry','labourCardNo','wpsPersonId','wpsBankCode'
    ].forEach(k => { if (body[k] === '') delete body[k]; });

    const id = this.editingId();
    const req = id
      ? this.http.patch<Employee>(`${API}/employees/${id}`, body)
      : this.http.post<Employee>(`${API}/employees`, body);

    req.subscribe({
      next: () => { this.showPanel.set(false); this.loadEmployees(); this.saving.set(false); },
      error: (err) => { this.saveError.set(err.error?.error ?? 'Save failed.'); this.saving.set(false); },
    });
  }

  closePanel() { this.showPanel.set(false); }

  // ── Terminate ────────────────────────────────────────────────────────────────

  openTerminate(emp: Employee) {
    this.terminatingId.set(emp.id);
    this.terminateDate.set(new Date().toISOString().substring(0, 10));
    this.terminateReason.set('');
  }

  confirmTerminate() {
    const id = this.terminatingId();
    if (!id || !this.terminateDate()) return;
    this.terminating.set(true);
    this.http.post(`${API}/employees/${id}/terminate`, {
      endDate: this.terminateDate(),
      reason:  this.terminateReason() || undefined,
    }).subscribe({
      next: () => { this.terminatingId.set(null); this.terminating.set(false); this.loadEmployees(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Terminate failed.'); this.terminating.set(false); },
    });
  }

  // ── Status update ─────────────────────────────────────────────────────────────

  updateStatus(emp: Employee, status: string) {
    this.statusMenuId.set(null);
    if (emp.status === 'TERMINATED') return;
    this.http.patch(`${API}/employees/${emp.id}/status`, { status }).subscribe({
      next: () => this.loadEmployees(),
      error: (err) => this.error.set(err.error?.error ?? 'Status update failed.'),
    });
  }

  toggleStatusMenu(id: string, e: Event) {
    e.stopPropagation();
    this.statusMenuId.set(this.statusMenuId() === id ? null : id);
  }

  closeMenus() { this.statusMenuId.set(null); }

  viewDetail(emp: Employee) {
    this.router.navigate(['/dashboard/employees', emp.id]);
  }

  // ── Departments ──────────────────────────────────────────────────────────────

  openDeptCreate() {
    this.deptEditId.set(null);
    this.deptForm.set({ name: '', description: '' });
    this.deptError.set('');
    this.showDeptPanel.set(true);
  }

  openDeptEdit(dept: Department) {
    this.deptEditId.set(dept.id);
    this.deptForm.set({ name: dept.name, description: dept.description ?? '' });
    this.deptError.set('');
    this.showDeptPanel.set(true);
  }

  saveDept() {
    const f = this.deptForm();
    if (!f.name.trim()) { this.deptError.set('Name is required.'); return; }
    this.deptSaving.set(true);
    this.deptError.set('');
    const id = this.deptEditId();
    const req = id
      ? this.http.patch<Department>(`${API}/employees/departments/${id}`, f)
      : this.http.post<Department>(`${API}/employees/departments`, f);
    req.subscribe({
      next: () => { this.showDeptPanel.set(false); this.loadDepartments(); this.deptSaving.set(false); },
      error: (err) => { this.deptError.set(err.error?.error ?? 'Save failed.'); this.deptSaving.set(false); },
    });
  }

  deleteDept(dept: Department) {
    if (dept._count.employees > 0) { this.deptError.set(`Cannot delete "${dept.name}" — reassign its ${dept._count.employees} employee(s) first.`); this.showDeptPanel.set(true); return; }
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    this.http.delete(`${API}/employees/departments/${dept.id}`).subscribe({
      next: () => this.loadDepartments(),
      error: (err) => this.error.set(err.error?.error ?? 'Delete failed.'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  initials(emp: Employee): string {
    return ((emp.firstName[0] ?? '') + (emp.lastName[0] ?? '')).toUpperCase();
  }

  statusStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'ACTIVE':     return { bg: 'var(--success-bg)',  color: 'var(--success)'  };
      case 'ON_LEAVE':   return { bg: 'var(--warning-bg)',  color: 'var(--warning)'  };
      case 'SUSPENDED':  return { bg: 'var(--info-bg)',     color: 'var(--info)'     };
      case 'TERMINATED': return { bg: 'var(--danger-bg)',   color: 'var(--danger)'   };
      default:           return { bg: 'var(--neutral-100)', color: 'var(--fg-3)'     };
    }
  }

  typeLabel(t: string): string {
    return t.replace('_', ' ');
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
