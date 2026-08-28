# Database migrations

Deploys now use **`prisma migrate deploy`** (reviewable, ordered SQL migrations)
instead of `prisma db push`. No more `--accept-data-loss`, and schema history is
tracked in `prisma/migrations/`.

## How deploy works

The `start` script runs `node scripts/migrate.js && node dist/server.js`.

`scripts/migrate.js`:
1. Runs `prisma migrate deploy`.
2. If that fails because the database already has the schema but no migration
   history (Prisma error **P3005** — true on the first deploy after switching
   from `db push`), it baselines the existing DB by marking `0_init` as applied,
   then deploys again.

So the **first** deploy self-baselines the existing Supabase database; every
deploy after that is a clean one-shot `migrate deploy` that applies only new
migrations.

## The baseline

`prisma/migrations/0_init/` is the baseline — a single migration that represents
the entire schema at the moment we switched off `db push`. It is **never run**
against the existing production database (it's marked applied); it only runs when
creating a fresh database from scratch.

## Making a schema change

Edit `prisma/schema.prisma`, then create a migration:

**With a dev database** (recommended):
```bash
npm run migrate:dev -- --name add_widget_table   # creates + applies locally
git add prisma/migrations && git commit
```

**Without a database** (offline — e.g. CI/agent with no Postgres):
```bash
cp prisma/schema.prisma /tmp/old.prisma           # snapshot BEFORE editing
# …edit prisma/schema.prisma…
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_widget_table
prisma migrate diff \
  --from-schema /tmp/old.prisma \
  --to-schema   prisma/schema.prisma \
  --script > prisma/migrations/<that_folder>/migration.sql
```
Commit the new migration folder. On deploy, `migrate deploy` applies it.

> Do **not** use `prisma db push` against production anymore — it bypasses the
> migration history and can drift the database from the recorded migrations.
