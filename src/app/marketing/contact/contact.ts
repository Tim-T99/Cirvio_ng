import { Component, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../core/seo.service';

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [],
  templateUrl: './contact.html',
})
export class ContactComponent {
  private http = inject(HttpClient);
  private seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: 'Contact Cirvio — Book a Demo',
      description: 'Get in touch with the Cirvio team for sales, pricing, support, or a live demo of our UAE workforce compliance platform.',
      path: '/contact',
    });
  }

  readonly subjects: string[] = [
    'General enquiry',
    'Sales & pricing',
    'Technical support',
    'Partnership',
    'Feedback',
    'Other',
  ];

  readonly form = signal<ContactForm>({
    firstName: '', lastName: '', email: '', company: '', phone: '', subject: '', message: '',
  });
  readonly status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly errorMsg = signal('');

  set<K extends keyof ContactForm>(field: K, value: string) {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  reset() {
    this.status.set('idle');
    this.form.set({ firstName: '', lastName: '', email: '', company: '', phone: '', subject: '', message: '' });
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    this.status.set('loading');
    this.errorMsg.set('');
    this.http.post(`${environment.apiUrl}/api/contact`, this.form()).subscribe({
      next: () => {
        this.status.set('success');
        this.form.set({ firstName: '', lastName: '', email: '', company: '', phone: '', subject: '', message: '' });
      },
      error: (err) => {
        this.status.set('error');
        this.errorMsg.set(err?.error?.error ?? 'Something went wrong. Please try again.');
      },
    });
  }
}
