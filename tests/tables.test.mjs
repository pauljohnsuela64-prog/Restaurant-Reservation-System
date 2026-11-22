import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { openDatabase } from '../server/api.ts'
import { availability, assignTable } from '../server/tables.ts'

test('upgrade preserves pending rows and competing processes can confirm only one overlapping request', { timeout: 15000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'phase4-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'demo.sqlite')
  const old = new DatabaseSync(path)
  old.exec(`CREATE TABLE reservation_requests (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 8), date TEXT NOT NULL,
    time TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status='pending')
  ) STRICT;
  INSERT INTO reservation_requests VALUES
    ('a','Fiction','demo@example.com',8,'2030-01-01','17:30','original','pending'),
    ('b','Fiction','demo@example.com',8,'2030-01-01','17:30','original','pending');
  PRAGMA user_version=1`)
  old.close()
  const db = openDatabase(path)
  try {
    const now = new Date('2030-01-01T00:00Z')
    const times = guests => availability(db, '2030-01-01', guests, now)
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3)
    assert.equal(db.prepare("SELECT count(*) AS n FROM reservation_requests WHERE created_at='original' AND status='pending'").get().n, 2)
    assert.ok(times(8).includes('17:30'))
    const contenders = ['a', 'b'].map(id => fork(new URL('./fixtures/confirm.mjs', import.meta.url), [path, id]))
    try {
      await Promise.all(contenders.map(child => once(child, 'message')))
      const outcomes = await Promise.all(contenders.map(child => {
        const outcome = once(child, 'message')
        child.send('confirm')
        return outcome
      }))
      assert.deepEqual(outcomes.map(([result]) => result.table).sort(), [4, null])
      const winner = outcomes[0][0].table ? 'a' : 'b'
      assert.equal(assignTable(db, winner, () => now), 4)
      assert.deepEqual(times(8).slice(0, 2), ['18:30', '19:00'])
      assert.ok(times(6).includes('17:30'))
    } finally {
      for (const child of contenders) child.kill()
    }
  } finally {
    db.close()
  }
})
