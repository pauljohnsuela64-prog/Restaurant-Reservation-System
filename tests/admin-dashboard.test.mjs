import './setup-dom.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../node_modules/.tmp/homepage-test/App.js'

test('dashboard signs in, confirms a pending request and clears private details on logout', async t => {
  window.history.replaceState(null, '', '/admin')
  t.after(() => { cleanup(); window.history.replaceState(null, '', '/') })
  let authenticated = false
  let confirmed = false
  let cancelled = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      assert.equal(options.headers['X-Admin-Action'], '1')
      if (url.endsWith('/login')) authenticated = true
      else if (url.endsWith('/logout')) authenticated = false
      else if (url.endsWith('/cancel')) cancelled = true
      else { assert.equal(url, '/api/admin/requests/sample/confirm'); confirmed = true }
      return new Response(null, { status: 204 })
    }
    if (url.includes('?')) assert.ok(url.endsWith('?status=cancelled&q=sample'))
    return authenticated ? Response.json([{ id: 'sample', name: 'Demo Guest', email: 'demo@example.com', date: '2030-01-01', time: '17:00', guests: 2,
      cancelledAt: cancelled ? '2030-01-01T00:00:00.000Z' : null,
      status: cancelled ? 'cancelled' : confirmed ? 'confirmed' : 'pending', tableId: confirmed && !cancelled ? 1 : null, capacity: confirmed ? 2 : null }]) : new Response(null, { status: 401 })
  })
  render(createElement(App))
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Admin passphrase'), 'fictional input')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await user.click(await screen.findByRole('button', { name: 'Confirm table' }))
  await screen.findByText(/Table 1 .* Seats 2/)
  await user.selectOptions(screen.getByLabelText('Status'), 'cancelled')
  await user.type(screen.getByLabelText('Customer or reference'), 'sample')
  const modal = screen.getByRole('dialog', { hidden: true })
  modal.showModal = () => modal.setAttribute('open', '')
  modal.close = () => modal.removeAttribute('open')
  await user.click(screen.getByRole('button', { name: 'Cancel reservation' }))
  await user.click(screen.getByRole('button', { name: 'Keep reservation' }))
  assert.equal(cancelled, false)
  await user.click(screen.getByRole('button', { name: 'Cancel reservation' }))
  await user.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
  await screen.findByText('2030-01-01T00:00:00.000Z')
  await user.click(screen.getByRole('button', { name: 'Apply filters' }))
  await screen.findByText('2030-01-01T00:00:00.000Z')
  assert.equal(screen.queryByRole('heading', { name: 'Confirmed bookings' }), null)
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByLabelText('Admin passphrase')
  assert.equal(screen.queryByText('demo@example.com'), null)
})
