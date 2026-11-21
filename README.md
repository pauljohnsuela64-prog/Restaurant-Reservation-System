# Restaurant Reservation System - Phase 3

A local React and Express demo for the fictional Ember & Olive restaurant. Use sample customer details. Requests are stored as pending. Sample times do not indicate availability, and a receipt never confirms a table.

## Run locally

Use Node 24 and run npm.cmd install. Start npm.cmd run dev:api in one terminal and npm.cmd run dev in another. Open the Vite URL. Vite proxies /api to the Express server at 127.0.0.1:3001. For a production build smoke test, use npm.cmd run build and npm.cmd run preview with the API running.

The API creates data/reservations.sqlite by default. Set RESERVATION_DB in the API process environment to use another file. Keep it private and back it up before changing schema versions. The default data directory, SQLite files and environment files are ignored. The app does not put customer details in browser storage or request logs.

## API and data

- GET /api/health checks SQLite and returns its status.
- POST /api/reservation-requests accepts JSON with name, email, numeric guests (1-8), date (YYYY-MM-DD), and time (HH:mm). Invalid fields return 400, unsupported content types return 415, and oversized JSON returns 413. Success returns 201 with a UUID, a UTC createdAt timestamp, and pending status.
- Opening hours and requested dates/times use Asia/Manila. Mondays are closed. The server validates the same 30-minute sample choices as the form, including rejection of elapsed times.
- server/api.ts initializes SQLite using a transaction and PRAGMA user_version. It refuses unknown schema versions. createApi validates normalized input and inserts rows using bound SQL parameters. There is no request-list endpoint.
- src/reservations.ts shares the schedule and validation between React and Express. ReservationForm.tsx reviews details in memory and sends them only on explicit action. It blocks repeat clicks during a request. If receipt cannot be verified, a manual retry may create a second request.

## Verification

Run npm.cmd run lint, npm.cmd test, npm.cmd run typecheck, npm.cmd run build, and git diff --check. Tests exercise the real HTTP API against a temporary SQLite file and reopen it to check persistence. Frontend tests cover validation, explicit submission, unavailable API and repeat clicks.

## Manual acceptance

1. Start both processes. Open /api/health through Vite and verify status ok.
2. At desktop and mobile widths, keyboard through the form. Try an invalid email, past Manila date and Monday. Check error text and focus.
3. Enter fictional details and review them. Verify no POST appears in browser Network until Send reservation request.
4. Send and verify one POST, a pending receipt and a reference. Verify no booking confirmation or availability claim and no browser storage entry.
5. Stop the API and send a new sample request. Verify an error appears and the review remains available. Restart the API and try again.
6. Restart with the same database path. Inspect the prior pending row in SQLite locally and verify GET /api/reservation-requests still returns 404.
