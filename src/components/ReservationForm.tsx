import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FormField } from './FormField'
import { formatTime, localDateString, parseLocalDate, validateReservation } from '../reservations'
import type { ReservationDetails, ReservationErrors } from '../reservations'

const emptyDetails: ReservationDetails = { name: '', email: '', guests: '2', date: '', time: '' }

export function ReservationForm() {
  const [details, setDetails] = useState<ReservationDetails>(emptyDetails)
  const [errors, setErrors] = useState<ReservationErrors>({})
  const [reviewing, setReviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [submitError, setSubmitError] = useState('')
  const inFlight = useRef(false)

  const retry = useRef({ body: '', key: '' })
  const query = new URLSearchParams({ date: details.date, guests: details.guests }).toString()
  const [result, setResult] = useState<{ query: string, times: string[], failed?: boolean }>()
  const [refresh, setRefresh] = useState(0)
  const selectedDate = parseLocalDate(details.date)
  const lookup = !!selectedDate && details.date >= localDateString() && selectedDate.getUTCDay() !== 1
  useEffect(() => {
    if (!lookup) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/availability?' + query, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        })
        if (!response.ok) throw new Error()
        const { times } = await response.json()
        if (!Array.isArray(times) || !times.every(time => typeof time === 'string')) throw new Error()
        if (!controller.signal.aborted) setResult({ query, times })
      } catch {
        if (!controller.signal.aborted) setResult({ query, times: [], failed: true })
      }
    }
    void load()
    return () => controller.abort()
  }, [lookup, query, refresh])

  async function submitRequest() {
    if (inFlight.current || receipt) return
    inFlight.current = true
    setSending(true)
    setSubmitError('')
    try {
      const body = JSON.stringify({ ...details, guests: Number(details.guests) })
      if (retry.current.body !== body) retry.current = { body, key: crypto.randomUUID() }
      const response = await fetch('/api/reservation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key },
        body,
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) {
        setSubmitError(response.status === 400
          ? 'The server rejected these details. Edit them and check the date and time.'
          : 'The server could not process the request. Try again later.')
        return
      }
      const result = await response.json()
      if (response.status !== 201 || typeof result.id !== 'string' || result.status !== 'pending') throw new Error()
      retry.current = { body: '', key: '' }
      setReceipt(result.id)
      setDetails(emptyDetails)
    } catch {
      setSubmitError('Could not verify receipt. Check that the local API is running. You can retry these details safely.')
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }
  const nameRef = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLParagraphElement>(null)
  const reviewRef = useRef<HTMLHeadingElement>(null)
  const hasReviewed = useRef(false)
  const current = lookup && result?.query === query ? result : undefined
  const choices = current?.times ?? []

  useEffect(() => {
    if (receipt) {
      receiptRef.current?.focus()
    } else if (reviewing) {
      hasReviewed.current = true
      reviewRef.current?.focus()
    } else if (hasReviewed.current) {
      nameRef.current?.focus()
    }
  }, [receipt, reviewing])

  function fieldProps(field: keyof ReservationDetails) {
    const id = `reservation-${field}`
    return {
      id,
      name: field,
      value: details[field],
      required: true,
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': [field === 'time' ? 'reservation-time-hint' : '', errors[field] ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
      onChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const value = event.target.value
        if (field === 'date' || field === 'guests') setResult(undefined)
        setDetails(previous => ({ ...previous, [field]: value, ...(field === 'date' || field === 'guests' ? { time: '' } : {}) }))
        setErrors(previous => ({ ...previous, [field]: undefined, ...(field === 'date' || field === 'guests' ? { time: undefined } : {}) }))
      },
    }
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Recheck the clock on submit, including when the page has been open overnight.
    const nextErrors = validateReservation(details)
    if (!choices.includes(details.time)) nextErrors.time = 'Choose an available time.'
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      const field = firstError === 'time' && !choices.length ? 'date' : firstError
      const control = event.currentTarget.elements.namedItem(field)
      if (control instanceof HTMLElement) control.focus()
      return
    }
    setDetails(previous => ({ ...previous, name: previous.name.trim(), email: previous.email.trim() }))
    setReviewing(true)
  }

  function clear() {
    retry.current = { body: '', key: '' }
    setResult(undefined)
    setSubmitError('')
    setDetails(emptyDetails)
    setErrors({})
    setReviewing(false)
    nameRef.current?.focus()
  }

  const timeHint = selectedDate?.getUTCDay() === 1 ? 'Closed on Mondays. Choose another date.'
    : !lookup ? 'Choose today or a future date to see available times.'
    : !current ? 'Checking availability...'
    : current.failed ? 'Could not load availability.'
    : !choices.length ? 'No available times. Choose another date or party size.'
    : 'Available start times in Manila. Each visit lasts one hour.'

  return (
    <section id="reservations" className="reservation-section" aria-labelledby="reservation-heading">
      <div>
        <h2 id="reservation-heading">A seat at our table.</h2>
        <p>Long lunches, quiet celebrations, and evenings that take their time. There’s room for every occasion.</p>
        <p className="demo-note">Try the demo with sample details. Submitting does not create or confirm a booking. Availability can change before confirmation.</p>
      </div>
      <div className="reservation-preview">
        <span className="status">Demo only · No booking is made</span>
        <p id="reservation-note">Use fictional details. Reviewing keeps details only in memory. Sending a request saves them to the local demo database.</p>
        {receipt ? (
          <div>
            <p role="status" tabIndex={-1} ref={receiptRef}>Request received. Its status is pending. No table has been booked or confirmed. Reference: {receipt}</p>
            <button className="button" type="button" onClick={() => { setReceipt(''); clear() }}>Start another request</button>
          </div>
        ) : reviewing ? (
          <section aria-labelledby="review-heading" className="reservation-review">
            <h3 id="review-heading" tabIndex={-1} ref={reviewRef}>Review your details</h3>
            <p>No booking has been created or confirmed. Your selected time is not held.</p>
            <dl>
              <div><dt>Customer name</dt><dd>{details.name}</dd></div>
              <div><dt>Email</dt><dd>{details.email}</dd></div>
              <div><dt>Guests</dt><dd>{details.guests} {details.guests === '1' ? 'guest' : 'guests'}</dd></div>
              <div><dt>Date</dt><dd>{selectedDate?.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</dd></div>
              <div><dt>Time (Manila)</dt><dd>{formatTime(details.time)}</dd></div>
            </dl>
            <div className="form-actions">
              <button className="button" type="button" disabled={sending} onClick={submitRequest}>Send reservation request</button>
              <button className="secondary-button" type="button" disabled={sending} onClick={() => { setSubmitError(''); setReviewing(false) }}>Edit details</button>
              <button className="secondary-button" type="button" disabled={sending} onClick={clear}>Clear details</button>
            </div>
            {sending && <p role="status">Sending request...</p>}
            {submitError && <p role="alert" className="field-error">{submitError}</p>}
          </section>
        ) : (
          <form noValidate autoComplete="off" onSubmit={review} aria-describedby="reservation-note">
            <h3>Your next gathering</h3>
            <p className="small-print">All fields are required. Demo parties: 1–8 guests.</p>
            {Object.values(errors).some(Boolean) && <p role="alert" className="field-error">Please correct the marked fields to review your details.</p>}
            <div className="reservation-fields">
              <FormField id="reservation-name" label="Customer name" error={errors.name}>
                <input {...fieldProps('name')} ref={nameRef} type="text" maxLength={100} autoComplete="off" />
              </FormField>
              <FormField id="reservation-email" label="Email" error={errors.email}>
                <input {...fieldProps('email')} type="email" maxLength={254} autoComplete="off" spellCheck={false} />
              </FormField>
              <div className="preview-fields">
                <FormField id="reservation-guests" label="Guests" error={errors.guests}>
                  <select {...fieldProps('guests')}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(count => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}
                  </select>
                </FormField>
                <FormField id="reservation-date" label="Date" error={errors.date}>
                  <input {...fieldProps('date')} type="date" min={localDateString()} />
                </FormField>
              </div>
              <FormField id="reservation-time" label="Time" error={errors.time}>
                <select {...fieldProps('time')} disabled={!choices.length}>
                  <option value="">Choose a time</option>
                  {choices.map(time => <option key={time} value={time}>{formatTime(time)}</option>)}
                </select>
                <p id="reservation-time-hint" className="small-print" role="status">{timeHint}</p>
                {current?.failed && <button type="button" className="secondary-button" onClick={() => { setResult(undefined); setRefresh(value => value + 1) }}>Retry availability</button>}
              </FormField>
            </div>
            <div className="form-actions">
              <button className="button" type="submit">Review details</button>
              <button className="secondary-button" type="button" onClick={clear}>Clear details</button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
