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
        'Employee profile management',
        'Visa expiry tracking',
        'Basic alert notifications (30-day)',
        'WPS record keeping',
        '2 HR manager accounts',
        'Email support',
        '5 GB document storage',
      ],
    },
    {
      icon: 'building',
      name: 'Professional',
      price: 'AED 799',
      period: '/month',
      desc: 'For growing companies that need advanced compliance tools and team access.',
      cta: 'Start free trial',
      ctaHref: '/signup',
      highlight: true,
      badge: 'Most popular',
      features: [
        'Up to 150 employees',
        'Everything in Starter',
        'Multi-level alert windows (30/60/90 days)',
        'WPS SIF file generation',
        'GDRFA & ICA status monitoring',
        'Renewal workflow & task assignment',
        'Compliance reports (MOHRE, GDRFA)',
        '5 HR manager accounts',
        'Priority email + chat support',
        '25 GB document storage',
      ],
    },
    {
      icon: 'globe',
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'For large organisations with complex multi-entity requirements and dedicated support.',
      cta: 'Contact sales',
      ctaHref: '/contact',
      highlight: false,
      features: [
        'Unlimited employees',
        'Everything in Professional',
        'Multi-entity / group company support',
        'Custom alert rules and escalations',
        'API access & webhooks',
        'SSO / SAML integration',
        'Dedicated account manager',
        'SLA-backed uptime guarantee',
        'Unlimited HR accounts',
        'Unlimited document storage',
        'Custom onboarding & training',
      ],
    },
  ];

  readonly faqs: Faq[] = [
    { q: 'Is there a free trial?', a: 'Yes — all paid plans include a 14-day free trial with no credit card required. You can explore every feature before committing.' },
    { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at your next billing cycle.' },
    { q: 'How is the employee count calculated?', a: 'We count active employees on your account at the start of each billing cycle. Archived or terminated employees do not count.' },
    { q: 'Is my data stored in the UAE?', a: 'Yes. All data is stored on UAE-region servers to comply with local data residency requirements.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards, as well as bank transfer for annual plans. AED invoicing is available for UAE businesses.' },
    { q: 'Do you offer annual billing?', a: 'Yes — annual billing gives you two months free compared to monthly pricing. Contact us to set up an annual plan.' },
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
