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
  department?: { id: string; name: string };
}

// ── Layout constants ─────────────────────────────────────────────────────────

const NODE_W      = 180;
const NODE_H      = 72;
const DEPT_W      = 164;
const DEPT_H      = 60;
const EMP_W       = 160;
const EMP_H       = 56;
const H_GAP       = 24;   // horizontal gap between sibling nodes
const DEPT_TOP    = 140;  // y of department row
const EMP_TOP_OFF = 100;  // offset below department row to employee row
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
    const depts = this.departments();
    const emps  = this.employees();
    const nodes: OrgNode[]  = [];
    const lines: SvgLine[]  = [];

    // For each department, calculate how wide its employee row is
    const deptGroups = depts.map(d => {
      const members = emps.filter(e => e.department?.id === d.id);
      const rowW = members.length > 0
        ? members.length * EMP_W + (members.length - 1) * H_GAP
        : DEPT_W;
      return { dept: d, members, rowW };
    });

    // Total width needed for all department groups
    const totalW = deptGroups.reduce((sum, g) => sum + Math.max(g.rowW, DEPT_W), 0)
      + (deptGroups.length - 1) * H_GAP;

    const canvasW = Math.max(800, totalW + CANVAS_PAD * 2);

    // Company node centred at top
    const compX = canvasW / 2 - NODE_W / 2;
    const compY = CANVAS_PAD;
    nodes.push({
      id: 'company',
      kind: 'company',
      label: this.companyName() || 'Company',
      sublabel: this.companyStatus(),
      x: compX, y: compY, w: NODE_W, h: NODE_H,
      raw: null,
    });

    // Department nodes
    let cursor = CANVAS_PAD;
    for (const { dept, members, rowW } of deptGroups) {
      const groupW = Math.max(rowW, DEPT_W);
      const deptX  = cursor + groupW / 2 - DEPT_W / 2;
      const deptY  = DEPT_TOP;

      nodes.push({
        id: dept.id,
        kind: 'department',
        label: dept.name,
        sublabel: `${dept._count.employees} employee${dept._count.employees === 1 ? '' : 's'}`,
        x: deptX, y: deptY, w: DEPT_W, h: DEPT_H,
        raw: dept,
      });

      // Line: company → department (elbow)
      const compCenterX = compX + NODE_W / 2;
      const deptCenterX = deptX + DEPT_W / 2;
      const midY = (compY + NODE_H + deptY) / 2;
      lines.push({ x1: compCenterX, y1: compY + NODE_H, x2: compCenterX, y2: midY });
      lines.push({ x1: compCenterX, y1: midY, x2: deptCenterX, y2: midY });
      lines.push({ x1: deptCenterX, y1: midY, x2: deptCenterX, y2: deptY });

      // Employee nodes
      const empY = deptY + DEPT_H + EMP_TOP_OFF;
      const empRowStartX = cursor + groupW / 2 - rowW / 2;
      members.forEach((emp, i) => {
        const empX = empRowStartX + i * (EMP_W + H_GAP);
        nodes.push({
          id: emp.id,
          kind: 'employee',
          label: `${emp.firstName} ${emp.lastName}`,
          sublabel: emp.jobTitle || '—',
          x: empX, y: empY, w: EMP_W, h: EMP_H,
          raw: emp,
          status: emp.status,
        });
        // Line: department → employee
        const empCenterX = empX + EMP_W / 2;
        const deptBottom = deptY + DEPT_H;
        const empMidY = (deptBottom + empY) / 2;
        lines.push({ x1: deptCenterX, y1: deptBottom, x2: deptCenterX, y2: empMidY });
        lines.push({ x1: deptCenterX, y1: empMidY, x2: empCenterX, y2: empMidY });
        lines.push({ x1: empCenterX, y1: empMidY, x2: empCenterX, y2: empY });
      });

      cursor += groupW + H_GAP;
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
