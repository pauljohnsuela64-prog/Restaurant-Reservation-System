import type { DatabaseSync } from 'node:sqlite'
import { reservationMinutes, timeChoices } from '../src/reservations.ts'

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function suitableTable(db: DatabaseSync) {
  return db.prepare(`
    SELECT id FROM dining_tables t WHERE capacity >= ? AND NOT EXISTS (
      SELECT 1 FROM assignments a WHERE a.table_id = t.id AND a.date = ?
        AND a.start < ? AND a.end > ?
    ) ORDER BY capacity, id LIMIT 1
  `)
}

export function availability(db: DatabaseSync, date: string, guests: number, now: Date) {
  const table = suitableTable(db)
  return timeChoices(date, now).filter(time => {
    const start = minutes(time)
    return Boolean(table.get(guests, date, start + reservationMinutes, start))
  })
}

// Internal confirmation only. SQLite serializes the check and insert across connections.
export function assignTable(db: DatabaseSync, requestId: string, clock = () => new Date()) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const request = db.prepare('SELECT date,time,guests,cancelled_at FROM reservation_requests WHERE id = ?').get(requestId)
    if (!request) throw new Error('Unknown reservation request')
    if (request.cancelled_at !== null) return null
    const existing = db.prepare('SELECT table_id FROM assignments WHERE request_id = ?').get(requestId)
    if (existing) return Number(existing.table_id)
    const date = String(request.date)
    const time = String(request.time)
    if (!timeChoices(date, clock()).includes(time)) return null
    const start = minutes(time)
    const end = start + reservationMinutes
    const table = suitableTable(db).get(request.guests, date, end, start)
    if (!table) return null
    db.prepare('INSERT INTO assignments(request_id,table_id,date,start,end) VALUES (?,?,?,?,?)')
      .run(requestId, table.id, date, start, end)
    db.exec('COMMIT')
    return Number(table.id)
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK')
  }
}

export function cancelRequest(db: DatabaseSync, requestId: string, clock: () => Date) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const request = db.prepare('SELECT cancelled_at FROM reservation_requests WHERE id = ?').get(requestId)
    if (!request) return null
    if (typeof request.cancelled_at === 'string') return request.cancelled_at
    const cancelledAt = clock().toISOString()
    db.prepare('UPDATE reservation_requests SET cancelled_at = ? WHERE id = ?').run(cancelledAt, requestId)
    db.prepare('DELETE FROM assignments WHERE request_id = ?').run(requestId)
    db.exec('COMMIT')
    return cancelledAt
  } finally {
    if (db.isTransaction) db.exec('ROLLBACK')
  }
}
