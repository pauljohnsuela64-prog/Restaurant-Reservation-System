import { adminRouter } from './admin.ts'
import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { availability } from './tables.ts'
import { localDateString, parseLocalDate, validateReservation } from '../src/reservations.ts'

export function openDatabase(path: string) {
  const db = new DatabaseSync(path)
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; BEGIN IMMEDIATE')
    const version = db.prepare('PRAGMA user_version').get()?.user_version
    if (version === 0) {
      db.exec(`
        CREATE TABLE reservation_requests (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
          guests INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 8),
          date TEXT NOT NULL, time TEXT NOT NULL, created_at TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status = 'pending')
        ) STRICT;
        PRAGMA user_version = 1;
      `)
    } else if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
      throw new Error('Unsupported reservation database schema')
    }
    if (version === 0 || version === 1) {
      db.exec(`
        ALTER TABLE reservation_requests ADD COLUMN retry_key TEXT;
        CREATE UNIQUE INDEX request_retry ON reservation_requests(retry_key);
        CREATE TABLE dining_tables (id INTEGER PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 8)) STRICT;
        INSERT INTO dining_tables VALUES (1,2),(2,4),(3,6),(4,8);
        CREATE TABLE assignments (
          request_id TEXT PRIMARY KEY REFERENCES reservation_requests(id),
          table_id INTEGER NOT NULL REFERENCES dining_tables(id),
          date TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL CHECK(end > start)
        ) STRICT;
        CREATE INDEX assignment_schedule ON assignments(date,table_id,start,end);
        PRAGMA user_version = 2;
      `)
    }
    if (version === 0 || version === 1 || version === 2) {
      db.exec(`
        CREATE TABLE admin_credentials (
          id INTEGER PRIMARY KEY CHECK(id=1), salt BLOB NOT NULL, digest BLOB NOT NULL
        ) STRICT;
        CREATE TABLE admin_sessions (digest TEXT PRIMARY KEY, expires INTEGER NOT NULL) STRICT;
        CREATE TABLE admin_login_window (id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL, until_ms INTEGER NOT NULL) STRICT;
        PRAGMA user_version=3;
      `)
    }
    if (version !== 4) {
      db.exec(`
        ALTER TABLE reservation_requests ADD COLUMN cancelled_at TEXT;
        PRAGMA user_version=4;
      `)
    }
    db.exec('COMMIT')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

export function createApi(db: DatabaseSync, clock = () => new Date()) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '4kb' }))
  app.use('/api/admin', adminRouter(db, clock))
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get()
    res.json({ status: 'ok' })
  })
  app.get('/api/availability', (req, res) => {
    const { date, guests } = req.query
    const now = clock()
    res.set('Cache-Control', 'no-store')
    if (typeof date !== 'string' || !parseLocalDate(date) || date < localDateString(now)
      || typeof guests !== 'string' || !/^[1-8]$/.test(guests)) {
      res.status(400).json({ error: 'Choose a valid date and 1 to 8 guests.' })
      return
    }
    res.json({ times: availability(db, date, Number(guests), now) })
  })
  const insert = db.prepare(`
    INSERT INTO reservation_requests (id, name, email, guests, date, time, created_at, status, retry_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `)
  app.post('/api/reservation-requests', (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Send JSON.' })
      return
    }
    const { name, email, guests, date, time } = req.body ?? {}
    const details = {
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim() : '',
      guests: Number.isInteger(guests) ? String(guests) : '',
      date: typeof date === 'string' ? date.trim() : '',
      time: typeof time === 'string' ? time.trim() : '',
    }
    const now = clock()
    const key = req.get('Idempotency-Key') ?? null
    if (key !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(key)) {
      res.status(400).json({ error: 'Invalid idempotency key.' })
      return
    }
    db.exec('BEGIN IMMEDIATE')
    try {
      const prior = key && db.prepare('SELECT * FROM reservation_requests WHERE retry_key = ?').get(key)
      if (prior) {
        const same = prior.name === details.name && prior.email === details.email
          && prior.guests === Number(details.guests) && prior.date === details.date && prior.time === details.time
        db.exec('COMMIT')
        if (same) res.status(201).json({ id: prior.id, createdAt: prior.created_at, status: 'pending' })
        else res.status(409).json({ error: 'This key was used for different details.' })
        return
      }
      const fields = validateReservation(details, now)
      if (Object.keys(fields).length) {
        db.exec('ROLLBACK')
        res.status(400).json({ error: 'Check your reservation details.', fields })
        return
      }
      const id = randomUUID()
      const createdAt = now.toISOString()
      insert.run(id, details.name, details.email, Number(details.guests), details.date, details.time, createdAt, key)
      db.exec('COMMIT')
      res.status(201).json({ id, createdAt, status: 'pending' })
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK')
      throw error
    }
  })

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.status === 400 || error.status === 413 ? error.status : 500
    res.status(status).json({ error: status === 500 ? 'The request could not be processed.' : 'Invalid JSON or request too large.' })
  }
  app.use(handleError)
  return app
}
