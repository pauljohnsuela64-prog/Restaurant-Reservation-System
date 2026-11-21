# Restaurant Reservation System — Phase 1

A React + TypeScript + Vite homepage for the fictional Ember & Olive restaurant. All restaurant details are demo content. There are no bookings, accounts, APIs, or databases; the reservation preview is deliberately disabled and collects nothing.

## Development

Use Node 24 and npm. In PowerShell, use `npm.cmd` if script execution blocks `npm.ps1`.

- `npm.cmd install` installs dependencies.
- `npm.cmd run dev` starts the local development server.
- `npm.cmd run lint` checks code with Oxlint.
- `npm.cmd test` runs the component tests once.
- `npm.cmd run build` checks TypeScript and builds to `dist/`.
- `npm.cmd run preview` serves the production build locally.

## Structure

- `src/App.tsx`: homepage content and section composition.
- `src/components/Layout.tsx`: header/navigation and footer.
- `src/components/ReservationPreview.tsx`: disabled, explicitly labeled booking preview.
- `src/index.css`: shared typography, colors, controls, and accessibility styles.
- `src/App.css`: page layouts, responsive rules, and decorative CSS plate artwork.
- `tests/homepage.test.mjs`: server-rendered page checks using the built-in Node test runner.
- `src/main.tsx`: React entry point. `index.html` provides the document title and description.

Components are reusable functions that return page markup. Anchor links jump to matching section IDs. A disabled fieldset keeps the preview controls inactive without booking logic.

Original scaffold assets remain in place, unused. Git history is preserved; implementation is not committed.

## Manual acceptance

1. Run the dev server and inspect at 1440, 768, 375, and 320 pixels wide; check wrapping, readability, and no horizontal scrolling.
2. Use Tab and Enter: the skip link appears, focus is visible, and every navigation link reaches its section.
3. Confirm one main heading, coherent section headings, and a named navigation region with a screen reader.
4. Confirm the demo banner, fictional address/hours, and preview disclaimer are visible.
5. Confirm date, guests, and reservation button are disabled and no booking can be submitted.
6. Repeat on the production preview; inspect the browser console for errors.

Learning summary: semantic HTML gives the page structure; React components group reusable markup; CSS grid and media queries adapt the same content to smaller screens.


