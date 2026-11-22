# Restaurant Reservation System — Phase 4

Ember & Olive is a fictional restaurant. Use sample customer details. The form shows live availability and saves pending requests. A time shown, a review, and a receipt each leave the table available for confirmation.

## Run locally

Use Node 24. Run `npm.cmd install`, then start `npm.cmd run dev:api` and `npm.cmd run dev` in separate terminals. Open the Vite URL. Vite proxies /api to 127.0.0.1:3001. For a production smoke test, run `npm.cmd run build` and `npm.cmd run preview` with the API running.

SQLite defaults to data/reservations.sqlite. Set RESERVATION_DB to use another file. Keep the file private. The app keeps form details and the current retry key in memory and excludes customer details from request logs.

## Availability and assignment

- `GET /api/availability?date=2030-01-01&guests=4` accepts a real Manila date from today onward and an integer from 1 to 8. It returns only a times array of HH:mm start times, with caching disabled. Invalid inputs return 400. A closed or fully occupied day returns an empty array.
- Four fictional tables seat 2, 4, 6 and 8. Each party uses one table. Visits last 60 minutes, start on the half hour and must finish by closing. Mondays are closed. Today’s start times must still be in the future in Asia/Manila.
- Only internal server code can call assignTable. It takes a SQLite write lock with BEGIN IMMEDIATE before rechecking the clock, capacity and overlapping assignments. It chooses the smallest free table that fits. A second connection waits for the first writer and checks the committed schedule. A visit can start at the exact minute another ends.
- An assignment row records confirmation. The original pending request remains the submission record. Reconfirming an assigned request returns its existing table. When no table fits or the time is no longer eligible, the service returns null. There is no public confirmation, admin or request-list endpoint.

## Requests, retries and migration

- `GET /api/health` checks SQLite. `POST /api/reservation-requests` accepts JSON with name, email, numeric guests, date and time. Success returns 201 with id, createdAt (UTC) and pending status. Invalid fields return 400, unsupported content types 415 and oversized JSON 413.
- The form sends a random Idempotency-Key on explicit submission. Repeating the key and normalized details returns the original receipt, even after the requested time passes. Changed details with the same key return 409. Phase 3 clients can omit the header, in which case each POST creates a new request. Retry from the same open form after an uncertain response. Reloading clears its in-memory key.
- Back up the database with the API stopped before upgrading. Startup migrates schema version 1 to 2 in one transaction, keeping existing rows and adding a nullable retry key, a unique index, inventory and assignments. Older requests that end after closing remain on file but cannot be assigned. Unknown schema versions are rejected. To roll back to Phase 3, stop the API, retain a copy of the upgraded database for any newer records, and restore the pre-upgrade backup with the Phase 3 code.

## Verification

Run `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build` and `git diff --check`. The contention test starts two Node processes with separate connections to the same temporary SQLite file.

## Manual acceptance checklist

1. Open /api/health through Vite and check for ok. At phone and desktop widths, navigate by keyboard and review invalid-field announcements and focus.
2. Select a future Tuesday and eight guests. Check that 17:00 through 21:00 can appear on an empty schedule. Switch to Monday and verify the time control is unavailable.
3. Throttle the network and change date or party size. Check the loading state and that only the newest lookup supplies choices. Stop the API, change date, restart the API and use Retry availability.
4. Review fictional details. Inspect Network for a lookup containing only date and guests. Send once and verify a pending receipt. Look up the same slot again and verify it remains available.
5. Replay the POST with the same key and body. Check for the same reference. Change the party size with the same key and verify 409. Check that browser storage contains no customer details.
6. Restart the API with the same database and replay the original POST. Verify the same receipt and that GET /api/reservation-requests returns 404.
