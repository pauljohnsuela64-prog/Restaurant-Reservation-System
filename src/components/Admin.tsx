import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { formatTime } from '../reservations'

type Booking = {
  id: string, name: string, email: string, date: string, time: string, guests: number,
  status: 'pending' | 'confirmed', tableId: number | null, capacity: number | null
}

function post(path: string, body?: object) {
  return fetch('/api/admin/' + path, {
    method: 'POST', headers: { 'X-Admin-Action': '1', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
}

async function fetchBookings(signal?: AbortSignal): Promise<Booking[] | null> {
  const response = await fetch('/api/admin/requests', { signal, cache: 'no-store' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error()
  return response.json()
}

export function Admin() {
  const [rows, setRows] = useState<Booking[] | null>(null)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')

  async function load() {
    setRows(await fetchBookings())
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchBookings(controller.signal).then(bookings => {
      if (!controller.signal.aborted) setRows(bookings)
    }).catch(() => {
      if (!controller.signal.aborted) setMessage('Could not load requests. Check the API connection.')
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [])

  async function action(work: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    try { await work() }
    catch { setMessage('Could not verify the result. Refresh to check the current status.') }
    finally { setBusy(false) }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const field = event.currentTarget.elements.namedItem('password') as HTMLInputElement
    const password = field.value
    field.value = ''
    void action(async () => {
      const response = await post('login', { password })
      if (response.status === 429) setMessage('Too many attempts. Try again in 15 minutes.')
      else if (response.status === 401) setMessage('Sign-in failed. Check your passphrase.')
      else if (!response.ok) throw new Error()
      else await load()
    })
  }

  function confirm(id: string) {
    void action(async () => {
      const response = await post('requests/' + encodeURIComponent(id) + '/confirm')
      if (response.status === 401) { setRows(null); setMessage('Session expired. Sign in again.'); return }
      if (response.status === 409) setMessage('This time has passed or no suitable table remains.')
      else if (!response.ok) throw new Error()
      else setMessage('Table confirmed.')
      await load()
    })
  }

  return <main className="admin-page">
    <a href="/" className="brand">Ember &amp; Olive</a>
    <h1>{rows ? 'Reservation dashboard' : 'Admin sign in'}</h1>
    <p role="status">{message || (busy ? 'Working…' : '')}</p>
    {rows === null ? <form onSubmit={login} className="reservation-preview admin-login">
      <label>Admin passphrase<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button" disabled={busy}>Sign in</button>
    </form> : <>
      <div className="form-actions">
        <button className="secondary-button" disabled={busy} onClick={() => void action(() => load())}>Refresh</button>
        <button className="secondary-button" disabled={busy} onClick={() => void action(async () => {
          const response = await post('logout')
          if (!response.ok && response.status !== 401) throw new Error()
          setRows(null)
          setMessage('Signed out.')
        })}>Sign out</button>
      </div>
      {(['pending', 'confirmed'] as const).map(status => <section key={status}>
        <h2>{status === 'pending' ? 'Pending requests' : 'Confirmed bookings'}</h2>
        {!rows.some(row => row.status === status) && <p>None to display.</p>}
        <div className="admin-grid">{rows.filter(row => row.status === status).map(row => <article key={row.id} className="reservation-preview">
          <h3>{row.name}</h3><p>{row.email}</p>
          <p>{row.date} · {formatTime(row.time)} Manila<br />Party of {row.guests}</p>
          {row.tableId === null ? <button disabled={busy} className="button" onClick={() => confirm(row.id)}>Confirm table</button>
            : <p>Table {row.tableId} · Seats {row.capacity}</p>}
        </article>)}</div>
      </section>)}
    </>}
  </main>
}
