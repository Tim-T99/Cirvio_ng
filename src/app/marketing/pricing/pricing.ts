import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- Header -->
    <section class="section-pad" style="padding: 80px 40px 64px; background: var(--neutral-50); border-bottom: 1px solid var(--border-soft);">
      <div style="max-width: 800px; margin: 0 auto; text-align: center;">
        <p style="
          display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--cirvio-sage); background: var(--cirvio-mint-50);
          border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-pill);
          padding: 4px 14px; margin-bottom: 20px;
        ">Pricing</p>
        <h1 class="section-title animate-fade-up-1" style="font-size: 44px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg-1); margin: 0 0 20px;">
          Simple, transparent pricing
        </h1>
        <p class="animate-fade-up-2" style="font-size: 18px; color: var(--fg-2); max-width: 500px; margin: 0 auto; line-height: 1.65;">
          Priced in AED. All plans include a 14-day free trial — no credit card required.
        </p>
      </div>
    </section>

    <!-- Pricing cards -->
    <section class="section-pad" style="padding: 80px 40px;">
      <div style="max-width: 1100px; margin: 0 auto;">
        <div class="pricing-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; align-items: start;">

          <!-- Starter -->
          <div class="reveal reveal-d1" style="
            background: var(--bg-elev-1); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 36px 32px;
            box-shadow: var(--shadow-sm);
          ">
            <p style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-3); margin: 0 0 12px;">Starter</p>
            <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
              <span style="font-size: 42px; font-weight: 700; color: var(--fg-1); letter-spacing: -0.03em;">AED 299</span>
              <span style="font-size: 15px; color: var(--fg-2);">/mo</span>
            </div>
            <p style="font-size: 13px; color: var(--fg-3); margin: 0 0 28px;">Up to 50 employees</p>
            <a routerLink="/signup" class="btn-primary" style="width: 100%; margin-bottom: 32px;">Start free trial</a>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Employee records (up to 50)
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Visa &amp; document tracking
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Email alerts
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                2 admin accounts
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Basic WPS export
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-3);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                API access
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-3);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                SSO &amp; custom integrations
              </li>
            </ul>
          </div>

          <!-- Growth (highlighted) -->
          <div class="reveal reveal-d2" style="
            background: var(--cirvio-hunter); border: 1px solid var(--cirvio-hunter);
            border-radius: var(--radius-xl); padding: 36px 32px;
            box-shadow: var(--shadow-lg);
            position: relative;
          ">
            <div style="
              position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
              background: var(--cirvio-mint); color: var(--cirvio-hunter);
              font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
              padding: 4px 14px; border-radius: var(--radius-pill);
              white-space: nowrap;
            ">Most popular</div>
            <p style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cirvio-mint-300); margin: 0 0 12px;">Growth</p>
            <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
              <span style="font-size: 42px; font-weight: 700; color: white; letter-spacing: -0.03em;">AED 799</span>
              <span style="font-size: 15px; color: var(--cirvio-mint-300);">/mo</span>
            </div>
            <p style="font-size: 13px; color: var(--cirvio-mint-300); margin: 0 0 28px;">Up to 250 employees</p>
            <a routerLink="/signup" style="
              display: flex; align-items: center; justify-content: center;
              width: 100%; background: var(--cirvio-mint); color: var(--cirvio-hunter);
              border-radius: var(--radius-md); padding: 10px 22px;
              font-weight: 600; font-size: 15px; text-decoration: none;
              margin-bottom: 32px;
              transition: background var(--dur-fast) var(--ease-out);
            "
              onmouseenter="this.style.background='var(--cirvio-mint-300)'"
              onmouseleave="this.style.background='var(--cirvio-mint)'"
            >Start free trial</a>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Employee records (up to 250)
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Visa &amp; document tracking
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Email &amp; in-app alerts
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                10 admin accounts
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Full WPS compliance suite
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--cirvio-mint-300);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--cirvio-mint)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--cirvio-mint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                API access
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: rgba(140,201,181,0.4);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                SSO &amp; custom integrations
              </li>
            </ul>
          </div>

          <!-- Enterprise -->
          <div class="reveal reveal-d3" style="
            background: var(--bg-elev-1); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: 36px 32px;
            box-shadow: var(--shadow-sm);
          ">
            <p style="font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-3); margin: 0 0 12px;">Enterprise</p>
            <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
              <span style="font-size: 32px; font-weight: 700; color: var(--fg-1); letter-spacing: -0.02em;">Contact us</span>
            </div>
            <p style="font-size: 13px; color: var(--fg-3); margin: 0 0 28px;">Unlimited employees</p>
            <a routerLink="/contact" class="btn-ghost" style="width: 100%; margin-bottom: 32px;">Talk to sales</a>
            <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;">
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Unlimited employee records
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Everything in Growth
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                SSO (SAML / OIDC)
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Custom integrations
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Dedicated account manager
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                SLA &amp; priority support
              </li>
              <li style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fg-2);">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--success)" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                On-premise option available
              </li>
            </ul>
          </div>
        </div>

        <!-- FAQ note -->
        <div style="text-align: center; margin-top: 56px;">
          <p style="font-size: 15px; color: var(--fg-2);">
            All prices in AED, excluding VAT. Need a custom quote?
            <a routerLink="/contact" style="color: var(--cirvio-sage); text-decoration: none; font-weight: 500;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">Contact our team.</a>
          </p>
        </div>
      </div>
    </section>
  `,
})
export class PricingComponent {}
