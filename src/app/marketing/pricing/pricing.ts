import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Plan {
  icon: string;
  name: string;
  price: string;
  period: string;
  desc: string;
  cta: string;
  ctaHref: string;
  highlight: boolean;
  badge?: string;
  features: string[];
}

interface Faq { q: string; a: string; }

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pricing.html',
})
export class PricingComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  readonly plans: Plan[] = [
    {
      icon: 'zap',
      name: 'Starter',
      price: 'AED 299',
      period: '/month',
      desc: 'Perfect for small businesses and startups managing up to 25 employees.',
      cta: 'Start free trial',
      ctaHref: '/signup',
      highlight: false,
      features: [
        'Up to 25 employees',
        'Employee profiles & org chart',
        'Visa, Emirates ID & labour-card tracking',
        'Automated expiry alerts (90/60/30/14/7 days)',
        'WPS records & SIF file generation',
        'Passwordless (passkey) sign-in',
        '2 HR manager accounts',
        'Email support',
      ],
    },
    {
      icon: 'building',
      name: 'Professional',
      price: 'AED 799',
      period: '/month',
      desc: 'For growing companies that want the AI assistant and BI-ready data export.',
      cta: 'Start free trial',
      ctaHref: '/signup',
      highlight: true,
      badge: 'Most popular',
      features: [
        'Up to 150 employees',
        'Everything in Starter',
        'AI workforce assistant',
        'Power BI / Tableau live feed + CSV export',
        'WPS compliance dashboard',
        'Role-based access (Admin / HR / Viewer)',
        '5 HR manager accounts',
        'Priority email support',
      ],
    },
    {
      icon: 'globe',
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'For larger organisations that need higher limits and dedicated support.',
      cta: 'Contact sales',
      ctaHref: '/contact',
      highlight: false,
      features: [
        'Custom employee & user limits',
        'Everything in Professional',
        'OData API access for data integrations',
        'Custom plan & feature configuration',
        'Dedicated onboarding & training',
        'Priority support',
      ],
    },
  ];

  readonly faqs: Faq[] = [
    { q: 'Is there a free trial?', a: 'Yes — all paid plans include a 14-day free trial with no credit card required. You can explore every feature before committing.' },
    { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at your next billing cycle.' },
    { q: 'How is the employee count calculated?', a: 'We count active employees on your account. Terminated employees can be retained for your records without counting toward your plan limit.' },
    { q: 'How is my data kept secure?', a: 'Your data is encrypted in transit and isolated per organisation — every request is scoped to your tenant only. Sign-in supports passkeys (Face ID, Touch ID, security keys). If you have specific data-residency requirements, talk to us about Enterprise options.' },
    { q: 'What payment methods do you accept?', a: 'Card payments are handled securely by Stripe, billed in AED. For Enterprise or annual arrangements, contact us and we’ll set it up.' },
    { q: 'Can I export my data?', a: 'Yes. On the Professional and Enterprise plans you can export clean CSVs in one click, or connect a live OData feed to Power BI or Tableau.' },
  ];

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => this.observer!.observe(el));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
