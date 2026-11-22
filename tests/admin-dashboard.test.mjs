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
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') {
      assert.equal(options.headers['X-Admin-Action'], '1')
      if (url.endsWith('/login')) authenticated = true
      else if (url.endsWith('/logout')) authenticated = false
      else { assert.equal(url, '/api/admin/requests/sample/confirm'); confirmed = true }
      return new Response(null, { status: 204 })
    }
    return authenticated ? Response.json([{ id: 'sample', name: 'Demo Guest', email: 'demo@example.com', date: '2030-01-01', time: '17:00', guests: 2,
      status: confirmed ? 'confirmed' : 'pending', tableId: confirmed ? 1 : null, capacity: confirmed ? 2 : null }]) : new Response(null, { status: 401 })
  })
  render(createElement(App))
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Admin passphrase'), 'fictional input')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await user.click(await screen.findByRole('button', { name: 'Confirm table' }))
  await screen.findByText(/Table 1 .* Seats 2/)
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByLabelText('Admin passphrase')
  assert.equal(screen.queryByText('demo@example.com'), null)
})
