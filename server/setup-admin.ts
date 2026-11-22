import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { openDatabase } from './api.ts'
import { bootstrapAdmin } from './admin.ts'

async function setup() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run setup in an interactive terminal.')
  const path = resolve(process.env.RESERVATION_DB ?? 'data/reservations.sqlite')
  mkdirSync(dirname(path), { recursive: true })
  const db = openDatabase(path)
  try {
    if (db.prepare('SELECT 1 FROM admin_credentials').get()) throw new Error('An administrator already exists.')
    const silent = new Writable({ write(_chunk, _encoding, done) { done() } })
    const input = createInterface({ input: process.stdin, output: silent, terminal: true, historySize: 0 })
    try {
      process.stdout.write('New admin passphrase (hidden, minimum 15 characters): ')
      const password = await input.question('')
      process.stdout.write('\nRepeat passphrase (hidden): ')
      if (await input.question('') !== password) throw new Error('Passphrases differ.')
      await bootstrapAdmin(db, password)
      console.log('\nAdministrator created.')
    } finally {
      input.close()
    }
  } finally {
    db.close()
  }
}

setup().catch(error => {
  console.error(error.code ? '\nSetup could not be completed.' : error.message)
  process.exitCode = 1
})
