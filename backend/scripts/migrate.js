// scripts/migrate.js
// ─────────────────────────────────────────────
// Deploy-time migration runner. Replaces `prisma db push` with proper,
// reviewable migrations (`prisma migrate deploy`).
//
// Self-baselines on first run: if the database already has the schema (built
// previously by `db push`) but no migration history, `migrate deploy` errors
// with P3005 ("schema is not empty"). We then mark the baseline (0_init) as
// already-applied and deploy again. On every later deploy this is a clean
// one-shot `migrate deploy`.
// ─────────────────────────────────────────────

const { execSync } = require('child_process');

const BASELINE = '0_init';

function run(cmd) {
  console.log(`[migrate] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('npx prisma migrate deploy');
} catch (err) {
  // Most likely: existing (non-empty) database with no migration history.
  console.log('[migrate] deploy failed — baselining existing database as ' + BASELINE + '…');
  try {
    run(`npx prisma migrate resolve --applied ${BASELINE}`);
  } catch (resolveErr) {
    // Already baselined (or genuinely unresolvable) — let the retry surface it.
    console.log('[migrate] baseline resolve skipped: ' + (resolveErr.message || resolveErr));
  }
  // Retry. If this fails, it's a real migration error → non-zero exit (crash, visibly).
  run('npx prisma migrate deploy');
}

console.log('[migrate] migrations up to date.');
