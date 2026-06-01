import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api`;

interface Document {
  id: string;
  fileName: string;
  documentType: string;
  fileSizeKb: number;
  mimeType: string;
  expiryDate?: string;
  notes?: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string };
}

interface Employee { id: string; firstName: string; lastName: string; }

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './documents.html',
})
export class DocumentsComponent implements OnInit {
  private http = inject(HttpClient);

  documents  = signal<Document[]>([]);
  employees  = signal<Employee[]>([]);
  total      = signal(0);
  loading    = signal(true);
  error      = signal('');
  uploading  = signal(false);

  search     = signal('');
  typeFilter = signal('');
  empFilter  = signal('');
  page       = signal(1);
  readonly pageSize = 20;
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize));

  editingDoc = signal<Document | null>(null);
  editType   = signal('');
  editExpiry = signal('');
  editNotes  = signal('');
  editSaving = signal(false);

  readonly DOC_TYPES = [
    'VISA_COPY','ENTRY_PERMIT','PASSPORT_COPY','EMIRATES_ID',
    'LABOUR_CARD','OFFER_LETTER','CONTRACT','MEDICAL_CERTIFICATE','OTHER',
  ];

  ngOnInit() {
    this.http.get<{ data: Employee[] }>(`${API}/employees?pageSize=200`).subscribe({
      next: (r) => this.employees.set(r.data),
    });
    this.loadDocuments();
  }

  loadDocuments() {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = { page: String(this.page()), pageSize: String(this.pageSize) };
    if (this.typeFilter()) params['documentType'] = this.typeFilter();
    if (this.empFilter())  params['employeeId']   = this.empFilter();
    const qs = new URLSearchParams(params).toString();
    this.http.get<{ data: Document[]; total: number }>(`${API}/documents?${qs}`).subscribe({
      next: (r) => {
        let docs = r.data ?? [];
        const q  = this.search().toLowerCase();
        if (q) docs = docs.filter(d => d.fileName.toLowerCase().includes(q));
        this.documents.set(docs);
        this.total.set(r.total);
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load documents.'); this.loading.set(false); },
    });
  }

  applyFilter() { this.page.set(1); this.loadDocuments(); }
  goPage(p: number) { this.page.set(p); this.loadDocuments(); }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const ALLOWED = ['application/pdf','image/jpeg','image/png','image/webp'];
    if (!ALLOWED.includes(file.type)) {
      this.error.set('Only PDF, JPG, PNG, or WEBP files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('File must be under 10 MB.');
      return;
    }

    this.uploading.set(true);
    this.error.set('');
    const body: Record<string, unknown> = {
      fileName:   file.name,
      mimeType:   file.type,
      fileSizeKb: Math.ceil(file.size / 1024),
    };
    if (this.empFilter()) body['employeeId'] = this.empFilter();

    this.http.post<{ uploadUrl: string; bucketKey: string }>(`${API}/documents/upload-url`, body).subscribe({
      next: ({ uploadUrl, bucketKey }) => {
        fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          .then(res => {
            if (!res.ok) throw new Error();
            const meta: Record<string, unknown> = {
              fileName: file.name, fileUrl: bucketKey,
              fileSizeKb: Math.ceil(file.size / 1024),
              mimeType: file.type, documentType: 'OTHER',
            };
            if (this.empFilter()) meta['employeeId'] = this.empFilter();
            return this.http.post(`${API}/documents`, meta).toPromise();
          })
          .then(() => { this.uploading.set(false); this.loadDocuments(); input.value = ''; })
          .catch(() => { this.error.set('Upload failed.'); this.uploading.set(false); });
      },
      error: (err) => { this.error.set(err.error?.error ?? 'Failed to get upload URL.'); this.uploading.set(false); },
    });
  }

  download(doc: Document) {
    this.http.get<{ downloadUrl: string }>(`${API}/documents/${doc.id}/download-url`).subscribe({
      next: ({ downloadUrl }) => window.open(downloadUrl, '_blank'),
      error: () => this.error.set('Failed to get download link.'),
    });
  }

  openEdit(doc: Document) {
    this.editingDoc.set(doc);
    this.editType.set(doc.documentType);
    this.editExpiry.set(doc.expiryDate ? doc.expiryDate.substring(0, 10) : '');
    this.editNotes.set(doc.notes ?? '');
  }

  saveEdit() {
    const doc = this.editingDoc();
    if (!doc) return;
    this.editSaving.set(true);
    const body: Record<string, unknown> = { documentType: this.editType() };
    if (this.editExpiry()) body['expiryDate'] = this.editExpiry();
    if (this.editNotes())  body['notes']      = this.editNotes();
    this.http.patch(`${API}/documents/${doc.id}`, body).subscribe({
      next: () => { this.editingDoc.set(null); this.editSaving.set(false); this.loadDocuments(); },
      error: (err) => { this.error.set(err.error?.error ?? 'Update failed.'); this.editSaving.set(false); },
    });
  }

  deleteDoc(doc: Document) {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    this.http.delete(`${API}/documents/${doc.id}`).subscribe({
      next: () => this.loadDocuments(),
      error: (err) => this.error.set(err.error?.error ?? 'Delete failed.'),
    });
  }

  typeLabel(t: string): string { return t.replace(/_/g, ' '); }
  formatSize(kb: number): string { return kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`; }

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
}
