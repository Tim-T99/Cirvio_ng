import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AdminForm {
  email: string;
  name: string;
  password: string;
  role: string;
}

@Component({
  selector: 'app-admins',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admins.html',
})
export class AdminsComponent implements OnInit {
  private http = inject(HttpClient);

  readonly admins = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly showModal = signal(false);

  readonly form = signal<AdminForm>({
    email: '',
    name: '',
    password: '',
    role: 'admin',
  });

  ngOnInit(): void {
    this.fetchAdmins();
  }

  fetchAdmins(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<AdminUser[]>(`${environment.apiUrl}/api/admin/admins`).subscribe({
      next: (data) => {
        this.admins.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load admins.');
        this.loading.set(false);
      },
    });
  }

  openModal(): void {
    this.form.set({ email: '', name: '', password: '', role: 'admin' });
    this.saveError.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  setField<K extends keyof AdminForm>(key: K, value: AdminForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.email.trim() || !f.name.trim() || !f.password.trim()) {
      this.saveError.set('Email, name, and password are required.');
      return;
    }
    this.saveError.set('');
    this.saving.set(true);
    this.http.post<AdminUser>(`${environment.apiUrl}/api/admin/admins`, f).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.fetchAdmins();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Failed to create admin. The email may already be in use.');
      },
    });
  }

  toggleActive(admin: AdminUser): void {
    const newStatus = !admin.isActive;
    this.http.patch(`${environment.apiUrl}/api/admin/admins/${admin.id}/status`, { isActive: newStatus }).subscribe({
      next: () => this.fetchAdmins(),
      error: () => this.error.set(`Failed to update status for ${admin.name}.`),
    });
  }

  roleStyle(role: string): { background: string; color: string } {
    switch (role?.toLowerCase()) {
      case 'superadmin': return { background: 'rgba(140,201,181,0.15)', color: 'var(--cirvio-hunter)' };
      case 'admin':      return { background: 'var(--info-bg)', color: 'var(--info)' };
      default:           return { background: 'var(--neutral-100)', color: 'var(--fg-2)' };
    }
  }
}
