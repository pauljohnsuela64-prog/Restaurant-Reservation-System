import { openDatabase } from '../../server/api.ts'
import { assignTable, cancelRequest } from '../../server/tables.ts'

const db = openDatabase(process.argv[2])
process.once('message', () => {
  try {
    const clock = () => new Date('2030-01-01T00:00Z')
    if (process.argv[4] === 'cancel') process.send({ cancelledAt: cancelRequest(db, process.argv[3], clock) })
    else process.send({ table: assignTable(db, process.argv[3], clock) })
  } finally {
    db.close()
    process.disconnect()
  }
})
process.send('ready')
