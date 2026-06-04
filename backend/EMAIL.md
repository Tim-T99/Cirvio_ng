# Transactional email (invites)

Tenant invites are delivered by email via [Resend](https://resend.com).
Email is **optional** — if it isn't configured, invites are still created
and the admin gets a copyable accept-link in the UI (Settings → Team).

## Environment variables

Set on the backend host (e.g. Railway):

| Variable         | Required | Description                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------- |
| `RESEND_API_KEY` | for email | Resend API key. If unset, emails are skipped (link is shown in the UI).    |
| `EMAIL_FROM`     | no       | Sender, e.g. `Cirvio <noreply@yourdomain.com>`. Defaults to Resend's test sender `onboarding@resend.dev`. |
| `FRONTEND_URL`   | yes\*    | Base URL used to build invite links, e.g. `https://app.cirvio.com`. Defaults to `http://localhost:4200`. |

\* `FRONTEND_URL` matters even without email — it's used to build the
accept link (`<FRONTEND_URL>/accept-invite?token=…`) returned to the admin.

## Notes

- To send from your own domain (not `onboarding@resend.dev`), verify the
  domain in Resend and set `EMAIL_FROM` to an address on it.
- The email helper (`src/lib/email.ts`) is generic and never throws, so a
  failed/!configured send won't break invite creation.
- Password-reset emails can reuse this helper once the frontend
  forgot/reset-password pages exist (they don't yet).
