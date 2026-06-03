import { Component, Input, computed, signal } from '@angular/core';

/**
 * Circular avatar. Shows the image at `src`; if missing or it fails to
 * load, falls back to the person's / org's initials on a stable colour
 * derived from their name.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (src && !failed()) {
      <img
        [src]="src"
        [alt]="name"
        [style.width.px]="size"
        [style.height.px]="size"
        (error)="failed.set(true)"
        style="border-radius:50%;object-fit:cover;display:block;flex-shrink:0;background:var(--neutral-100);"
      />
    } @else {
      <span
        [style.width.px]="size"
        [style.height.px]="size"
        [style.font-size.px]="fontSize()"
        [style.background]="bg()"
        [title]="name"
        style="border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
               color:#fff;font-weight:600;flex-shrink:0;line-height:1;user-select:none;letter-spacing:0.01em;"
      >{{ initials() }}</span>
    }
  `,
})
export class AvatarComponent {
  @Input() name = '';
  @Input() src: string | null = null;
  @Input() size = 40;

  readonly failed = signal(false);

  readonly initials = computed(() => {
    const parts = this.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly fontSize = computed(() => Math.round(this.size * 0.4));

  // Stable, pleasant colour from the name so the same person is always the same hue.
  readonly bg = computed(() => {
    let hash = 0;
    for (const ch of this.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 28) % 360} 55% 38%))`;
  });
}
