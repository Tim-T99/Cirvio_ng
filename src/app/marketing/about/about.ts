import { Component, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Value { icon: string; title: string; desc: string; }
interface Stat { value: string; label: string; }

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.html',
})
export class AboutComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  readonly values: Value[] = [
    { icon: 'target', title: 'Built for UAE compliance',          desc: 'Every feature is designed around the specific requirements of MOHRE, GDRFA, and UAE labour law — not retrofitted from a generic HR tool.' },
    { icon: 'shield', title: 'Reliability you can depend on',     desc: 'Compliance deadlines cannot be missed. We build every alert system and reminder with the assumption that silence is not acceptable.' },
    { icon: 'users',  title: 'Made for HR teams, not IT teams',   desc: 'Cirvio is built to be used by HR managers and PRO officers, not system administrators. No technical setup required.' },
    { icon: 'bulb',   title: 'Transparent and honest',            desc: 'Simple pricing, no hidden modules, and no surprise add-ons. If you need something we don’t offer, we’ll tell you.' },
  ];

  readonly stats: Stat[] = [
    { value: 'UAE-first', label: 'Built for Gulf compliance' },
    { value: '5-stage',   label: 'Visa expiry alerts' },
    { value: 'AI-native', label: 'Workforce assistant built in' },
    { value: 'Power BI',  label: 'Live data export' },
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
