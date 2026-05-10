import { Component, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [],
  template: `
    <!-- Header -->
    <section class="section-pad" style="padding: 80px 40px 64px; background: var(--neutral-50); border-bottom: 1px solid var(--border-soft);">
      <div style="max-width: 700px; margin: 0 auto; text-align: center;">
        <p style="
          display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--cirvio-sage); background: var(--cirvio-mint-50);
          border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-pill);
          padding: 4px 14px; margin-bottom: 20px;
        ">Contact</p>
        <h1 class="section-title animate-fade-up-1" style="font-size: 44px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg-1); margin: 0 0 20px;">
          Get in touch
        </h1>
        <p class="animate-fade-up-2" style="font-size: 18px; color: var(--fg-2); line-height: 1.65; margin: 0;">
          Whether you have a question, want to book a demo, or need a custom enterprise quote — our team is here to help.
        </p>
      </div>
    </section>

    <!-- Main content -->
    <section class="section-pad" style="padding: 80px 40px;">
      <div style="max-width: 1100px; margin: 0 auto;">
        <div class="contact-grid" style="display: grid; grid-template-columns: 1fr 1.4fr; gap: 64px; align-items: start;">

          <!-- Left: contact info -->
          <div class="reveal">
            <h2 style="font-size: 22px; font-weight: 600; color: var(--fg-1); margin: 0 0 24px;">How we can help</h2>

            <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px;">
              <div style="display: flex; gap: 16px; align-items: flex-start;">
                <div style="
                  width: 40px; height: 40px; border-radius: var(--radius-sm);
                  background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
                  display: flex; align-items: center; justify-content: center;
                  color: var(--cirvio-sage); flex-shrink: 0;
                ">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                    <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.75"/>
                  </svg>
                </div>
                <div>
                  <p style="font-size: 14px; font-weight: 600; color: var(--fg-1); margin: 0 0 4px;">Dubai, UAE</p>
                  <p style="font-size: 14px; color: var(--fg-2); margin: 0; line-height: 1.6;">Serving teams across the Gulf Cooperation Council region</p>
                </div>
              </div>

              <div style="display: flex; gap: 16px; align-items: flex-start;">
                <div style="
                  width: 40px; height: 40px; border-radius: var(--radius-sm);
                  background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
                  display: flex; align-items: center; justify-content: center;
                  color: var(--cirvio-sage); flex-shrink: 0;
                ">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                  </svg>
                </div>
                <div>
                  <p style="font-size: 14px; font-weight: 600; color: var(--fg-1); margin: 0 0 4px;">hello&#64;cirvio.com</p>
                  <p style="font-size: 14px; color: var(--fg-2); margin: 0; line-height: 1.6;">We respond within one business day</p>
                </div>
              </div>

              <div style="display: flex; gap: 16px; align-items: flex-start;">
                <div style="
                  width: 40px; height: 40px; border-radius: var(--radius-sm);
                  background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
                  display: flex; align-items: center; justify-content: center;
                  color: var(--cirvio-sage); flex-shrink: 0;
                ">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7z" stroke="currentColor" stroke-width="1.75"/>
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.75"/>
                  </svg>
                </div>
                <div>
                  <p style="font-size: 14px; font-weight: 600; color: var(--fg-1); margin: 0 0 4px;">Book a demo</p>
                  <p style="font-size: 14px; color: var(--fg-2); margin: 0; line-height: 1.6;">30-minute product walk-through with a compliance specialist</p>
                </div>
              </div>
            </div>

            <div style="background: var(--cirvio-hunter); border-radius: var(--radius-lg); padding: 28px 24px;">
              <p style="font-size: 14px; font-weight: 600; color: var(--cirvio-mint); margin: 0 0 8px;">Enterprise enquiries</p>
              <p style="font-size: 14px; color: var(--cirvio-mint-300); line-height: 1.65; margin: 0;">
                Need an unlimited employee plan, SSO, or a custom integration? Our enterprise team can have a proposal ready within 48 hours.
              </p>
            </div>
          </div>

          <!-- Right: form -->
          <div class="reveal reveal-d2" style="
            background: var(--bg-elev-1); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 40px;
            box-shadow: var(--shadow-md);
          ">
            @if (submitted()) {
              <div style="text-align: center; padding: 40px 0;">
                <div style="
                  width: 56px; height: 56px; border-radius: 50%;
                  background: var(--success-bg); border: 1px solid var(--success);
                  display: flex; align-items: center; justify-content: center;
                  margin: 0 auto 20px; color: var(--success);
                ">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <h3 style="font-size: 20px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Message sent!</h3>
                <p style="font-size: 15px; color: var(--fg-2); margin: 0;">We&rsquo;ll be in touch within one business day.</p>
              </div>
            } @else {
              <h2 style="font-size: 20px; font-weight: 600; color: var(--fg-1); margin: 0 0 28px;">Send us a message</h2>

              @if (error()) {
                <div style="
                  background: var(--danger-bg); border: 1px solid var(--danger);
                  border-radius: var(--radius-sm); padding: 12px 16px;
                  margin-bottom: 20px; font-size: 14px; color: var(--danger);
                ">{{ error() }}</div>
              }

              <div style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: var(--fg-2); margin-bottom: 6px;">Full name</label>
                  <input
                    type="text"
                    class="field"
                    placeholder="Your name"
                    [value]="name()"
                    (input)="name.set($any($event.target).value)"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: var(--fg-2); margin-bottom: 6px;">Work email</label>
                  <input
                    type="email"
                    class="field"
                    placeholder="you@company.com"
                    [value]="email()"
                    (input)="email.set($any($event.target).value)"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: var(--fg-2); margin-bottom: 6px;">Company (optional)</label>
                  <input
                    type="text"
                    class="field"
                    placeholder="Company name"
                    [value]="company()"
                    (input)="company.set($any($event.target).value)"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 500; color: var(--fg-2); margin-bottom: 6px;">Message</label>
                  <textarea
                    class="field"
                    rows="5"
                    placeholder="Tell us how we can help..."
                    [value]="message()"
                    (input)="message.set($any($event.target).value)"
                    style="resize: vertical; min-height: 120px;"
                  ></textarea>
                </div>
                <button
                  class="btn-primary"
                  [disabled]="loading()"
                  (click)="submit()"
                  style="width: 100%; padding: 12px;"
                >
                  @if (loading()) {
                    Sending...
                  } @else {
                    Send message
                  }
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
})
export class ContactComponent {
  private http = inject(HttpClient);

  readonly name = signal('');
  readonly email = signal('');
  readonly company = signal('');
  readonly message = signal('');
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');

  submit(): void {
    if (!this.name().trim() || !this.email().trim() || !this.message().trim()) {
      this.error.set('Please fill in your name, email, and message.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.http
      .post('/api/contact', {
        name: this.name(),
        email: this.email(),
        company: this.company(),
        message: this.message(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.submitted.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Something went wrong. Please try again or email us directly.');
        },
      });
  }
}
