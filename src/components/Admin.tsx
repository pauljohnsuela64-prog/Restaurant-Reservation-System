import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatTime } from '../reservations'

type Booking = {
  id: string, name: string, email: string, date: string, time: string, guests: number,
  status: 'pending' | 'confirmed' | 'cancelled', cancelledAt: string | null, tableId: number | null, capacity: number | null
}

function post(path: string, body?: object) {
  return fetch('/api/admin/' + path, {
    method: 'POST', headers: { 'X-Admin-Action': '1', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
}

async function fetchBookings(signal?: AbortSignal, query = ''): Promise<Booking[] | null> {
  const response = await fetch('/api/admin/requests' + query, { signal, cache: 'no-store' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error()
  return response.json()
}

export function Admin() {
  const [rows, setRows] = useState<Booking[] | null>(null)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')

  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [target, setTarget] = useState<Booking | null>(null)

  async function load(nextQuery = query) {
    setRows(await fetchBookings(undefined, nextQuery))
    setQuery(nextQuery)
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of new window.FormData(event.currentTarget)) {
      if (value) params.set(key, String(value))
    }
    void action(() => load(params.size ? '?' + params : ''))
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
      if (response.status === 409) setMessage('The request was cancelled, the time has passed, or no suitable table remains.')
      else if (!response.ok) throw new Error()
      else setMessage('Table confirmed.')
      await load()
    })
  }

  function cancel(id: string) {
    dialog.current?.close()
    heading.current?.focus()
    void action(async () => {
      const response = await post('requests/' + encodeURIComponent(id) + '/cancel')
      if (response.status === 401) { setRows(null); setMessage('Session expired. Sign in again.'); return }
      if (!response.ok) throw new Error()
      await load()
      setMessage('Reservation cancelled.')
    })
  }

  return <main className="admin-page">
    <a href="/" className="brand">Ember &amp; Olive</a>
    <h1 tabIndex={-1} ref={heading}>{rows ? 'Reservation dashboard' : 'Admin sign in'}</h1>
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
          setQuery('')
          setMessage('Signed out.')
        })}>Sign out</button>
      </div>
      <form className="form-actions admin-filters" onSubmit={filter}>
        <label>Status<select name="status" disabled={busy} defaultValue={new URLSearchParams(query).get('status') ?? ''}>
          <option value="">All statuses</option><option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
        </select></label>
        <label>Customer or reference<input name="q" type="search" maxLength={254} disabled={busy}
          defaultValue={new URLSearchParams(query).get('q') ?? ''} /></label>
        <button className="secondary-button" disabled={busy}>Apply filters</button>
      </form>
      <dialog ref={dialog} aria-labelledby="cancel-heading" onClose={() => setTarget(null)}>
        <h2 id="cancel-heading">Cancel reservation?</h2>
        {target && <p>{target.name} ? {target.date} at {formatTime(target.time)} Manila. Cancellation releases any assigned table.</p>}
        <div className="form-actions">
          <button className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>Keep reservation</button>
          <button className="button" onClick={() => { if (target) cancel(target.id) }}>Confirm cancellation</button>
        </div>
      </dialog>
      {(['pending', 'confirmed', 'cancelled'] as const)
        .filter(status => !new URLSearchParams(query).get('status') || new URLSearchParams(query).get('status') === status)
        .map(status => <section key={status} aria-busy={busy}>
        <h2>{status === 'pending' ? 'Pending requests' : status === 'confirmed' ? 'Confirmed bookings' : 'Cancelled reservations'}</h2>
        {!rows.some(row => row.status === status) && <p>None to display.</p>}
        <div className="admin-grid">{rows.filter(row => row.status === status).map(row => <article key={row.id} className="reservation-preview">
          <h3>{row.name}</h3><p>{row.email}</p>
          <p>{row.date} · {formatTime(row.time)} Manila<br />Party of {row.guests}</p>
          <p>Reference <code>{row.id}</code></p>
          {row.tableId !== null && <p>Table {row.tableId} ? Seats {row.capacity}</p>}
          {row.cancelledAt && <p>Cancelled <time dateTime={row.cancelledAt}>{row.cancelledAt}</time> (UTC)</p>}
          <div className="form-actions">
            {status === 'pending' && <button disabled={busy} className="button" onClick={() => confirm(row.id)}>Confirm table</button>}
            {status !== 'cancelled' && <button disabled={busy} className="secondary-button" onClick={() => {
              setTarget(row)
              dialog.current?.showModal()
            }}>Cancel reservation</button>}
          </div>
        </article>)}</div>
      </section>)}
    </>}
  </main>
}
