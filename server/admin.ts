import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { assignTable, cancelRequest } from './tables.ts'

const cookie = '__Host-restaurant-admin'
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' }
const lifetime = 60 * 60 * 1000
const origins = new Set(['http://localhost:5173', 'http://localhost:4173'])

function passwordHash(password: string, salt: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 }, (err, digest) => {
      if (err) reject(err)
      else resolve(digest)
    })
  })
}

export async function bootstrapAdmin(db: DatabaseSync, password: string) {
  if (password.length < 15 || Buffer.byteLength(password) > 256) throw new Error('Use at least 15 characters and at most 256 UTF-8 bytes.')
  const salt = randomBytes(16)
  const digest = await passwordHash(password, salt)
  db.prepare('INSERT INTO admin_credentials VALUES (1, ?, ?)').run(salt, digest)
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function adminRouter(db: DatabaseSync, clock: () => Date) {
  const router = Router()
  router.use((req, res, next) => {
    // Browser scripts on other origins cannot set this header without a successful CORS preflight.
    if (req.method === 'POST' && (!origins.has(req.get('Origin') ?? '') || req.get('X-Admin-Action') !== '1')) {
      res.sendStatus(403)
      return
    }
    next()
  })

  router.post('/login', async (req, res) => {
    const password = req.body?.password
    if (!req.is('application/json') || typeof password !== 'string' || Buffer.byteLength(password) > 256 || !password.length) {
      res.sendStatus(400)
      return
    }
    const now = clock().getTime()
    // Claim an attempt before hashing. All connections share this one-account limit.
    const limit = db.prepare(`INSERT INTO admin_login_window VALUES (1,1,?)
      ON CONFLICT(id) DO UPDATE SET
        attempts=CASE WHEN until_ms <= ? THEN 1 ELSE attempts+1 END,
        until_ms=CASE WHEN until_ms <= ? THEN excluded.until_ms ELSE until_ms END
      WHERE until_ms <= ? OR attempts < 5 RETURNING attempts`).get(now + 15 * 60_000, now, now, now)
    if (!limit) {
      res.sendStatus(429)
      return
    }
    const credential = db.prepare('SELECT salt,digest FROM admin_credentials WHERE id=1').get()
    if (!credential || !timingSafeEqual(await passwordHash(password, credential.salt as Uint8Array), credential.digest as Uint8Array)) {
      res.sendStatus(401)
      return
    }
    const token = randomBytes(32).toString('hex')
    const issued = clock().getTime()
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('DELETE FROM admin_sessions WHERE expires <= ?').run(issued)
      db.prepare('INSERT INTO admin_sessions VALUES (?,?)').run(tokenHash(token), issued + lifetime)
      db.exec('DELETE FROM admin_login_window; COMMIT')
    } finally {
      if (db.isTransaction) db.exec('ROLLBACK')
    }
    res.cookie(cookie, token, { ...cookieOptions, maxAge: lifetime }).sendStatus(204)
  })

  router.use((req, res, next) => {
    const token = req.headers.cookie?.split(/;\s*/).find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1)
    const digest = token && /^[0-9a-f]{64}$/.test(token) && tokenHash(token)
    if (!digest || !db.prepare('SELECT 1 FROM admin_sessions WHERE digest=? AND expires>?').get(digest, clock().getTime())) {
      res.sendStatus(401)
      return
    }
    res.locals.sessionDigest = digest
    next()
  })
  router.post('/logout', (_req, res) => {
    db.prepare('DELETE FROM admin_sessions WHERE digest=?').run(res.locals.sessionDigest)
    res.clearCookie(cookie, cookieOptions).sendStatus(204)
  })
  router.get('/requests', (req, res) => {
    const { status = '', q = '' } = req.query
    if (typeof status !== 'string' || !['', 'pending', 'confirmed', 'cancelled'].includes(status)
      || typeof q !== 'string' || q.length > 254) {
      res.sendStatus(400)
      return
    }
    const search = q.trim().toLowerCase()
    res.json(db.prepare(`SELECT id,name,email,guests,date,time,cancelledAt,status,tableId,capacity FROM (
      SELECT r.id,r.name,r.email,r.guests,r.date,r.time,
      r.cancelled_at AS cancelledAt,
      CASE WHEN r.cancelled_at IS NOT NULL THEN 'cancelled' WHEN a.table_id IS NULL THEN 'pending' ELSE 'confirmed' END AS status,
      t.id AS tableId,t.capacity,r.created_at AS createdAt FROM reservation_requests r
      LEFT JOIN assignments a ON a.request_id=r.id LEFT JOIN dining_tables t ON t.id=a.table_id)
      WHERE (? = '' OR status = ?)
        AND (? = '' OR instr(lower(name), ?) OR instr(lower(email), ?) OR instr(lower(id), ?))
      ORDER BY date,time,createdAt,id`).all(status, status, search, search, search, search))
  })
  router.post('/requests/:id/confirm', (req, res) => {
    if (!db.prepare('SELECT 1 FROM reservation_requests WHERE id=?').get(req.params.id)) {
      res.sendStatus(404)
      return
    }
    const tableId = assignTable(db, req.params.id, clock)
    if (tableId === null) res.sendStatus(409)
    else res.json({ status: 'confirmed', tableId })
  })
  router.post('/requests/:id/cancel', (req, res) => {
    const cancelledAt = cancelRequest(db, req.params.id, clock)
    if (cancelledAt === null) res.sendStatus(404)
    else res.json({ status: 'cancelled', cancelledAt })
  })
  return router
}
