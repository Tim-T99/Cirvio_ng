# AI assistant (chat)

The dashboard chat (`/dashboard/chat`) is backed by `POST /api/chat`, which
runs Claude with **read-only, tenant-scoped tools** so the assistant can answer
questions grounded in the organisation's live data.

## Environment variables

| Variable            | Required | Description                                                       |
| ------------------- | -------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | for AI   | Anthropic API key. If unset, the endpoint still works but replies with a "not configured" message (no crash). |
| `CHAT_MODEL`        | no       | Model id. Defaults to `claude-sonnet-4-6`. Use `claude-opus-4-8` for heavier analysis. |

## How it works

1. `POST /api/chat { message, conversationId? }` (auth + active-tenant required,
   rate-limited by `chatLimiter`).
2. The orchestrator (`src/services/chat/chat.service.ts`) persists the message,
   builds a tenant/role-aware system prompt, and runs Claude's tool-use loop.
3. Tools (`src/services/chat/tools.ts`) are **read-only** and route through the
   existing tenant-scoped services. `tenantId`/`role` come from the session —
   never from the model — so the assistant can't see another tenant's data or
   widen its scope.
4. Every tool call is written to `AiToolAuditLog` (immutable audit).
5. Conversations + messages persist in `Conversation` / `ChatMessage`.

### Available tools (phase 1, read-only)
- `get_org_overview` — headcount, reporting hierarchy (depth, spans of control,
  wide spans, single-report managers, unassigned employees), department
  headcount + monthly payroll cost, plan limits.
- `list_employees` — filtered, paginated directory.
- `get_employee` — one employee: manager, reports, visa/WPS/doc summary.
- `get_compliance_summary` — visa/WPS posture + documents expiring within 90 days.

## Roadmap
- Phase 2: **write tools** (create invite, update employee, dismiss alert) gated
  behind RBAC + an explicit human confirmation step in the UI.
- Conversation history sidebar in the chat UI (endpoints already exist:
  `GET /api/chat/conversations`, `GET /api/chat/conversations/:id`).
