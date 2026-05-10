import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Plan {
  id: string;
  name: string;
  maxEmployees: number;
  maxAdmins: number;
  priceAed: number;
  billingCycleMonths: number;
  isActive: boolean;
}

interface PlanForm {
  name: string;
  maxEmployees: number | string;
  maxAdmins: number | string;
  priceAed: number | string;
  billingCycleMonths: number | string;
  isActive: boolean;
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [],
  templateUrl: './plans.html',
})
export class PlansComponent implements OnInit {
  private http = inject(HttpClient);

  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  readonly showModal = signal(false);
  readonly editingPlan = signal<Plan | null>(null);

  readonly form = signal<PlanForm>({
    name: '',
    maxEmployees: '',
    maxAdmins: '',
    priceAed: '',
    billingCycleMonths: 1,
    isActive: true,
  });

  ngOnInit(): void {
    this.fetchPlans();
  }

  fetchPlans(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Plan[]>('/api/admin/plans').subscribe({
      next: (data) => {
        this.plans.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load plans.');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingPlan.set(null);
    this.form.set({ name: '', maxEmployees: '', maxAdmins: '', priceAed: '', billingCycleMonths: 1, isActive: true });
    this.saveError.set('');
    this.showModal.set(true);
  }

  openEdit(plan: Plan): void {
    this.editingPlan.set(plan);
    this.form.set({
      name: plan.name,
      maxEmployees: plan.maxEmployees,
      maxAdmins: plan.maxAdmins,
      priceAed: plan.priceAed,
      billingCycleMonths: plan.billingCycleMonths,
      isActive: plan.isActive,
    });
    this.saveError.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingPlan.set(null);
  }

  setField<K extends keyof PlanForm>(key: K, value: PlanForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.saveError.set('Plan name is required.');
      return;
    }
    this.saveError.set('');
    this.saving.set(true);
    const payload = {
      name: f.name.trim(),
      maxEmployees: Number(f.maxEmployees),
      maxAdmins: Number(f.maxAdmins),
      priceAed: Number(f.priceAed),
      billingCycleMonths: Number(f.billingCycleMonths),
      isActive: f.isActive,
    };
    const editing = this.editingPlan();
    const req = editing
      ? this.http.patch<Plan>(`/api/admin/plans/${editing.id}`, payload)
      : this.http.post<Plan>('/api/admin/plans', payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.fetchPlans();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Failed to save plan. Please try again.');
      },
    });
  }
}
