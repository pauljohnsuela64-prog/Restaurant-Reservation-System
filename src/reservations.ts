export type ReservationDetails = {
  name: string
  email: string
  guests: string
  date: string
  time: string
}

export type ReservationErrors = Partial<Record<keyof ReservationDetails, string>>

export const openingHours = [
  { label: 'Monday', days: [1], opens: null, closes: null },
  { label: 'Tuesday–Thursday', days: [2, 3, 4], opens: 17, closes: 22 },
  { label: 'Friday–Saturday', days: [5, 6], opens: 12, closes: 23 },
  { label: 'Sunday', days: [0], opens: 12, closes: 21 },
]

export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return localDateString(date) === value ? date : null
}

export function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour >= 12 ? 'pm' : 'am'}`
}

export function timeChoices(value: string, now = new Date()) {
  const date = parseLocalDate(value)
  if (!date || value < localDateString(now)) return []
  const hours = openingHours.find(row => row.days.includes(date.getDay()))
  if (hours?.opens == null || hours.closes == null) return []
  const choices: string[] = []
  for (let minute = hours.opens * 60; minute < hours.closes * 60; minute += 30) {
    if (value === localDateString(now) && minute <= now.getHours() * 60 + now.getMinutes()) continue
    choices.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`)
  }
  return choices
}

export function validateReservation(details: ReservationDetails, now = new Date()): ReservationErrors {
  const errors: ReservationErrors = {}
  if (!details.name.trim()) errors.name = 'Enter your name.'
  else if (details.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()) || details.email.trim().length > 254) {
    errors.email = 'Enter a valid email address, such as name@example.com.'
  }
  if (!/^[1-8]$/.test(details.guests)) errors.guests = 'Choose between 1 and 8 guests.'
  const date = parseLocalDate(details.date)
  if (!date) errors.date = 'Choose a valid date.'
  else if (details.date < localDateString(now)) errors.date = 'Choose today or a future date.'
  else if (date.getDay() === 1) errors.date = 'Closed on Mondays. Choose another date.'
  else if (!timeChoices(details.date, now).length) errors.date = 'No illustrative times remain. Choose another date.'
  if (!timeChoices(details.date, now).includes(details.time)) {
    errors.time = 'Choose a future illustrative time within the sample opening hours.'
  }
  return errors
}
