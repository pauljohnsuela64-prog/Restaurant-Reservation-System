import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatTime, localDateString, parseLocalDate, timeChoices, validateReservation } from '../src/reservations.ts'

const now = new Date(Date.UTC(2030, 0, 1, 4, 0))
const valid = { name: 'Ada', email: 'ada@example.com', guests: '2', date: '2030-01-01', time: '17:00' }

test('date parsing rejects impossible dates and preserves valid leap days without UTC conversion', () => {
  for (const date of ['', '2030-02-29', '2030-04-31', '2030-13-01', '2030-1-01', 'not a date']) {
    assert.equal(parseLocalDate(date), null, date)
  }
  const leapDay = parseLocalDate('2032-02-29')
  assert.equal(leapDay.getUTCFullYear(), 2032)
  assert.equal(leapDay.getUTCMonth(), 1)
  assert.equal(leapDay.getUTCDate(), 29)
  assert.equal(localDateString(new Date(Date.UTC(2030, 0, 1, -8, 5))), '2030-01-01')
  assert.equal(localDateString(new Date(Date.UTC(2030, 0, 1, 15, 55))), '2030-01-01')
})

test('every weekday follows the published hours and excludes closing time', () => {
  const cases = [
    ['2030-01-01', '17:00', '21:00', 9],
    ['2030-01-02', '17:00', '21:00', 9],
    ['2030-01-03', '17:00', '21:00', 9],
    ['2030-01-04', '12:00', '22:00', 21],
    ['2030-01-05', '12:00', '22:00', 21],
    ['2030-01-06', '12:00', '20:00', 17],
  ]
  for (const [date, first, last, count] of cases) {
    const times = timeChoices(date, now)
    assert.equal(times[0], first, date)
    assert.equal(times.at(-1), last, date)
    assert.equal(times.length, count, date)
  }
  assert.deepEqual(timeChoices('2030-01-07', now), [])
  assert.deepEqual(timeChoices('2029-12-31', now), [])
  assert.deepEqual(timeChoices('invalid', now), [])
  assert.equal(formatTime('12:00'), '12 pm')
  assert.equal(formatTime('17:30'), '5:30 pm')
})

test('today only offers future times and revalidates dates and times against the current clock', () => {
  const evening = new Date(Date.UTC(2030, 0, 1, 9, 30))
  assert.equal(timeChoices('2030-01-01', evening)[0], '18:00')
  assert.ok(validateReservation(valid, evening).time)
  assert.deepEqual(timeChoices('2030-01-01', new Date(Date.UTC(2030, 0, 1, 13, 31))), [])
  assert.ok(validateReservation(valid, new Date(Date.UTC(2030, 0, 2, -8, 1))).date)
  assert.ok(validateReservation({ ...valid, time: '21:30' }, new Date(Date.UTC(2030, 0, 1, 14, 0))).date)
})

test('rejects invalid and tampered fields while accepting valid party boundaries', () => {
  assert.deepEqual(validateReservation(valid, now), {})
  for (const guests of ['1', '8']) assert.deepEqual(validateReservation({ ...valid, guests }, now), {})
  for (const guests of ['', '0', '9', '-1', '2.5', 'two', '02']) {
    assert.ok(validateReservation({ ...valid, guests }, now).guests, guests)
  }
  for (const email of ['', 'a@', '@example.com', 'a b@example.com', 'a@example', 'a'.repeat(243) + '@example.com']) {
    assert.ok(validateReservation({ ...valid, email }, now).email, email)
  }
  for (const name of ['', '   ', 'a'.repeat(101)]) {
    assert.ok(validateReservation({ ...valid, name }, now).name)
  }
  for (const date of ['', '2029-12-30', '2030-02-29', '2030-01-07']) {
    assert.ok(validateReservation({ ...valid, date }, now).date, date)
  }
  for (const time of ['', '12:00', '17:15', '22:00', '99:00']) {
    assert.ok(validateReservation({ ...valid, time }, now).time, time)
  }
  assert.deepEqual(validateReservation({ ...valid, name: '  李  ', email: ' ada@example.com ' }, now), {})
})
