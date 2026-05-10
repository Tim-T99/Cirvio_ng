import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-password-rule',
  standalone: true,
  template: `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;transition:color 120ms;"
         [style.color]="met ? 'var(--success)' : 'var(--fg-3)'">
      @if (met) {
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      } @else {
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      }
      {{ label }}
    </div>
  `,
})
export class PasswordRuleComponent {
  @Input() met = false;
  @Input() label = '';
}
