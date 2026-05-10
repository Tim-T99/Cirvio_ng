import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class HomeComponent {
  readonly stats = [
    { value: '100%', label: 'Audit Ready' },
    { value: '14-day', label: 'Free Trial' },
    { value: 'Real-time', label: 'Alerts' },
    { value: 'Multi-region', label: 'Compliance' },
  ];

  readonly features = [
    {
      title: 'Employee Records',
      desc: 'Centralise all employee data — contracts, documents, certifications — in a single secure repository with role-based access.',
      icon: 'people',
    },
    {
      title: 'Visa Tracking',
      desc: 'Automated expiry alerts for visas, Emirates IDs, and work permits so your team is never caught off-guard by renewals.',
      icon: 'visa',
    },
    {
      title: 'Payroll Compliance (WPS)',
      desc: 'Generate WPS-compliant SIF files and audit payroll records against UAE Ministry of Labour regulations with one click.',
      icon: 'payroll',
    },
    {
      title: 'Smart Alerts',
      desc: 'Proactive notifications via email and in-app push — configurable thresholds ensure nothing falls through the cracks.',
      icon: 'alert',
    },
  ];

  readonly steps = [
    {
      num: '01',
      title: 'Connect your HR data',
      desc: 'Import employees from your existing system or start fresh. Cirvio supports CSV upload and direct integrations.',
    },
    {
      num: '02',
      title: 'Configure compliance rules',
      desc: 'Set jurisdiction-specific rules for UAE, Saudi Arabia, Qatar, and beyond. Alerts fire automatically.',
    },
    {
      num: '03',
      title: 'Stay ahead of deadlines',
      desc: 'Your dashboard surfaces everything expiring soon. One-click reports for audits and regulatory submissions.',
    },
  ];
}
