import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Plan {
  id: string;
  name: string;
  maxEmployees: number;
  maxAdmins: number;
  priceAed: number;
  billingCycleMonths: number;
  stripePriceId: string | null;
  features: string[] | null;
  isActive: boolean;
}

interface FeatureDef { key: string; label: string; description: string; }

interface PlanForm {
  name: string;
  maxEmployees: number | string;
  maxAdmins: number | string;
  priceAed: number | string;
  billingCycleMonths: number | string;
  stripePriceId: string;
  features: string[];
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

  readonly featureCatalog = signal<FeatureDef[]>([]);

  readonly form = signal<PlanForm>({
    name: '',
    maxEmployees: '',
    maxAdmins: '',
    priceAed: '',
    billingCycleMonths: 1,
    stripePriceId: '',
    features: [],
    isActive: true,
  });

  ngOnInit(): void {
    this.fetchPlans();
    this.http.get<FeatureDef[]>(`${environment.apiUrl}/api/admin/features`).subscribe({
      next: (f) => this.featureCatalog.set(f ?? []),
      error: () => {},
    });
  }

  private allFeatureKeys(): string[] {
    return this.featureCatalog().map(f => f.key);
  }

  toggleFeature(key: string): void {
    this.form.update(f => ({
      ...f,
      features: f.features.includes(key) ? f.features.filter(k => k !== key) : [...f.features, key],
    }));
  }

  featureLabel(key: string): string {
    return this.featureCatalog().find(f => f.key === key)?.label ?? key;
  }

  fetchPlans(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<Plan[]>(`${environment.apiUrl}/api/admin/plans`).subscribe({
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
    // New plans default to including every feature; admin unchecks to restrict.
    this.form.set({ name: '', maxEmployees: '', maxAdmins: '', priceAed: '', billingCycleMonths: 1, stripePriceId: '', features: this.allFeatureKeys(), isActive: true });
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
      stripePriceId: plan.stripePriceId ?? '',
      // null = all features enabled (legacy plans); otherwise the stored set.
      features: plan.features ?? this.allFeatureKeys(),
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
      stripePriceId: f.stripePriceId.trim() || null,
      features: f.features,
      isActive: f.isActive,
    };
    const editing = this.editingPlan();
    const req = editing
      ? this.http.patch<Plan>(`${environment.apiUrl}/api/admin/plans/${editing.id}`, payload)
      : this.http.post<Plan>(`${environment.apiUrl}/api/admin/plans`, payload);

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
