import { openDatabase } from '../../server/api.ts'
import { assignTable } from '../../server/tables.ts'

const db = openDatabase(process.argv[2])
process.once('message', () => {
  try {
    process.send({ table: assignTable(db, process.argv[3], () => new Date('2030-01-01T00:00Z')) })
  } finally {
    db.close()
    process.disconnect()
  }
})
process.send('ready')
