import { Component, Input } from '@angular/core';

let logoUid = 0;

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 240"
      [attr.width]="width"
      [attr.height]="height"
      fill="none"
      [style.color]="color"
      aria-label="Cirvio"
    >
      <defs>
        <mask [attr.id]="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="240">
          <rect width="720" height="240" fill="white" />
          <text
            x="360"
            y="138"
            text-anchor="middle"
            fill="black"
            style="font-family:'Jost',system-ui,sans-serif;font-weight:200;font-size:56px;letter-spacing:18px;paint-order:stroke;stroke:black;stroke-width:14;"
          >CIRVIO</text>
        </mask>
      </defs>
      <circle cx="360" cy="120" r="100" stroke="currentColor" stroke-width="1.25" [attr.mask]="'url(#' + maskId + ')'" />
      <text
        x="360"
        y="138"
        text-anchor="middle"
        fill="currentColor"
        style="font-family:'Jost',system-ui,sans-serif;font-weight:200;font-size:56px;letter-spacing:18px;"
      >CIRVIO</text>
      <circle cx="260" cy="120" r="2.6" fill="currentColor" />
      <circle cx="460" cy="120" r="2.6" fill="currentColor" />
    </svg>
  `,
})
export class LogoComponent {
  @Input() width = 140;
  @Input() color = 'currentColor';

  readonly maskId = `ring-cut-${++logoUid}`;

  get height(): number {
    return Math.round(this.width * 240 / 720);
  }
}
