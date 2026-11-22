import './setup-dom.mjs'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createElement } from 'react'
import { cleanup, waitFor, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../node_modules/.tmp/homepage-test/App.js'

import { timeChoices } from '../src/reservations.ts'

async function lookup(url) {
  const query = new URL(url, 'http://localhost')
  assert.equal(query.pathname, '/api/availability')
  assert.deepEqual([...query.searchParams.keys()], ['date', 'guests'])
  return Response.json({ times: timeChoices(query.searchParams.get('date')) })
}

afterEach(cleanup)

// Keep fixtures in the future without depending on the production date helpers.
function futureDate(weekday) {
  const date = new Date()
  date.setDate(date.getDate() + 14 + (weekday - date.getDay() + 7) % 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function selectDate(value) {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value } })
}

test('empty submission exposes associated errors and focuses the first invalid field', async () => {
  const user = userEvent.setup()
  render(createElement(App))
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  const name = screen.getByLabelText('Customer name')
  assert.equal(document.activeElement, name)
  for (const label of ['Customer name', 'Email', 'Date', 'Time']) {
    const input = screen.getByLabelText(label)
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    const errorId = input.getAttribute('aria-describedby').split(' ').at(-1)
    assert.ok(document.getElementById(errorId)?.textContent)
  }
  assert.equal(screen.queryByRole('heading', { name: 'Review your details' }), null)
})

test('rejects whitespace names, malformed email and a past date without navigating', async () => {
  const user = userEvent.setup()
  render(createElement(App))
  await user.type(screen.getByLabelText('Customer name'), '   ')
  await user.type(screen.getByLabelText('Email'), 'not-an-email')
  selectDate('2000-01-01')
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  for (const label of ['Customer name', 'Email', 'Date']) {
    assert.equal(screen.getByLabelText(label).getAttribute('aria-invalid'), 'true')
  }
  assert.equal(window.location.pathname, '/')
  assert.equal(screen.queryByRole('heading', { name: 'Review your details' }), null)
})

test('time choices follow the hours, close on Monday, and reset after date changes', async context => {
  context.mock.method(globalThis, 'fetch', lookup)
  const user = userEvent.setup()
  render(createElement(App))
  const time = screen.getByLabelText('Time')
  assert.equal(time.disabled, true)
  const cases = [[2, '17:00', '21:00', 9], [5, '12:00', '22:00', 21], [6, '12:00', '22:00', 21], [0, '12:00', '20:00', 17]]
  for (const [day, first, last, count] of cases) {
    selectDate(futureDate(day))
    await waitFor(() => assert.equal(time.disabled, false))
    const options = within(time).getAllByRole('option').filter(option => option.value)
    assert.equal(options[0].value, first)
    assert.equal(options.at(-1).value, last)
    assert.equal(options.length, count)
  }
  await user.selectOptions(time, '12:00')
  selectDate(futureDate(2))
  assert.equal(time.value, '')
  selectDate(futureDate(1))
  assert.equal(time.disabled, true)
  assert.match(screen.getByText(/Closed on Mondays/).textContent, /Closed/)
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  assert.equal(screen.getByLabelText('Date').getAttribute('aria-invalid'), 'true')
})

test('valid details show an unconfirmed review, can be edited, and can be cleared', async (context) => {
  context.mock.method(globalThis, 'fetch', lookup)
  context.mock.method(window.Storage.prototype, 'setItem', () => { throw new Error('Customer details must not be persisted') })
  const user = userEvent.setup()
  const { unmount } = render(createElement(App))
  await user.type(screen.getByLabelText('Customer name'), '  Ada Lovelace  ')
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  await user.selectOptions(screen.getByLabelText('Guests'), '4')
  selectDate(futureDate(2))
  await screen.findByRole('option', { name: '5:30 pm' })
  await user.selectOptions(screen.getByLabelText('Time'), '17:30')
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  const heading = screen.getByRole('heading', { name: 'Review your details' })
  assert.equal(document.activeElement, heading)
  const review = screen.getByRole('region', { name: 'Review your details' })
  assert.ok(within(review).getByText('Ada Lovelace'))
  assert.ok(within(review).getByText('ada@example.com'))
  assert.ok(within(review).getByText('4 guests'))
  assert.ok(within(review).getByText('5:30 pm'))
  assert.ok(within(review).getByText(/No booking has been created or confirmed/))
  await user.click(screen.getByRole('button', { name: 'Edit details' }))
  assert.equal(screen.getByLabelText('Customer name').value.trim(), 'Ada Lovelace')
  assert.equal(document.activeElement, screen.getByLabelText('Customer name'))
  await user.clear(screen.getByLabelText('Customer name'))
  await user.type(screen.getByLabelText('Customer name'), 'Grace Hopper')
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  assert.ok(screen.getByText('Grace Hopper'))
  assert.equal(screen.queryByText('Ada Lovelace'), null)
  await user.click(screen.getByRole('button', { name: 'Clear details' }))
  assert.equal(screen.getByLabelText('Customer name').value, '')
  assert.equal(screen.getByLabelText('Email').value, '')
  assert.equal(screen.getByLabelText('Date').value, '')
  assert.equal(screen.getByLabelText('Time').value, '')
  assert.equal(screen.getByLabelText('Guests').value, '2')
  await user.type(screen.getByLabelText('Customer name'), 'Do not retain')
  unmount()
  render(createElement(App))
  assert.equal(screen.getByLabelText('Customer name').value, '')
  assert.equal(window.localStorage.length, 0)
  assert.equal(window.sessionStorage.length, 0)
})

test('explicit send handles an unavailable API, suppresses repeat clicks and shows a pending receipt', async context => {
  const user = userEvent.setup()
  let complete
  let attempts = 0
  const keys = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.startsWith('/api/availability?')) return lookup(url)
    keys.push(options.headers['Idempotency-Key'])
    assert.equal(JSON.parse(options.body).guests, 2)
    if (++attempts === 1) throw new TypeError('offline')
    return new Promise(resolve => { complete = resolve })
  })
  render(createElement(App))
  await user.type(screen.getByLabelText('Customer name'), 'Demo Guest')
  await user.type(screen.getByLabelText('Email'), 'demo@example.com')
  selectDate(futureDate(2))
  await screen.findByRole('option', { name: '5:30 pm' })
  await user.selectOptions(screen.getByLabelText('Time'), '17:30')
  await user.click(screen.getByRole('button', { name: 'Review details' }))
  const send = screen.getByRole('button', { name: 'Send reservation request' })
  assert.equal(attempts, 0)
  await user.click(send)
  assert.match((await screen.findByRole('alert')).textContent, /Could not verify receipt/)
  await user.dblClick(send)
  assert.equal(attempts, 2)
  assert.equal(send.disabled, true)
  assert.ok(keys[0])
  assert.equal(keys[0], keys[1])
  complete(new Response(JSON.stringify({ id: 'demo-reference', status: 'pending' }), { status: 201 }))
  const receipt = await screen.findByText(/Request received/)
  assert.match(receipt.textContent, /No table has been booked or confirmed/)
  assert.equal(document.activeElement, receipt)
  await user.click(screen.getByRole('button', { name: 'Start another request' }))
  assert.equal(document.activeElement, screen.getByLabelText('Customer name'))
  assert.equal(screen.queryByText('demo@example.com'), null)
})

test('lookup failure supports retry and ignores a response for the previous party size', async context => {
  const user = userEvent.setup()
  const replies = []
  context.mock.method(globalThis, 'fetch', () => new Promise(resolve => replies.push(resolve)))
  render(createElement(App))
  selectDate(futureDate(2))
  assert.ok(screen.getByText('Checking availability...'))
  await user.selectOptions(screen.getByLabelText('Guests'), '8')
  replies[1](new Response(null, { status: 503 }))
  await user.click(await screen.findByRole('button', { name: 'Retry availability' }))
  replies[2](Response.json({ times: ['18:00'] }))
  await screen.findByRole('option', { name: '6 pm' })
  replies[0](Response.json({ times: ['17:00'] }))
  await user.selectOptions(screen.getByLabelText('Time'), '18:00')
  assert.equal(screen.queryByRole('option', { name: '5 pm' }), null)
})
