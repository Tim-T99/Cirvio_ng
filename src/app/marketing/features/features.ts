import { Component } from '@angular/core';

@Component({
  selector: 'app-features',
  standalone: true,
  template: `
    <!-- Hero -->
    <section class="section-pad" style="padding: 80px 40px 64px; background: var(--neutral-50); border-bottom: 1px solid var(--border-soft);">
      <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
        <p style="
          display: inline-block;
          font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--cirvio-sage); background: var(--cirvio-mint-50);
          border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-pill);
          padding: 4px 14px; margin-bottom: 20px;
        ">Platform Features</p>
        <h1 class="section-title animate-fade-up-1" style="font-size: 44px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg-1); margin: 0 0 20px;">
          Built for Gulf HR compliance
        </h1>
        <p class="animate-fade-up-2" style="font-size: 18px; color: var(--fg-2); max-width: 560px; margin: 0 auto; line-height: 1.65;">
          Every feature in Cirvio is designed around the specific regulatory requirements of UAE, Saudi Arabia, Qatar, and the broader GCC region.
        </p>
      </div>
    </section>

    <!-- Employee Records -->
    <section class="section-pad" style="padding: 80px 40px;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;">
          <div class="reveal">
            <div style="
              width: 48px; height: 48px; border-radius: var(--radius-sm);
              background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
              display: flex; align-items: center; justify-content: center;
              color: var(--cirvio-sage); margin-bottom: 20px;
            ">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </div>
            <h2 style="font-size: 28px; font-weight: 700; color: var(--fg-1); margin: 0 0 16px; letter-spacing: -0.01em;">Employee Records</h2>
            <p style="font-size: 16px; color: var(--fg-2); line-height: 1.7; margin: 0 0 20px;">
              Centralise all employee data in a single, secure repository. Store contracts, offer letters, passport copies, Emirates IDs, and certifications with version history and audit trails.
            </p>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Role-based access control
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Document version history
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                CSV bulk import &amp; export
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Full audit log for inspections
              </li>
            </ul>
          </div>
          <div class="reveal reveal-d2" style="
            background: var(--neutral-50); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 40px;
            aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
          ">
            <p style="color: var(--fg-3); font-size: 14px;">Employee records dashboard</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Visa Tracking -->
    <section class="section-pad" style="padding: 80px 40px; background: var(--neutral-50);">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;">
          <div class="reveal" style="
            background: var(--neutral-0); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 40px;
            aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; order: -1;
          ">
            <p style="color: var(--fg-3); font-size: 14px;">Visa tracking dashboard</p>
          </div>
          <div class="reveal reveal-d2">
            <div style="
              width: 48px; height: 48px; border-radius: var(--radius-sm);
              background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
              display: flex; align-items: center; justify-content: center;
              color: var(--cirvio-sage); margin-bottom: 20px;
            ">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.75"/>
                <path d="M2 10h20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                <path d="M6 15h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </div>
            <h2 style="font-size: 28px; font-weight: 700; color: var(--fg-1); margin: 0 0 16px; letter-spacing: -0.01em;">Visa &amp; Document Tracking</h2>
            <p style="font-size: 16px; color: var(--fg-2); line-height: 1.7; margin: 0 0 20px;">
              Never miss a visa or Emirates ID renewal again. Cirvio monitors expiry dates across your entire workforce and fires proactive alerts at 90, 60, and 30 days out.
            </p>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Visa, Emirates ID, work permit tracking
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Configurable expiry alert thresholds
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Bulk renewal workflow tools
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Multi-country support (UAE, KSA, QA, BH, KW, OM)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Payroll Compliance -->
    <section class="section-pad" style="padding: 80px 40px;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;">
          <div class="reveal">
            <div style="
              width: 48px; height: 48px; border-radius: var(--radius-sm);
              background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
              display: flex; align-items: center; justify-content: center;
              color: var(--cirvio-sage); margin-bottom: 20px;
            ">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 style="font-size: 28px; font-weight: 700; color: var(--fg-1); margin: 0 0 16px; letter-spacing: -0.01em;">Payroll Compliance (WPS)</h2>
            <p style="font-size: 16px; color: var(--fg-2); line-height: 1.7; margin: 0 0 20px;">
              UAE Wage Protection System compliance made simple. Generate SIF files, validate payroll data against MoHRE requirements, and maintain a complete payment history ready for audit.
            </p>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Automated WPS SIF file generation
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                MoHRE validation checks
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Payroll history &amp; variance reports
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Direct bank file integrations
              </li>
            </ul>
          </div>
          <div class="reveal reveal-d2" style="
            background: var(--neutral-50); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 40px;
            aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
          ">
            <p style="color: var(--fg-3); font-size: 14px;">WPS compliance dashboard</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Smart Alerts -->
    <section class="section-pad" style="padding: 80px 40px; background: var(--neutral-50);">
      <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
        <div class="reveal" style="margin-bottom: 48px;">
          <div style="
            width: 56px; height: 56px; border-radius: var(--radius-md);
            background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300);
            display: flex; align-items: center; justify-content: center;
            color: var(--cirvio-sage); margin: 0 auto 20px;
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            </svg>
          </div>
          <h2 style="font-size: 36px; font-weight: 700; color: var(--fg-1); margin: 0 0 16px; letter-spacing: -0.02em;">Smart Alerts</h2>
          <p style="font-size: 17px; color: var(--fg-2); max-width: 520px; margin: 0 auto; line-height: 1.65;">
            Proactive notifications keep your team ahead of every deadline. Configure exactly when and how you get notified.
          </p>
        </div>
        <div class="col-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: left;">
          <div class="reveal reveal-d1" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Email Notifications</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">Scheduled digest emails and instant alerts for critical events sent directly to HR managers and responsible admins.</p>
          </div>
          <div class="reveal reveal-d2" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">In-App Push</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">Real-time dashboard notifications with severity levels &mdash; critical, warning, and informational &mdash; so you always know what needs attention first.</p>
          </div>
          <div class="reveal reveal-d3" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Custom Thresholds</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">Configure per-document-type alert windows. Default to 90/60/30 days or set your own schedule based on your renewal lead times.</p>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class FeaturesComponent {}
