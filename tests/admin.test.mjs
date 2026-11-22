import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { createApi, openDatabase } from '../server/api.ts'
import { bootstrapAdmin } from '../server/admin.ts'

test('admin HTTP lifecycle protects bookings, confirms atomically and revokes access', async t => {
  const db = openDatabase(':memory:')
  let now = Date.parse('2030-01-01T08:00Z')
  const password = randomBytes(24).toString('hex')
  await bootstrapAdmin(db, password)
  await assert.rejects(bootstrapAdmin(db, randomBytes(24).toString('hex')))
  const server = createApi(db, () => new Date(now)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close() })
  const base = 'http://127.0.0.1:' + server.address().port + '/api/admin/'
  let cookie = ''
  const get = () => fetch(base + 'requests', { headers: { cookie } })
  const post = (path, body = {}, headers = {}) => fetch(base + path, {
    method: 'POST', body: JSON.stringify(body),
    headers: { cookie, Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Admin-Action': '1', ...headers },
  })
  const login = () => post('login', { password })
  const malformed = await fetch(base + 'login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  })
  assert.equal(malformed.status, 400)
  assert.equal(malformed.headers.get('Cache-Control'), 'no-store')
  assert.equal((await get()).status, 401)
  assert.equal((await post('requests/a/cancel')).status, 401)
  assert.equal((await post('requests/a/confirm')).status, 401)
  assert.equal((await post('login', { password }, { Origin: 'https://untrusted.invalid' })).status, 403)
  for (let i = 0; i < 5; i++) assert.equal((await post('login', { password: 'incorrect' })).status, 401)
  assert.equal((await login()).status, 429)
  now += 15 * 60_000
  const signedIn = await login()
  assert.equal(signedIn.status, 204)
  const header = signedIn.headers.get('set-cookie')
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(header.includes(flag))
  cookie = header.split(';')[0]
  assert.notEqual(db.prepare('SELECT digest FROM admin_sessions').get().digest, cookie.split('=')[1])
  const insert = db.prepare("INSERT INTO reservation_requests(id,name,email,guests,date,time,created_at,status) VALUES (?,'Guest','guest@example.com',8,'2030-01-01',?,'original','pending')")
  insert.run('a','17:00')
  insert.run('b','17:30')
  insert.run('c','19:00')
  const pending = await get()
  assert.equal(pending.headers.get('cache-control'), 'no-store')
  assert.equal((await pending.json())[0].status, 'pending')
  assert.equal((await post('requests/a/confirm', {}, { 'X-Admin-Action': '' })).status, 403)
  for (let i = 0; i < 2; i++) assert.deepEqual(await (await post('requests/a/confirm')).json(), { status: 'confirmed', tableId: 4 })
  assert.equal((await post('requests/b/confirm')).status, 409)
  assert.equal((await post('requests/missing/confirm')).status, 404)
  const [confirmed, waiting] = await (await get()).json()
  assert.equal(confirmed.capacity, 8)
  assert.equal(confirmed.status, 'confirmed')
  assert.equal(waiting.status, 'pending')
  assert.equal((await post('requests/a/cancel', {}, { Origin: 'https://untrusted.invalid' })).status, 403)
  assert.equal((await post('requests/a/cancel', {}, { 'X-Admin-Action': '' })).status, 403)
  assert.equal((await post('requests/missing/cancel')).status, 404)
  const cancelled = { status: 'cancelled', cancelledAt: new Date(now).toISOString() }
  assert.deepEqual(await (await post('requests/a/cancel')).json(), cancelled)
  now += 1000
  assert.deepEqual(await (await post('requests/a/cancel')).json(), cancelled)
  assert.equal((await post('requests/a/confirm')).status, 409)
  const released = await fetch(new URL('/api/availability?date=2030-01-01&guests=8', base))
  assert.ok((await released.json()).times.includes('17:00'))
  const filtered = await fetch(base + 'requests?status=cancelled&q=GUEST%40', { headers: { cookie } })
  const [cancelledRow] = await filtered.json()
  assert.deepEqual([cancelledRow.id, cancelledRow.status, cancelledRow.tableId, cancelledRow.cancelledAt], ['a', 'cancelled', null, cancelled.cancelledAt])
  assert.equal((await fetch(base + 'requests?status=invalid', { headers: { cookie } })).status, 400)
  assert.equal((await post('requests/b/cancel')).status, 200)
  assert.equal((await post('logout')).status, 204)
  assert.equal((await get()).status, 401)
  now += 3 * 60 * 60_000
  cookie = (await login()).headers.get('set-cookie').split(';')[0]
  assert.equal((await post('requests/c/confirm')).status, 409)
  now += 60 * 60_000
  assert.equal((await get()).status, 401)
  assert.equal((await post('requests/b/confirm')).status, 401)
})
