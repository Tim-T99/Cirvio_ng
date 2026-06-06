# AI assistant (chat)

The dashboard chat (`/dashboard/chat`) is backed by `POST /api/chat`, which
runs an LLM with **read-only, tenant-scoped tools** so the assistant can answer
questions grounded in the organisation's live data.

## Environment variables

The assistant talks to any **OpenAI-compatible** chat-completions endpoint, so
you can use a free provider (default: **Groq**) — no Anthropic key required.

| Variable       | Required | Description                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `GROQ_API_KEY` | for AI   | API key. If unset, the endpoint still works but replies with a "not configured" message (no crash). |
| `CHAT_MODEL`   | no       | Model id. Defaults to `llama-3.3-70b-versatile` (Groq).                      |
| `LLM_BASE_URL` | no       | OpenAI-compatible base URL. Defaults to `https://api.groq.com/openai/v1`.    |
| `LLM_API_KEY`  | no       | Alternative to `GROQ_API_KEY` (used if `GROQ_API_KEY` is unset).             |

### Where to set it
Railway → your backend service → **Variables** tab → add `GROQ_API_KEY`, then
redeploy. Get a free key (no credit card) at <https://console.groq.com>.

### Switching providers (all free-tier, no code change)
Just point the env vars at another OpenAI-compatible endpoint:

| Provider   | `LLM_BASE_URL`                               | key var        | example `CHAT_MODEL`            |
| ---------- | -------------------------------------------- | -------------- | ------------------------------- |
| Groq       | `https://api.groq.com/openai/v1` (default)   | `GROQ_API_KEY` | `llama-3.3-70b-versatile`       |
| OpenRouter | `https://openrouter.ai/api/v1`               | `LLM_API_KEY`  | `meta-llama/llama-3.3-70b-instruct` |
| Together   | `https://api.together.xyz/v1`                | `LLM_API_KEY`  | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Ollama     | `http://localhost:11434/v1`                  | `LLM_API_KEY` (any) | `llama3.1`                 |

## How it works

1. `POST /api/chat { message, conversationId? }` (auth + active-tenant required,
   rate-limited by `chatLimiter`).
2. The orchestrator (`src/services/chat/chat.service.ts`) persists the message,
   builds a tenant/role-aware system prompt, and runs the tool-use loop.
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
