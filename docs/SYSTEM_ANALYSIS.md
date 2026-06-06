# Cirvio — System Analysis & AI Integration Roadmap

_Last updated: 2026-06-04_

A full-stack review of the Cirvio platform (Angular frontend + Express/Prisma
backend) covering disconnects, gaps, data-model improvements, and a concrete
architecture for the upcoming AI assistant. Written with the stated AI goal in
mind: **a chat assistant with deep backend access that can analyse the
organisation structure and recommend efficiency improvements.**

---

## 1. What the platform is

Multi-tenant SaaS for UAE-focused staff compliance: employees, UAE visas (with
an expiry-alert engine), WPS/SIF wage processing, documents, org chart, and an
admin console. Strong security posture: JWT + DB-backed sessions, device
binding, strict tenant scoping at every layer, RBAC (TENANT_ADMIN / HR_MANAGER /
VIEWER), rate limiting, cron-driven alert jobs.

The bones are solid. The gaps below are about **wiring, completeness, and
preparing the data model for AI.**

---

## 2. Critical disconnects (things that are broken or dead today)

### 2.1 Chat → `/api/chat` does not exist  ⚠️ highest priority
`src/app/dashboard/chat/chat.ts` POSTs to `POST /api/chat`, but there is **no
chat route, controller, or service in the backend**. The assistant always falls
through to its hardcoded error message. The entire AI feature is a UI shell with
no backend. This is where the AI roadmap (section 6) starts.

### 2.2 Forgot/reset-password — FIXED this session
Previously the login page linked to `/forgot-password`, which had no route and
no backend email wiring. Now built: `/forgot-password` + `/reset-password`
pages, and `requestPasswordReset` emails the link via Resend.

### 2.3 Email & storage are optional and silent
- Email (`RESEND_API_KEY`) and storage (`SUPABASE_*`) degrade gracefully but
  there's **no admin-visible indication** of whether they're configured. An
  admin sending invites has no idea email is off unless they read the response.
  Consider a small "integrations health" panel in the admin console.

### 2.4 WebAuthn challenge store is in-memory
Passkey challenges live in a per-process `Map` (5-min TTL). On Vercel/Railway
with more than one instance — or any cold start between `options` and
`verify` — passkey registration/login will intermittently fail. Needs a shared
store (Redis or a short-lived DB row) before scaling past one instance.

### 2.5 Rate limiting is in-memory
`express-rate-limit` default store is per-process. Multi-instance deployments
get N× the intended limits and inconsistent throttling. Same Redis fix as 2.4.

---

## 3. Missing / incomplete functionality

| Area | State | Note |
|------|-------|------|
| WPS/SIF MOHRE submission | Stub | `submitSif`/`confirmSif` are state transitions only — no real bank/MOHRE API calls. `silaReference` never validated. |
| Notifications delivery | Partial | Visa/WPS **alerts** are generated in DB by cron, but there's no email/in-app delivery of them — they only surface if the user opens the dashboard. |
| Audit immutability | Basic | `AuditLog`/`UserActivityLog` are mutable rows. For compliance, consider append-only + hash chaining. |
| Plan-limit enforcement | COUNT-based | `assertEmployeeLimit`/`assertUserLimit` run `COUNT(*)` per action. Fine now; a cached counter helps at scale. |
| DB migrations | `db push` | Build uses `prisma db push` (no migration history). Move to `prisma migrate deploy` for safe prod schema changes. |
| Error taxonomy | Generic 500s | No typed error hierarchy; controllers mostly return 500. A `ValidationError`/`NotFoundError`/`ForbiddenError` set would give the frontend (and the AI) structured failures. |
| Observability | Morgan only | No request IDs, structured logs, or error tracking (Sentry). Important once AI starts calling tools server-side. |

---

## 4. Database model improvements

### 4.1 Org structure is not modelled  ⚠️ blocks the AI vision
This is the single most important data gap for "analyse the organisation and
recommend efficiency improvements."

- `Employee` has only `departmentId`. There is **no `managerId` self-relation**,
  so there is no reporting hierarchy — no spans of control, no depth, no
  "who reports to whom."
- `Department` has **no `managerId` and no `parentDepartmentId`**, so
  departments are a flat list, not a tree.
- The org-chart page reconstructs a pseudo-tree from department grouping only.

**Recommended additions:**
```prisma
model Employee {
  // ...
  managerId   String?    @db.Uuid
  manager     Employee?  @relation("Reports", fields: [managerId], references: [id], onDelete: SetNull)
  reports     Employee[] @relation("Reports")
  seniority   String?    // or an enum: IC, LEAD, MANAGER, DIRECTOR, EXEC
  jobLevel    Int?       // numeric band for span/cost analysis
}

model Department {
  // ...
  managerId          String?      @db.Uuid
  manager            Employee?    @relation("DeptManager", fields: [managerId], references: [id])
  parentDepartmentId String?      @db.Uuid
  parent             Department?  @relation("DeptTree", fields: [parentDepartmentId], references: [id])
  children           Department[] @relation("DeptTree")
  costCenter         String?
}
```
With these, the AI can compute spans of control, org depth, manager overload,
vacant-manager chains, headcount/cost per branch, etc. — the raw material for
efficiency recommendations.

### 4.2 Cost & efficiency signals
For "efficiency recommendations" the model needs the inputs:
- Salary exists (`basicSalaryAed`, `allowancesAed`) — good, but only per
  employee. Add **department/cost-center rollups** (can be derived, but worth a
  materialised view or cached aggregate for AI speed).
- No **headcount-over-time** history (joins/leaves trend). `startDate`/`endDate`
  exist on Employee, so attrition is derivable — but a periodic snapshot table
  makes trend analysis cheap and lets AI answer "how has the org changed."

### 4.3 AI-specific tables (new)
- `Conversation` + `ChatMessage` — persist chat history per user/tenant (today
  chat is stateless and lost on refresh). Needed for context, and for the AI to
  reference prior turns.
- `AiInsight` — store generated recommendations with status (new / acted-on /
  dismissed) so insights are trackable, not just ephemeral chat text.
- `AiToolAuditLog` — every backend action the AI takes on a user's behalf must
  be logged (what tool, what args, what tenant, what result). Non-negotiable for
  a multi-tenant system giving an LLM backend access.

### 4.4 Smaller schema notes
- `TenantInvite` has no `invitedBy` (who sent it) or `revokedAt` — useful for
  audit and for the AI to explain "X invited Y."
- `UserActivityLog` / `AuditLog` would benefit from an index on
  `(tenantId, createdAt)` and `(action)` for the AI to query activity quickly.

---

## 5. Frontend improvements

- **Chat has no persistence or service layer.** It makes raw HTTP calls from the
  component and loses history on navigation. Introduce a `ChatService` (signal
  store) backed by the new `Conversation`/`ChatMessage` tables.
- **No shared API client / typed models.** Every component hardcodes
  `environment.apiUrl + '/api/...'` and re-declares response interfaces. A thin
  typed API layer (or generated types from the backend) would cut drift — and
  the AI tool layer can reuse the same contracts.
- **No global error/toast system.** Failures are handled ad hoc per component.
- **Subscriptions aren't torn down** in most components (no `takeUntilDestroyed`).
  Low risk with signals + lazy routes, but worth standardising.
- **Integrations health surface** (email/storage/AI configured?) for admins.

---

## 6. AI integration architecture (the main event)

Goal: a chat assistant that can **read** tenant data deeply, **analyse** the org,
and **recommend** (and eventually **act**), safely, within strict tenant
boundaries.

### 6.1 Core principle: the AI is just another tenant-scoped client
The LLM must never touch the database directly. It calls **tools** that run
through the *exact same* service layer and tenant scoping that the REST API
uses. The `tenantId` and `role` come from the authenticated session — **never
from the model**. The model cannot widen its own scope.

```
User ↔ Chat UI ↔ POST /api/chat ↔ Chat orchestrator
                                     ├── Claude (tool-use loop)
                                     └── Tool registry → existing services
                                          (employee.service, visa.service, …)
                                          all filtered by req.user.tenantId
```

### 6.2 Recommended stack
- **Claude via the Anthropic SDK** (`@anthropic-ai/sdk`), model
  `claude-opus-4-8` for analysis-heavy work or `claude-sonnet-4-6` for cheaper
  interactive chat. Use **tool use** for backend access and **prompt caching**
  on the system prompt + tool schemas + tenant context (big cost saver since the
  org snapshot is reused across turns).
- Stream responses (SSE) to the chat UI for responsiveness.

### 6.3 Tool layer (read first, write later)
Phase 1 — **read-only tools** (safe, high value):
- `get_org_overview` → headcount, departments, reporting depth, spans of control
  (needs §4.1), open visa/WPS alerts, trial status.
- `list_employees(filter)` → wraps `employee.service.listEmployees`.
- `get_employee(id)` → profile + visa/WPS/doc records.
- `get_visa_alerts` / `get_wps_status` → compliance posture.
- `get_compliance_summary` → expiring visas/docs, WPS lateness, violations.

Each tool: validates args (zod), injects `tenantId` from session, calls the
existing service, returns compact JSON. Every call is written to
`AiToolAuditLog`.

Phase 2 — **write tools, gated**: create invite, update employee, dismiss alert,
generate SIF draft — each requiring the user's role to permit it AND an explicit
confirmation step in the UI ("The assistant wants to invite jane@… as HR
Manager — approve?"). The model proposes; the human commits.

### 6.4 Context strategy
On each chat request, build a cached **tenant context block**: org snapshot
(counts, departments, hierarchy summary), compliance headlines, plan/limits,
the user's role and country (UAE vs other → drives the compliance vs HR persona
already in the UI). Cache it (prompt caching + a short server-side TTL) so you're
not re-querying on every turn.

### 6.5 Efficiency-recommendation capability
Once §4.1 (hierarchy) + §4.2 (cost rollups) exist, a `analyse_org_efficiency`
tool can surface: managers with too-wide/too-narrow spans, redundant single-
report chains, departments with no manager, cost-per-head outliers, attrition
hot-spots. The LLM turns these signals into prioritised, explained
recommendations and writes them to `AiInsight`.

### 6.6 Safety checklist for LLM-with-backend-access (multi-tenant)
- [ ] `tenantId`/`role` always from session, never model input.
- [ ] Every tool re-validated against RBAC server-side.
- [ ] All tool calls logged to `AiToolAuditLog` (immutable).
- [ ] Writes require human confirmation; default deny.
- [ ] Output scoping: never return another tenant's data even if the model asks.
- [ ] Rate-limit `/api/chat` (LLM calls are expensive) — add a `chatLimiter`.
- [ ] Treat user chat text as untrusted (prompt-injection aware); tools are the
      only privileged surface, and they don't take free-form SQL/queries.

---

## 7. Suggested sequencing

1. ✅ **DONE — Org hierarchy data model** (§4.1). Shipped: `Employee.managerId`
   self-relation (manager/reports) + `jobLevel`; `Department.parentDepartmentId`
   tree + `costCenter`; cycle-safe manager validation; org chart rebuilt as a
   real reporting tree; manager picker in the employee create/edit forms.
2. ⏳ **IN PROGRESS — Chat backend MVP** (§6.1–6.4) — real `/api/chat` with Claude
   + read-only tools + `Conversation`/`ChatMessage` persistence + `chatLimiter`.
   Turns the dead chat UI into a working assistant.
3. **Compliance & efficiency tools** (§6.5) — the analysis/recommendation value.
4. **Write tools with confirmation** (§6.3 phase 2).
5. **Infra hardening** — Redis for sessions/rate-limit/passkey challenges (§2.4,
   2.5), migrations (§3), observability (§3).

---

## Appendix: endpoints the frontend calls but backend lacks
- ~~`POST /api/chat` — missing entirely~~ ✅ **RESOLVED (Step 2).** Implemented
  with an LLM (Groq by default, any OpenAI-compatible provider) + read-only
  tenant-scoped tools, conversation persistence
  (`Conversation`/`ChatMessage`), tool-call audit (`AiToolAuditLog`), and
  `chatLimiter`. See `backend/AI.md`.

(Everything else the frontend calls maps to a real backend route.)
