import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../node_modules/.tmp/homepage-test/App.js'

const html = renderToStaticMarkup(createElement(App))

test('renders the homepage landmarks and demo information', () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1)
  for (const tag of ['header', 'main', 'footer']) assert.match(html, new RegExp(`<${tag}\\b`))
  assert.match(html, /aria-label="Main navigation"/)
  assert.match(html, /Fictional name, menu, location, and opening hours/)
  assert.match(html, /Sample opening hours/)
  assert.match(html, /Fictional address/)
})

test('all navigation and skip links resolve to page sections', () => {
  const links = [...html.matchAll(/href="#([^"]+)"/g)]
  assert.ok(links.length >= 6)
  for (const [, id] of links) assert.ok(html.includes(`id="${id}"`), `Missing target: ${id}`)
  assert.match(html, /class="skip-link" href="#main"/)
})

test('reservation preview cannot submit or collect bookings', () => {
  assert.match(html, /<fieldset disabled="" aria-describedby="reservation-note">/)
  assert.match(html, /<label>Date<input type="date"/)
  assert.match(html, /<label>Guests<select/)
  assert.match(html, /<button[^>]*type="button" disabled=""/)
  assert.match(html, /This demo cannot check availability or book a table/)
  assert.match(html, /No information is collected or saved/)
  assert.doesNotMatch(html, /<form\b/)
})

