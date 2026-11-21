# Restaurant Reservation System — Phase 2

A React + TypeScript + Vite homepage and interactive customer reservation demo for the fictional Ember & Olive restaurant. All restaurant details are demo content. Submitting displays a review summary only: it does not check availability, create a booking, or send a confirmation. There are no accounts, backend APIs, databases, or external services.

## Reservation form

Enter a customer name, email, 1–8 guests, date, and time. All fields are required. Whitespace-only names, malformed email addresses, invalid/past dates, Mondays, and times outside the illustrative choices are rejected. Error messages are linked to their fields; submission focuses the first invalid field. Valid submission focuses the review heading. You can edit your details or clear them.

Time choices are every 30 minutes from opening until the last half hour before closing:

- Monday: closed.
- Tuesday–Thursday: 5 pm–9:30 pm (closes at 10 pm).
- Friday–Saturday: noon–10:30 pm (closes at 11 pm).
- Sunday: noon–8:30 pm (closes at 9 pm).

These are **not verified availability**. Dates and times use the visitor's local clock because this fictional restaurant has no assigned timezone. Today is allowed only when a future sample time remains. Validation checks the clock again on submission, so a date or time that became past while the page was open is rejected. Changing the date clears the selected time. Guests are limited to 1–8 for this demo, not based on restaurant capacity.

Customer details stay in React state only. The app does not write them to browser storage, cookies, URLs, files, logs, or network requests. Clear details, reload, or unmount the page to discard them. Browser autofill is disabled on the form, although browsers control whether they honor that setting. Use fictional details when trying the demo.

## Development

Use Node 24 and npm. In PowerShell, use `npm.cmd` if script execution blocks `npm.ps1`.

- `npm.cmd install` installs dependencies.
- `npm.cmd run dev` starts the local development server.
- `npm.cmd run lint` checks code with Oxlint.
- `npm.cmd test` runs the component tests once.
- `npm.cmd run typecheck` checks TypeScript without a production bundle.
- `npm.cmd run build` checks TypeScript and builds to `dist/`.
- `npm.cmd run preview` serves the production build locally.

## Structure

- `src/App.tsx`: homepage content and section composition.
- `src/components/Layout.tsx`: header/navigation and footer.
- `src/components/ReservationForm.tsx`: controlled inputs, validation errors, and review/edit/clear flow.
- `src/components/FormField.tsx`: reusable label, control, and linked error layout.
- `src/reservations.ts`: shared opening hours, local date/time helpers, and validation.
- `src/index.css`: shared typography, colors, controls, and accessibility styles.
- `src/App.css`: page layouts, responsive rules, and decorative CSS plate artwork.
- `tests/homepage.test.mjs`: server-rendered homepage regression checks.
- `tests/reservation-form.test.mjs`: real React interaction tests using Testing Library and jsdom.
- `tests/reservations.test.mjs`: date, opening-hours, clock-boundary, and field-validation tests.
- `tests/setup-dom.mjs`: DOM environment for interaction tests.
- `src/main.tsx`: React entry point. `index.html` provides the document title and description.

Components are reusable functions that return page markup. Controlled inputs take their values from React state, so editing, clearing, and review all use the same details. Pure validation functions return field errors without saving or sending anything. The homepage hours and form choices share one schedule to prevent them drifting apart.

Original scaffold assets remain in place, unused. Phase 1 history is preserved. Phase 2 work is on `feat/phase-2-reservation-form` and is not committed.

## Manual acceptance

1. Run the dev server and inspect at 1440, 768, 375, and 320 pixels wide; check wrapping, readability, and no horizontal scrolling.
2. Use Tab and Enter: the skip link appears, focus is visible, and every navigation link reaches its section.
3. Confirm one main heading, coherent section headings, and a named navigation region with a screen reader.
4. Confirm the demo banner, fictional address/hours, and preview disclaimer are visible.
5. Submit the empty form: errors appear, the name field receives focus, and no review appears. Verify whitespace-only names and malformed email addresses are rejected.
6. Try a past date and Monday; both are rejected. Confirm Tuesday–Thursday evening hours, Friday/Saturday lunch-to-evening hours, and Sunday hours match the published schedule. Closing time itself is not offered.
7. Choose a time, then change the date: the time clears. For today, elapsed times should not be offered; submission also rejects an elapsed selection if the page was left open.
8. Fill valid fictional details and select a future time. Review shows all five fields, focuses its heading, and clearly states that nothing is booked or confirmed.
9. Edit a reviewed detail and review again; verify the summary updates. Clear details and verify the form empties (guests return to 2). Reload while details are filled and verify they are gone.
10. In browser developer tools, verify submitting creates no network request and adds no customer data to storage or the URL. Repeat at mobile widths and on the production preview; inspect the console for errors.

Learning summary: controlled inputs keep form values in React state; pure validation makes edge cases easy to test; linked errors and intentional focus movement help keyboard and screen-reader users recover from mistakes. A review summary is not a booking confirmation.


