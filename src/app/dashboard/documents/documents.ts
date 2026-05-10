import { Component, signal, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'active' | 'expiring' | 'expired';
  expiresAt?: string;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [],
  templateUrl: './documents.html',
})
export class DocumentsComponent implements OnInit {
  private http = inject(HttpClient);

  documents = signal<Document[]>([]);
  loading = signal(true);
  error = signal('');
  uploading = signal(false);
  search = signal('');

  ngOnInit() {
    this.loadDocuments();
  }

  loadDocuments() {
    this.loading.set(true);
    this.http.get<Document[]>(`${environment.apiUrl}/api/documents`).subscribe({
      next: (docs) => { this.documents.set(docs); this.loading.set(false); },
      error: () => { this.error.set('Failed to load documents.'); this.loading.set(false); },
    });
  }

  get filtered(): Document[] {
    const q = this.search().toLowerCase();
    if (!q) return this.documents();
    return this.documents().filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<Document>(`${environment.apiUrl}/api/documents/upload`, formData).subscribe({
      next: (doc) => {
        this.documents.update(docs => [doc, ...docs]);
        this.uploading.set(false);
        input.value = '';
      },
      error: () => { this.error.set('Upload failed. Please try again.'); this.uploading.set(false); },
    });
  }

  deleteDocument(id: string) {
    this.http.delete(`${environment.apiUrl}/api/documents/${id}`).subscribe({
      next: () => this.documents.update(docs => docs.filter(d => d.id !== id)),
      error: () => this.error.set('Delete failed. Please try again.'),
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusColor(status: string): string {
    if (status === 'expired') return 'var(--danger)';
    if (status === 'expiring') return 'var(--warning)';
    return 'var(--success)';
  }

  statusBg(status: string): string {
    if (status === 'expired') return 'var(--danger-bg)';
    if (status === 'expiring') return 'var(--warning-bg)';
    return 'var(--success-bg)';
  }
}
