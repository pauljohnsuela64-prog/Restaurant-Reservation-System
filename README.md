# Restaurant Reservation System — Phase 5

Ember & Olive is a fictional restaurant. Use sample customer details. The form shows live availability and saves pending requests. A time shown, a review, and a receipt each leave the table available for confirmation.

## Run locally

Use Node 24. Run `npm.cmd install`, then start `npm.cmd run dev:api` and `npm.cmd run dev` in separate terminals. Open the Vite URL. Vite proxies /api to 127.0.0.1:3001. For a production smoke test, run `npm.cmd run build` and `npm.cmd run preview` with the API running.

SQLite defaults to data/reservations.sqlite. Set RESERVATION_DB to use another file. Keep the file private. The app keeps form details and the current retry key in memory and excludes customer details from request logs.

## Availability and assignment

- `GET /api/availability?date=2030-01-01&guests=4` accepts a real Manila date from today onward and an integer from 1 to 8. It returns only a times array of HH:mm start times, with caching disabled. Invalid inputs return 400. A closed or fully occupied day returns an empty array.
- Four fictional tables seat 2, 4, 6 and 8. Each party uses one table. Visits last 60 minutes, start on the half hour and must finish by closing. Mondays are closed. Today’s start times must still be in the future in Asia/Manila.
- Only internal server code can call assignTable. It takes a SQLite write lock with BEGIN IMMEDIATE before rechecking the clock, capacity and overlapping assignments. It chooses the smallest free table that fits. A second connection waits for the first writer and checks the committed schedule. A visit can start at the exact minute another ends.
- An assignment row records confirmation. The original pending request remains the submission record. Reconfirming an assigned request returns its existing table. When no table fits or the time is no longer eligible, the service returns null. The authenticated admin API is the only HTTP caller of the assignment service.

## Requests, retries and migration

- `GET /api/health` checks SQLite. `POST /api/reservation-requests` accepts JSON with name, email, numeric guests, date and time. Success returns 201 with id, createdAt (UTC) and pending status. Invalid fields return 400, unsupported content types 415 and oversized JSON 413.
- The form sends a random Idempotency-Key on explicit submission. Repeating the key and normalized details returns the original receipt, even after the requested time passes. Changed details with the same key return 409. Phase 3 clients can omit the header, in which case each POST creates a new request. Retry from the same open form after an uncertain response. Reloading clears its in-memory key.
- Back up the database with the API stopped before upgrading. Startup upgrades earlier databases transactionally. Version 2 introduced table inventory, assignments and retry keys. Version 3 adds credentials, sessions and a shared login-attempt counter, preserving reservations and assignments. Unknown versions are rejected. To roll back, stop the API, keep a private copy of the upgraded file and restore the matching pre-upgrade backup with the prior code.

## Local administrator

1. In a private interactive terminal, set RESERVATION_DB to the same path used by the API, or use the default for both commands. Restrict the database directory and backups to your OS account.
2. Run `npm.cmd run setup:admin`. Enter a unique passphrase twice at the hidden prompts (at least 15 characters and at most 256 UTF-8 bytes). Setup creates the single account once. There is no username, default password, online registration or password recovery workflow.
3. Start both processes and open `http://localhost:5173/admin` (preview uses localhost:4173). Use a browser that supports Secure cookies on localhost. Use the exact hostname and port. Cookies are shared across ports on a host, so run only trusted services on localhost in this browser profile.

The CLI stores a random salt and a Node scrypt digest (N=131072, r=8, p=1). Login uses a timing-safe comparison. Five attempts without a successful login in a 15-minute window temporarily block the entire account, including the legitimate administrator. SQLite shares the counter across processes and restarts.

Successful login issues a fresh 256-bit random session identifier in a host-only Secure, HttpOnly, SameSite=Strict cookie. SQLite keeps its SHA-256 digest and enforces a one-hour absolute expiration. Logout revokes the current session. Expired rows are pruned on successful login. Each protected request checks its session on the server. Dashboard data stays in page memory and can remain visible in an already open tab until refresh or the next action. Use Sign out before leaving a shared computer.

## Admin API

All endpoints below are under `/api/admin`. Responses disable caching. Every POST requires an allowed localhost browser Origin and the custom header `X-Admin-Action: 1`. The server grants no cross-origin access. The custom header requires a browser preflight for cross-origin scripts. The origin check also protects login and logout.

| Method and path | Result |
| --- | --- |
| POST /login | JSON body with password. Returns 204 and sets the session cookie, 401 for invalid credentials, or 429 during lockout. |
| GET /requests | Authenticated list ordered by Manila date and time, with customer name, email, party size, request status and assigned table ID and capacity. |
| POST /requests/:id/confirm | Returns the confirmed table, including on repeat. Returns 404 for an unknown request and 409 for an elapsed time or capacity conflict. |
| POST /logout | Revokes the session, clears the cookie and returns 204. |

Missing or expired sessions return 401 on protected routes. Disallowed writes return 403. This local single-admin workflow assumes a trusted machine; it provides no multi-user roles or deployment configuration.

## Verification

Run `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build` and `git diff --check`. The contention test starts two Node processes with separate connections to the same temporary SQLite file.

## Manual acceptance checklist

1. Open /api/health through Vite and check for ok. At phone and desktop widths, navigate by keyboard and review invalid-field announcements and focus.
2. Select a future Tuesday and eight guests. Check that 17:00 through 21:00 can appear on an empty schedule. Switch to Monday and verify the time control is unavailable.
3. Throttle the network and change date or party size. Check the loading state and that only the newest lookup supplies choices. Stop the API, change date, restart the API and use Retry availability.
4. Review fictional details. Inspect Network for a lookup containing only date and guests. Send once and verify a pending receipt. Look up the same slot again and verify it remains available.
5. Replay the POST with the same key and body. Check for the same reference. Change the party size with the same key and verify 409. Check that browser storage contains no customer details.
6. Restart the API with the same database and replay the original POST. Verify the same receipt and that GET /api/reservation-requests returns 404.

7. Bootstrap the administrator and visit /admin in a fresh private window. Verify the sign-in page and that /api/admin/requests returns 401 before login. Sign in with the passphrase.
8. Submit two fictional eight-person requests for the same future time. On phone and desktop widths, keyboard through the dashboard and confirm one. Verify the assigned table seats eight, the second request reports a conflict, and the public availability lookup removes the occupied time.
9. Refresh the dashboard and verify the confirmed table persists. Sign out, reload /admin and verify customer details are inaccessible. In a separate session verify expiration after one hour.
