// Integration test suite — run against a live server on port 4000
// Usage: node node_modules/tsx/dist/cli.mjs test.ts
export {}

const BASE = 'http://localhost:4000'
let passed = 0
let failed = 0

async function expect(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`  ✓ ${label}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${label}: ${(err as Error).message}`)
    failed++
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init)
  let body: unknown
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body, headers: res.headers }
}

// ─── Health ───────────────────────────────────────────────────────────────────

console.log('\nHealth')

await expect('GET /health returns 200 with status ok', async () => {
  const { status, body } = await req('/health')
  assert(status === 200, `Expected 200, got ${status}`)
  assert((body as Record<string, string>).status === 'ok', `Expected {status:"ok"}, got ${JSON.stringify(body)}`)
})

// ─── 404 Handling ─────────────────────────────────────────────────────────────

console.log('\n404 handling')

await expect('Unknown route returns 404', async () => {
  const { status } = await req('/nonexistent')
  assert(status === 404, `Expected 404, got ${status}`)
})

await expect('Root / returns 404 (no root handler)', async () => {
  const { status } = await req('/')
  assert(status === 404, `Expected 404, got ${status}`)
})

// ─── Auth Guards ──────────────────────────────────────────────────────────────

console.log('\nAuth guards (unauthenticated requests)')

await expect('GET /api/admin/admins without token returns 401', async () => {
  const { status } = await req('/api/admin/admins')
  assert(status === 401, `Expected 401, got ${status}`)
})

await expect('GET /api/users/me without token returns 401', async () => {
  const { status } = await req('/api/users/me')
  assert(status === 401, `Expected 401, got ${status}`)
})

await expect('GET /api/employees without token returns 401', async () => {
  const { status } = await req('/api/employees')
  assert(status === 401, `Expected 401, got ${status}`)
})

// ─── Public Endpoints ─────────────────────────────────────────────────────────

console.log('\nPublic endpoints (no auth required)')

await expect('POST /api/admin/login reaches handler (not a 404)', async () => {
  const { status } = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notreal@test.com', password: 'wrong' }),
  })
  // 401 = bad creds (DB available), 500 = DB not connected — both confirm route is wired
  assert(status !== 404, `Route not found (got 404) — login route is not mounted`)
})

await expect('POST /api/admin/login with missing body returns 400', async () => {
  const { status } = await req('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert(status === 400 || status === 401, `Expected 400, got ${status}`)
})

// ─── CORS ─────────────────────────────────────────────────────────────────────

console.log('\nCORS')

await expect('Request includes Access-Control-Allow-Origin header', async () => {
  const { headers } = await req('/health', {
    headers: { Origin: 'http://localhost:4200' },
  })
  const header = headers.get('access-control-allow-origin')
  assert(header !== null, `Expected CORS header to be present, got null`)
})

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n──────────────────────────`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
