import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createApi, openDatabase } from '../server/api.ts'

test('HTTP rejects invalid data and stores normalized requests across database reopen', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reservation-'))
  const path = join(dir, 'test.sqlite')
  let db = openDatabase(path)
  const now = new Date('2030-01-01T04:00:00Z')
  const server = createApi(db, () => now).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const base = 'http://127.0.0.1:' + server.address().port
    const endpoint = base + '/api/reservation-requests'
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { status: 'ok' })
    assert.equal((await fetch(endpoint)).status, 404)
    const valid = { name: "  O'Connor  ", email: ' demo@example.com ', guests: 2, date: '2030-01-01', time: '17:00' }
    const post = body => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    for (const input of ['{', '{}', ...[{ date: '2029-12-31' }, { date: '2030-01-07' }, { guests: '2' }, { email: 'bad' }, { time: '22:00' }].map(patch => JSON.stringify({ ...valid, ...patch }))]) {
      assert.equal((await post(input)).status, 400)
    }
    const first = await post(JSON.stringify(valid))
    assert.equal(first.status, 201)
    const receipt = await first.json()
    assert.deepEqual(Object.keys(receipt).sort(), ['createdAt', 'id', 'status'])
    assert.equal(receipt.createdAt, now.toISOString())
    assert.equal(receipt.status, 'pending')
    assert.notEqual((await (await post(JSON.stringify(valid))).json()).id, receipt.id)
    await new Promise(resolve => server.close(resolve))
    db.close()
    db = openDatabase(path)
    const row = db.prepare('SELECT * FROM reservation_requests WHERE id = ?').get(receipt.id)
    assert.equal(row.name, "O'Connor")
    assert.equal(row.email, 'demo@example.com')
    assert.equal(row.status, 'pending')
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM reservation_requests').get().total, 2)
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve))
    db.close()
    await unlink(path)
    await rmdir(dir)
  }
})
