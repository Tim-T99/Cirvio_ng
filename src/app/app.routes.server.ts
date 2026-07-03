import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Public marketing pages: prerendered to static HTML at build time for SEO.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'features', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

  // Auth, dashboard and admin routes depend on runtime session state
  // and/or dynamic :id segments, so they stay client-rendered.
  { path: '**', renderMode: RenderMode.Client },
];
