import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { validateReservation } from '../src/reservations.ts'

export function openDatabase(path: string) {
  const db = new DatabaseSync(path)
  try {
    db.exec('BEGIN IMMEDIATE')
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
    } else if (version !== 1) {
      throw new Error('Unsupported reservation database schema')
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
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get()
    res.json({ status: 'ok' })
  })
  const insert = db.prepare(`
    INSERT INTO reservation_requests (id, name, email, guests, date, time, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
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
    const fields = validateReservation(details, now)
    if (Object.keys(fields).length) {
      res.status(400).json({ error: 'Check your reservation details.', fields })
      return
    }
    const id = randomUUID()
    const createdAt = now.toISOString()
    insert.run(id, details.name, details.email, Number(details.guests), details.date, details.time, createdAt)
    res.status(201).json({ id, createdAt, status: 'pending' })
  })

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.status === 400 || error.status === 413 ? error.status : 500
    res.status(status).json({ error: status === 500 ? 'The request could not be processed.' : 'Invalid JSON or request too large.' })
  }
  app.use(handleError)
  return app
}
