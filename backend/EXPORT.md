# Data export (Power BI / Tableau / CSV)

Clean, denormalized, report-ready datasets for BI tools. Two ways to consume:

- **Live OData v4 feed** — Power BI & Tableau connect natively and refresh.
- **CSV download** — one-click flat files from Settings → Data export.

**Gating:** behind the paywall — requires an **active (paid) subscription** *and*
a plan that includes the **`data_export`** feature.

## Datasets

One registry (`src/lib/export-datasets.ts`) drives both CSV and OData, so columns
and types match across formats. Entity sets: **Employees, Visas, WpsRecords,
Documents, Departments** — flattened, human-readable columns, resolved names,
ISO dates, with derived fields (e.g. `DaysToExpiry`, `TotalMonthlyAed`,
department `MonthlyPayrollAed`).

## Connecting Power BI (OData)

1. In Cirvio: **Settings → Data export → Generate token** (copy it — shown once).
2. In Power BI Desktop: **Get data → OData feed**.
3. URL: `https://<your-api>/api/odata/`
4. Authentication: **Basic** → **Username = the token**, leave **Password blank**.
5. Load the entity sets you want; schedule refresh as normal.

Tableau: use its OData connector with the same URL + token (Basic auth).

The token can also be passed as `Authorization: Bearer <token>` or `?token=<token>`
for scripts.

## Endpoints

| Method | Path                              | Auth            | Notes                         |
| ------ | --------------------------------- | --------------- | ----------------------------- |
| GET    | `/api/export/datasets`            | JWT (paid+feat) | Dataset list + OData URL       |
| GET    | `/api/export/csv/:dataset`        | JWT (HR/admin)  | CSV download                   |
| GET    | `/api/export/tokens`              | JWT (admin)     | List active tokens             |
| POST   | `/api/export/tokens`              | JWT (admin)     | Create token (returns plaintext once) |
| DELETE | `/api/export/tokens/:tokenId`     | JWT (admin)     | Revoke token                   |
| GET    | `/api/odata/`                     | Export token    | OData service document         |
| GET    | `/api/odata/$metadata`            | Export token    | EDMX schema                    |
| GET    | `/api/odata/:entitySet`           | Export token    | Entity collection (JSON)       |

## Environment

| Variable         | Required | Description                                                            |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `PUBLIC_API_URL` | no       | Public base URL used to build the OData URL shown to users + in `@odata.context`. Defaults to the request's host. Set it if behind a proxy that rewrites host. |

## Security

- Tokens are stored as SHA-256 hashes; the plaintext is shown once at creation.
- Tokens are tenant-scoped and revocable; the feed enforces the paywall + feature
  on every request.
- CSV (which includes salary data) is restricted to HR managers / tenant admins.
