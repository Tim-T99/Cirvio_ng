import {
  AfterViewInit, Component, computed, ElementRef,
  inject, NgZone, OnDestroy, signal, ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DatePipe } from '@angular/common';

// ── Data shapes ──────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
  description?: string;
  _count: { employees: number };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  employeeNo?: string;
  status: string;
  startDate?: string;
  workEmail?: string;
  phone?: string;
  nationality?: string;
  employmentType?: string;
  managerId?: string | null;
  department?: { id: string; name: string };
}

// ── Layout constants ─────────────────────────────────────────────────────────

const NODE_W      = 180;
const NODE_H      = 72;
const EMP_W       = 160;
const EMP_H       = 56;
const H_GAP       = 24;   // horizontal gap between sibling nodes
const CANVAS_PAD  = 60;

export interface OrgNode {
  id: string;
  kind: 'company' | 'department' | 'employee';
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  raw: Department | Employee | null;
  status?: string;
}

interface SvgLine {
  x1: number; y1: number;
  x2: number; y2: number;
}

@Component({
  selector: 'app-org-chart',
  standalone: true,
  templateUrl: './org-chart.html',
})
export class OrgChartComponent implements AfterViewInit, OnDestroy {
  private http  = inject(HttpClient);
  private zone  = inject(NgZone);

  @ViewChild('canvas') canvasEl!: ElementRef<HTMLDivElement>;

  departments   = signal<Department[]>([]);
  employees     = signal<Employee[]>([]);
  loading       = signal(true);
  error         = signal('');

  nodes         = signal<OrgNode[]>([]);
  lines         = signal<SvgLine[]>([]);
  canvasW       = signal(800);
  canvasH       = signal(600);

  selectedNode  = signal<OrgNode | null>(null);
  panX          = signal(0);
  panY          = signal(0);
  scale         = signal(1);

  private isPanning  = false;
  private lastPanX   = 0;
  private lastPanY   = 0;

  companyName   = signal('');
  companyStatus = signal('');

  // Derived employee detail
  readonly selectedEmployee = computed(() => {
    const n = this.selectedNode();
    if (n?.kind !== 'employee') return null;
    return n.raw as Employee;
  });

  readonly selectedDept = computed(() => {
    const n = this.selectedNode();
    if (n?.kind !== 'department') return null;
    return n.raw as Department;
  });

  readonly deptEmployees = computed(() => {
    const n = this.selectedNode();
    if (n?.kind !== 'department') return [];
    return this.employees().filter(e => e.department?.id === n.id);
  });

  // Reporting line of the selected employee
  readonly selectedManager = computed(() => {
    const e = this.selectedEmployee();
    if (!e?.managerId) return null;
    return this.employees().find(x => x.id === e.managerId) ?? null;
  });

  readonly directReports = computed(() => {
    const e = this.selectedEmployee();
    if (!e) return [];
    return this.employees().filter(x => x.managerId === e.id);
  });

  // Count of employees with no manager (unassigned to the reporting tree)
  readonly unassignedCount = computed(() => {
    const ids = new Set(this.employees().map(e => e.id));
    return this.employees().filter(e => !e.managerId || !ids.has(e.managerId)).length;
  });

  constructor() {
    // Fetch tenant name for company node
    this.http.get<{ name: string; status: string }>(`${environment.apiUrl}/api/tenant/profile`).subscribe({
      next: (p) => { this.companyName.set(p.name); this.companyStatus.set(p.status); },
    });

    Promise.all([
      this.http.get<Department[]>(`${environment.apiUrl}/api/employees/departments/list`).toPromise(),
      this.http.get<{ data: Employee[] }>(`${environment.apiUrl}/api/employees?pageSize=200`).toPromise(),
    ]).then(([depts, empRes]) => {
      this.departments.set(depts ?? []);
      this.employees.set(empRes?.data ?? []);
      this.loading.set(false);
      this.zone.runOutsideAngular(() => {
        requestAnimationFrame(() => this.zone.run(() => this.buildLayout()));
      });
    }).catch(() => {
      this.error.set('Failed to load org chart data.');
      this.loading.set(false);
    });
  }

  ngAfterViewInit() {}
  ngOnDestroy() {}

  // ── Layout engine ───────────────────────────────────────────────────────────

  buildLayout() {
    const emps  = this.employees();
    const nodes: OrgNode[] = [];
    const lines: SvgLine[] = [];

    // Build the reporting tree from managerId. Employees with no (in-set)
    // manager become roots directly under the company node.
    const byId = new Map(emps.map(e => [e.id, e]));
    const childrenOf = new Map<string, Employee[]>();
    const roots: Employee[] = [];
    for (const e of emps) {
      const mid = e.managerId && byId.has(e.managerId) ? e.managerId : null;
      if (mid) {
        const arr = childrenOf.get(mid) ?? [];
        arr.push(e);
        childrenOf.set(mid, arr);
      } else {
        roots.push(e);
      }
    }
    const byName = (a: Employee, b: Employee) =>
      (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName);
    roots.sort(byName);
    childrenOf.forEach(arr => arr.sort(byName));

    const LEVEL = EMP_H + 70; // vertical distance between tiers

    // Subtree width (memoised) — leaf is one node wide, parent spans its kids.
    const widthCache = new Map<string, number>();
    const subW = (e: Employee): number => {
      const cached = widthCache.get(e.id);
      if (cached !== undefined) return cached;
      const kids = childrenOf.get(e.id) ?? [];
      const w = kids.length === 0
        ? EMP_W
        : Math.max(EMP_W, kids.reduce((s, k) => s + subW(k), 0) + (kids.length - 1) * H_GAP);
      widthCache.set(e.id, w);
      return w;
    };

    const rootsW = roots.length
      ? roots.reduce((s, r) => s + subW(r), 0) + (roots.length - 1) * H_GAP
      : NODE_W;
    const canvasW = Math.max(800, Math.max(NODE_W, rootsW) + CANVAS_PAD * 2);

    // Company root node, centred at top.
    const compX = canvasW / 2 - NODE_W / 2;
    const compY = CANVAS_PAD;
    nodes.push({
      id: 'company', kind: 'company',
      label: this.companyName() || 'Company', sublabel: this.companyStatus(),
      x: compX, y: compY, w: NODE_W, h: NODE_H, raw: null,
    });

    // Centre/edge registry so we can draw elbow connectors afterwards.
    const centers = new Map<string, { cx: number; topY: number; botY: number }>();
    centers.set('company', { cx: compX + NODE_W / 2, topY: compY, botY: compY + NODE_H });

    const place = (e: Employee, leftX: number, depth: number): number => {
      const kids = childrenOf.get(e.id) ?? [];
      let cx: number;
      if (kids.length) {
        let cl = leftX;
        const childCenters: number[] = [];
        for (const k of kids) {
          childCenters.push(place(k, cl, depth + 1));
          cl += subW(k) + H_GAP;
        }
        cx = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      } else {
        cx = leftX + EMP_W / 2;
      }
      const y = compY + NODE_H + LEVEL + depth * LEVEL;
      nodes.push({
        id: e.id, kind: 'employee',
        label: `${e.firstName} ${e.lastName}`, sublabel: e.jobTitle || '—',
        x: cx - EMP_W / 2, y, w: EMP_W, h: EMP_H, raw: e, status: e.status,
      });
      centers.set(e.id, { cx, topY: y, botY: y + EMP_H });
      return cx;
    };

    let cl = (canvasW - rootsW) / 2;
    for (const r of roots) {
      place(r, cl, 0);
      cl += subW(r) + H_GAP;
    }

    // Elbow connectors: each node → its parent (manager, or company for roots).
    for (const e of emps) {
      const child = centers.get(e.id);
      if (!child) continue;
      const parentId = e.managerId && byId.has(e.managerId) ? e.managerId : 'company';
      const parent = centers.get(parentId);
      if (!parent) continue;
      const midY = (parent.botY + child.topY) / 2;
      lines.push({ x1: parent.cx, y1: parent.botY, x2: parent.cx, y2: midY });
      lines.push({ x1: parent.cx, y1: midY, x2: child.cx, y2: midY });
      lines.push({ x1: child.cx, y1: midY, x2: child.cx, y2: child.topY });
    }

    const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0) + CANVAS_PAD;

    this.nodes.set(nodes);
    this.lines.set(lines);
    this.canvasW.set(canvasW);
    this.canvasH.set(maxY);

    // Auto-centre in viewport
    setTimeout(() => {
      const el = this.canvasEl?.nativeElement;
      if (el) {
        el.scrollLeft = (canvasW - el.clientWidth) / 2;
      }
    });
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  selectNode(node: OrgNode) {
    this.selectedNode.set(this.selectedNode()?.id === node.id ? null : node);
  }

  selectById(id: string) {
    const node = this.nodes().find(n => n.id === id);
    if (node) this.selectedNode.set(node);
  }

  closePanel() { this.selectedNode.set(null); }

  zoom(delta: number) {
    this.scale.update(s => Math.min(2, Math.max(0.4, s + delta)));
  }

  resetZoom() { this.scale.set(1); this.panX.set(0); this.panY.set(0); }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    this.zoom(delta);
  }

  // Helpers
  initials(node: OrgNode): string {
    return node.label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  statusColor(status?: string): string {
    switch (status) {
      case 'ACTIVE':     return 'var(--success)';
      case 'INACTIVE':   return 'var(--fg-3)';
      case 'TERMINATED': return 'var(--danger)';
      default:           return 'var(--fg-3)';
    }
  }

  statusBg(status?: string): string {
    switch (status) {
      case 'ACTIVE':     return 'var(--success-bg)';
      case 'INACTIVE':   return 'var(--neutral-100)';
      case 'TERMINATED': return 'var(--danger-bg)';
      default:           return 'var(--neutral-100)';
    }
  }
}
