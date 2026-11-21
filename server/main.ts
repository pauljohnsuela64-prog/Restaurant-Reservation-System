import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createApi, openDatabase } from './api.ts'

const path = resolve(process.env.RESERVATION_DB ?? 'data/reservations.sqlite')
mkdirSync(dirname(path), { recursive: true })
const db = openDatabase(path)
const server = createApi(db).listen(3001, '127.0.0.1', () => {
  console.log('Reservation API listening on http://127.0.0.1:3001')
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => db.close()))
}
