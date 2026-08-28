# Image uploads (Supabase Storage)

Tenant logos and user avatars are uploaded to a **public Supabase Storage
bucket** and referenced by their public URL (`User.avatarUrl`,
`Tenant.logoUrl`).

## Required environment variables

Set these on the backend host:

| Variable                    | Required | Description                                                        |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| `SUPABASE_URL`              | yes      | Project API URL, e.g. `https://<project-ref>.supabase.co`          |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Service-role key (server-side only — **never** expose to clients). |
| `SUPABASE_STORAGE_BUCKET`   | no       | Bucket name. Defaults to `public-assets`.                          |

You can find both values in the Supabase dashboard under
**Project Settings → API**.

## Bucket provisioning

No manual setup is needed. On the first upload the backend automatically
creates the bucket (public, 5 MB limit, image MIME types only) if it does
not already exist.

## Endpoints

- `POST /api/uploads/image` — authenticated tenant users (avatar, logo).
- `POST /api/admin/uploads/image` — platform admins (used by the admin
  user-detail page).

Both accept `multipart/form-data` with a single `file` field and an
optional `kind` field (`avatar` | `logo`, selects the storage folder).
They return `{ "url": "https://…" }`. Persisting the URL is done by the
caller via the relevant profile-update endpoint
(`PATCH /api/users/me`, `PATCH /api/tenant/profile`,
`PATCH /api/admin/users/:userId`).

If the Supabase credentials are not configured the upload endpoints
respond with `503` and the rest of the app continues to work (avatars
fall back to initials).
