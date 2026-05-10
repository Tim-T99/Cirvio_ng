import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- Hero -->
    <section class="section-pad" style="padding: 80px 40px 72px; background: var(--neutral-50); border-bottom: 1px solid var(--border-soft);">
      <div style="max-width: 760px; margin: 0 auto; text-align: center;">
        <p style="
          display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--cirvio-sage); background: var(--cirvio-mint-50);
          border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-pill);
          padding: 4px 14px; margin-bottom: 20px;
        ">About Cirvio</p>
        <h1 class="section-title animate-fade-up-1" style="font-size: 44px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg-1); margin: 0 0 24px;">
          Compliance software built in the Gulf, for the Gulf
        </h1>
        <p class="animate-fade-up-2" style="font-size: 18px; color: var(--fg-2); line-height: 1.7; margin: 0;">
          Cirvio was founded in Dubai by HR professionals and engineers who were tired of watching Gulf businesses struggle with fragmented spreadsheets, missed visa renewals, and last-minute WPS scrambles. We built the platform we wished existed.
        </p>
      </div>
    </section>

    <!-- Mission -->
    <section class="section-pad" style="padding: 80px 40px;">
      <div style="max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;">
        <div class="reveal">
          <h2 style="font-size: 32px; font-weight: 700; color: var(--fg-1); letter-spacing: -0.02em; margin: 0 0 20px;">Our mission</h2>
          <p style="font-size: 16px; color: var(--fg-2); line-height: 1.75; margin: 0 0 20px;">
            We believe that workforce compliance should not be a source of anxiety. Every Gulf business &mdash; from a 10-person startup in Dubai Internet City to a 2,000-employee conglomerate in Riyadh &mdash; deserves software that keeps them audit-ready without specialist consultants or enterprise IT budgets.
          </p>
          <p style="font-size: 16px; color: var(--fg-2); line-height: 1.75; margin: 0 0 32px;">
            Cirvio is purpose-built for the regulatory realities of the GCC: UAE Labour Law, WPS, GOSI, Iqama, Qatar's Kafala reforms, and more. We stay current so you don&rsquo;t have to.
          </p>
          <a routerLink="/features" class="btn-primary">Explore features</a>
        </div>
        <div class="reveal reveal-d2">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-lg); padding: 28px 24px; text-align: center;">
              <p style="font-size: 36px; font-weight: 700; color: var(--cirvio-hunter); margin: 0 0 6px; letter-spacing: -0.03em;">6+</p>
              <p style="font-size: 13px; color: var(--cirvio-sage); font-weight: 500; margin: 0;">GCC Countries</p>
            </div>
            <div style="background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-lg); padding: 28px 24px; text-align: center;">
              <p style="font-size: 36px; font-weight: 700; color: var(--cirvio-hunter); margin: 0 0 6px; letter-spacing: -0.03em;">500+</p>
              <p style="font-size: 13px; color: var(--cirvio-sage); font-weight: 500; margin: 0;">Companies</p>
            </div>
            <div style="background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-lg); padding: 28px 24px; text-align: center;">
              <p style="font-size: 36px; font-weight: 700; color: var(--cirvio-hunter); margin: 0 0 6px; letter-spacing: -0.03em;">50k+</p>
              <p style="font-size: 13px; color: var(--cirvio-sage); font-weight: 500; margin: 0;">Employees tracked</p>
            </div>
            <div style="background: var(--cirvio-mint-50); border: 1px solid var(--cirvio-mint-300); border-radius: var(--radius-lg); padding: 28px 24px; text-align: center;">
              <p style="font-size: 36px; font-weight: 700; color: var(--cirvio-hunter); margin: 0 0 6px; letter-spacing: -0.03em;">100%</p>
              <p style="font-size: 13px; color: var(--cirvio-sage); font-weight: 500; margin: 0;">Audit pass rate</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Values -->
    <section class="section-pad" style="padding: 80px 40px; background: var(--neutral-50);">
      <div style="max-width: 1100px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 48px;" class="reveal">
          <h2 style="font-size: 32px; font-weight: 700; color: var(--fg-1); letter-spacing: -0.02em; margin: 0 0 16px;">What we stand for</h2>
          <p style="font-size: 17px; color: var(--fg-2); max-width: 480px; margin: 0 auto;">Our values shape every product decision we make.</p>
        </div>
        <div class="col-3" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
          <div class="reveal reveal-d1" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 28px; margin-bottom: 14px;">&#127981;</div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Local first</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">We build for the specific laws, languages, and workflows of Gulf HR teams — not generic global templates that need months of customisation.</p>
          </div>
          <div class="reveal reveal-d2" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 28px; margin-bottom: 14px;">&#128274;</div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Trust &amp; security</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">Employee data is sensitive. We apply bank-grade encryption, strict access controls, and regular independent security audits.</p>
          </div>
          <div class="reveal reveal-d3" style="background: var(--bg-elev-1); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 28px; margin-bottom: 14px;">&#9889;</div>
            <h3 style="font-size: 16px; font-weight: 600; color: var(--fg-1); margin: 0 0 10px;">Radical simplicity</h3>
            <p style="font-size: 14px; color: var(--fg-2); line-height: 1.65; margin: 0;">Complex compliance requirements should not mean complex software. Every feature goes through a rigorous simplicity review before we ship it.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Location -->
    <section class="section-pad" style="padding: 72px 40px; background: var(--cirvio-hunter); text-align: center;">
      <div style="max-width: 600px; margin: 0 auto;">
        <p style="font-size: 14px; color: var(--cirvio-mint); font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 16px;">Headquartered in</p>
        <h2 style="font-size: 32px; font-weight: 700; color: white; letter-spacing: -0.02em; margin: 0 0 16px;">Dubai, United Arab Emirates</h2>
        <p style="font-size: 16px; color: var(--cirvio-mint-300); line-height: 1.7; margin: 0 0 32px;">
          Our team operates across the UAE, with compliance specialists in Riyadh and Doha ensuring every jurisdiction we support is covered by someone who lives and works there.
        </p>
        <a routerLink="/contact" style="
          display: inline-flex; align-items: center; gap: 10px;
          background: var(--cirvio-mint); color: var(--cirvio-hunter);
          border-radius: var(--radius-md); padding: 12px 28px;
          font-size: 15px; font-weight: 600; text-decoration: none;
          transition: background var(--dur-fast) var(--ease-out);
        "
          onmouseenter="this.style.background='var(--cirvio-mint-300)'"
          onmouseleave="this.style.background='var(--cirvio-mint)'"
        >Get in touch</a>
      </div>
    </section>
  `,
})
export class AboutComponent {}
