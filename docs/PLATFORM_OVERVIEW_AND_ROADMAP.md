# Cirvio — Platform State, Roadmap & Setup

_Last updated: 2026-06-14_

A practical map of what's built, what's still stubbed, where to take it next, and
exactly what you must configure for everything to actually work.

---

## 1. What's built and working

Assuming the env vars in §4 are set, these are real and functional:

- **Multi-tenant core** — strict tenant isolation, JWT + DB-backed sessions with
  device binding, RBAC (TENANT_ADMIN / HR_MANAGER / VIEWER).
- **Auth** — signup (tenant register), login, password reset (emailed),
  **passwordless passkeys** (WebAuthn), team invites (emailed).
- **Employees** — full CRUD, departments, **org chart with a real reporting
  hierarchy** (manager/reports), job levels.
- **Visas** — records for every visa type, a **5-stage expiry alert engine**
  (90/60/30/14/7 days) run by a daily cron, visa dashboard.
- **WPS / payroll** — monthly records, **SIF file generation** (MOHRE format),
  bulk create, violations, WPS dashboard.
- **AI assistant** — chat with **read-only, tenant-scoped tools** (org overview,
  employees, compliance), conversation persistence, immutable tool-call audit.
- **Data export** — **Power BI / Tableau OData feed + CSV**, per-tenant revocable
  tokens. Gated behind paywall + `data_export` feature.
- **Billing** — Stripe self-serve checkout, customer portal, webhooks, trial
  gating, and **per-plan feature entitlements** editable in the admin panel.
- **Admin console** — tenants, plans (limits + price + feature toggles), users,
  sessions/devices, audit logs, monitoring.
- **Image uploads** — avatars + tenant logos via Supabase Storage.
- **Marketing site** — accurate to the product, interactive device mockups.
- **Deploys** — Prisma migrations (`migrate deploy`, self-baselining).

## 2. What's stubbed / NOT working yet ⚠️

These exist in the UI/API but are placeholders — plan around them:

1. **Employee document files** — upload/download presigned URLs are
   **placeholders** (`document.service.ts`). Document *metadata* (type, name,
   expiry) is stored and tracked, but the **actual files are not stored or
   retrievable**. `storage.ts` only handles images, not documents.
2. **SIF file storage** — the SIF *content* is generated and returned by the API,
   but it is **not uploaded to a bucket**, so the stored `fileUrl` is a
   placeholder and download-by-URL won't work.
3. **Alert delivery** — visa/WPS alerts are generated in the DB by cron and shown
   **in-app on the dashboard**, but are **not delivered by email or push**.
4. **WPS submission** — SIF generation only; "submit/confirm" are status changes,
   **not real MOHRE/bank API calls**.
5. **In-memory stores** — WebAuthn challenges and rate limiting live in process
   memory → they break across **multiple instances / serverless** (fine on a
   single Railway instance).

## 3. Feature roadmap

### Phase 0 — Finish what's started (highest priority)
- **Wire employee document storage** to Supabase signed URLs
  (`createSignedUploadUrl` / `createSignedUrl`) — reuse the existing storage
  client. Makes document upload/download actually work.
- **Persist SIF files** to storage and return a real download URL.
- **Deliver alerts by email** (reuse the Resend helper) + a simple in-app
  notifications center.

### Phase 1 — Production hardening
- **Redis** for sessions / rate-limit / WebAuthn challenges (multi-instance safe).
- **Observability** — request IDs, structured logs, Sentry error tracking.
- Typed error hierarchy (replace generic 500s) for cleaner client + AI handling.

### Phase 2 — Compliance depth (the moat)
- **Document AI** — auto-extract expiry dates and classify uploaded docs (ties
  into the assistant). Removes manual data entry.
- **WPS bank/MOHRE submission** — real integration or a guided hand-off to the
  bank's WPS portal.
- **Renewal workflow** — assignable PRO tasks with due dates (optional).

### Phase 3 — AI expansion (your stated vision)
- **AI write-tools, gated + confirmed** — create invite, update employee, dismiss
  alert ("the assistant wants to… approve?").
- **AiInsight** persistence + an org-efficiency recommendations panel.
- Conversation-history sidebar in the chat UI.

### Phase 4 — Commercial polish
- Annual billing + invoicing + promo codes in Stripe.
- Onboarding flow with sample data and an in-app product tour.
- Email digests; notifications center.
- Tableau-specific polish; OData `$filter`/`$top`/`$count` for large datasets.

### Phase 5 — Enterprise
- SSO / SAML, multi-entity / group companies, data-residency (region pinning),
  SOC 2 / ISO 27001 posture, UAE PDPL alignment.

## 4. Setup checklist — what you must configure

Set these as environment variables on the **backend host (Railway → Variables)**
unless noted. Grouped by what they unlock.

### Required to boot
| Var | Value |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | random string, ≥ 32 chars |
| `REFRESH_TOKEN_SECRET` | random string, ≥ 32 chars |
| `FRONTEND_URL` | e.g. `https://app.cirvio.com` (email links, Stripe redirect, OData) |
| `ALLOWED_ORIGINS` | your frontend origin(s), comma-separated |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` (behind Railway/Cloudflare) |
| `PORT` | set automatically by Railway |

### Passkeys / passwordless login
| Var | Value |
| --- | --- |
| `WEBAUTHN_RP_ID` | the domain users visit, e.g. `app.cirvio.com` (no scheme) |
| `WEBAUTHN_RP_NAME` | `Cirvio` |
| `WEBAUTHN_ORIGIN` | full origin, e.g. `https://app.cirvio.com` |

### Email (invites + password reset)  — `backend/EMAIL.md`
| Var | Value |
| --- | --- |
| `RESEND_API_KEY` | from resend.com |
| `EMAIL_FROM` | e.g. `Cirvio <noreply@yourdomain.com>` (verified domain) |

### AI assistant — `backend/AI.md`
| Var | Value |
| --- | --- |
| `GROQ_API_KEY` | free key from console.groq.com |
| `CHAT_MODEL` | optional (default `llama-3.3-70b-versatile`) |
| `LLM_BASE_URL` | optional (default Groq) |

### Billing / paywall — `backend/BILLING.md`
| Var | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |

Then in Stripe: create Products + recurring Prices, add a webhook to
`https://<api>/api/billing/webhook` (events: `checkout.session.completed`,
`customer.subscription.created/updated/deleted`), and in **Admin → Plans** paste
each `price_…` and tick the features each plan includes.

### Storage (images now; documents after Phase 0)
| Var | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (server-only) |
| `SUPABASE_STORAGE_BUCKET` | optional (default `public-assets`) |

### Data export
| Var | Value |
| --- | --- |
| `PUBLIC_API_URL` | optional — public API base for the OData URL shown to users |

### Optional tuning
| Var | Value |
| --- | --- |
| `ENABLE_JOBS` | `false` to disable the visa/WPS cron jobs |
| `RATE_LIMIT_MULTIPLIER` | scales rate limits |

### Frontend
- `src/environments/environment.prod.ts` → set `apiUrl` to your API host
  (currently `https://cirviong-production.up.railway.app`). Make sure it matches
  `ALLOWED_ORIGINS` on the backend.

### Hosting / DNS
- **Frontend** (Angular static) → Vercel; point your app domain at it.
- **Backend** (Express, long-running) → Railway; point your API domain at it.
  Keep the backend off serverless (cron jobs + chat would time out).
- `WEBAUTHN_RP_ID` **must** equal the domain users actually visit.

## 5. Post-deploy smoke test

1. `GET /health` → `{ status: "ok" }`.
2. Sign up a tenant → log in.
3. Add an employee, set a manager → org chart renders the tree.
4. Add a visa with a near expiry → it appears in the visa dashboard.
5. Set a Stripe price on a plan → subscribe with a test card → tenant flips to
   `ACTIVE` (webhook).
6. Set `GROQ_API_KEY` → ask the assistant "how big is my org?".
7. Settings → Data export → generate token → connect Power BI to
   `https://<api>/api/odata/` (Basic auth, username = token).
8. (After Phase 0) upload an employee document → download it back.
