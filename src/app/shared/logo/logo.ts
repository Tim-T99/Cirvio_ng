import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <svg
      [attr.width]="width"
      [attr.height]="height"
      viewBox="0 0 720 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask [attr.id]="maskId">
          <rect width="720" height="240" fill="white" />
          <text
            x="360"
            y="140"
            font-family="Jost, sans-serif"
            font-weight="200"
            font-size="56"
            letter-spacing="18"
            text-anchor="middle"
            fill="black"
          >CIRVIO</text>
        </mask>
      </defs>

      <circle
        cx="360"
        cy="120"
        r="100"
        [attr.fill]="color"
        [attr.mask]="'url(#' + maskId + ')'"
      />

      <text
        x="360"
        y="140"
        font-family="Jost, sans-serif"
        font-weight="200"
        font-size="56"
        letter-spacing="18"
        text-anchor="middle"
        [attr.fill]="color"
      >CIRVIO</text>

      <circle cx="260" cy="120" r="2.6" [attr.fill]="color" />
      <circle cx="460" cy="120" r="2.6" [attr.fill]="color" />
    </svg>
  `,
})
export class LogoComponent {
  @Input() width = 140;
  @Input() color = 'currentColor';

  readonly maskId = `cirvio-mask-${Date.now()}`;

  get height(): number {
    return Math.round(this.width * 240 / 720);
  }
}
