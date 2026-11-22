# Ember & Olive | Restaurant Reservation System

Ember & Olive is a fictional restaurant and this is a **local portfolio demo**. It models a reservation from the customer's first request through staff confirmation or cancellation. Use fictional names and addresses. The project runs on loopback and is intended for a trusted local machine.

## Features

- Live availability for parties of one to eight, using Asia/Manila dates and opening hours. Visits last 60 minutes, with half-hour start times.
- A review step and pending receipt. The form reuses its in-memory idempotency key when retrying the same submission.
- A single-admin dashboard with status filters, customer and reference search, table assignment and cancellation.
- Transactional confirmation and cancellation. SQLite serializes overlapping writes across connections. Cancelling releases the assigned table and retains the UTC cancellation timestamp.

## Stack

React and TypeScript with Vite, Express on Node.js 24, and SQLite through `node:sqlite`. Tests use Node's test runner, Testing Library and jsdom. Oxlint handles linting.

## Local setup

1. Install Node.js 24, then run `npm ci` in the workspace. On Windows PowerShell, use `npm.cmd` if script execution blocks `npm`.
2. Optionally set `RESERVATION_DB` to a private SQLite path. Use the same path for setup and the API. The default is `data/reservations.sqlite`.
3. Run `npm run setup:admin` in an interactive terminal to create the single administrator. Enter a unique passphrase twice at the hidden prompts. It must be at least 15 characters and at most 256 UTF-8 bytes.
4. Run `npm run dev:api` and `npm run dev` in separate terminals. Open `http://localhost:5173` for booking and `http://localhost:5173/admin` for administration. The browser-facing server proxies API calls to `127.0.0.1:3001`.
5. To smoke-test the built app, run `npm run build` and then `npm run preview` with the API running. Open `http://localhost:4173`. Use these exact origins for admin writes.

The API upgrades older schemas in a SQLite transaction and rejects unknown versions. Stop the API and back up the database before upgrading. To roll back, retain a private copy of the upgraded database and restore the pre-upgrade backup with its matching code.

## API behavior

| Endpoint | Behavior |
| --- | --- |
| GET /api/health | Checks the SQLite connection. |
| GET /api/availability | Accepts a Manila date and guest count. Returns available start times only. |
| POST /api/reservation-requests | Accepts name, email, numeric guests, date and time. Returns a pending receipt. Reuse an Idempotency-Key for a retry. Changed details under the same key return 409. |
| POST /api/admin/login | Accepts a JSON password and sets an admin session cookie. |
| GET /api/admin/requests | Lists requests. Optional status and q parameters filter by status and literal customer or reference substring. |
| POST /api/admin/requests/:id/confirm | Assigns a suitable free table. Repeat calls return the same assignment. Cancelled requests, elapsed times and table conflicts return 409. |
| POST /api/admin/requests/:id/cancel | Releases any assignment and records a UTC timestamp. Repeat calls return the original timestamp. |
| POST /api/admin/logout | Revokes the current session and clears the cookie. |

Unknown confirmation or cancellation references return 404. Protected routes require a valid session. Admin POSTs require an approved localhost Origin and the `X-Admin-Action: 1` header. Availability is a snapshot. A pending request leaves the table available for confirmation.

## Security and limitations

- Passwords use salted scrypt. The server stores session token digests and checks a one-hour absolute expiration. The cookie is Secure, HttpOnly, host-only and SameSite=Strict. Use a browser that supports Secure cookies on localhost.
- Five failed attempts in a 15-minute window can lock the single account, including the legitimate administrator. There is no self-service recovery or role management.
- Admin responses and request receipts use `Cache-Control: no-store`. Dashboard data can remain visible in an open tab until the next action. Sign out before leaving a shared machine. Use trusted localhost services because browser cookies span ports on the same host.
- SQLite contains contact details in plaintext. Keep the database and backups private using OS permissions. Keep request URL logging disabled because admin search terms may contain contact details.
- The retry key lasts for the open form session. Reloading clears it. Search case folding is limited to ASCII. This demo has no production hosting, monitoring or operational recovery workflow.

## Screenshots

- Customer booking form and pending receipt (screenshot pending)
- Admin dashboard and cancellation dialog (screenshot pending)

## Verification

GitHub Actions runs the following checks on Node.js 24 after a clean dependency install. The test suite exercises HTTP endpoints, browser components through jsdom, database upgrades and SQLite contention across separate processes.

```sh
npm run lint
npm test
npm run typecheck
npm run build
git diff --check
```

### Manual acceptance checklist

1. Open booking and admin pages at narrow and desktop widths. Check keyboard navigation, visible focus, validation announcements, dialog Escape and focus return.
2. Pick a future Manila date. Change the date and party size under network throttling, then stop and restart the API to check availability retry. Verify Monday closure.
3. Submit two fictional eight-person requests for one future slot. Verify pending receipts, receipt focus and unchanged availability. Replay one request with its original key and verify the same reference.
4. Verify the admin API returns 401 before sign-in. Sign in, search for both requests, confirm one and verify the other conflicts. Check the slot disappears from public availability.
5. Dismiss the cancellation dialog, then reopen it and cancel the confirmed request. Verify the UTC timestamp, released slot and rejection of reconfirmation. Sign out and check that customer details disappear.
6. Smoke-test the built preview and verify the administrator can sign in on the preview origin.

## Preparing v1.0.0

Check that both npm manifests report version 1.0.0. Complete the verification and manual checklist on a clean checkout. After CI passes on the intended release commit, the repository owner can tag that commit as `v1.0.0` and publish release notes describing the fictional local demo and its limitations.
