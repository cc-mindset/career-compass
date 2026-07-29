# Clarity Coach — Guest-First Prototype (React)

A React + TypeScript port of the Clarity Coach guest-first prototype (`v7`). It reproduces
the original single-file HTML prototype: same markup, same CSS class names, same hash
routes, and the same demo-state navigator.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on <http://localhost:3002>.

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build
npx tsc --noEmit   # type-check only
```

## How it is put together

- **Routing** is hash based, matching the prototype exactly (`#landing`,
  `#pivot-preview`, `#job-workspace-result`, `#prototype-new-account-3`, …).
  `src/views/RouteRenderer.tsx` maps the current hash to a view.
- **State** lives in a single context, `src/state/contexts/ClarityContext.tsx`. Every view
  reads and updates it through the `useClarity()` hook — there is no local persistence
  beyond the theme preference.
- **Styling** is the prototype stylesheet, imported once in `src/index.tsx`. Components
  reuse the original class names, so visual changes belong in
  `src/styles/prototype.css`.

```
src/
  App.tsx                     provider + route renderer + global overlays
  components/                 shared layout, dashboard shell, forms, skill picker
  consts/                     option lists, initial state, demo states
  state/contexts/             ClarityContext (state, navigation, toasts, theme)
  types/                      shared domain types
  views/
    landing/                  marketing page and tool chooser
    auth/                     sign in and sign up (guest and direct)
    guest/                    guest input, processing and preview journeys
    dashboard/                Home states, tool dashboards, Skills Match
    job-workspace/            Job Analyzer empty / history / new / review / result
    career-profile/           Career Profile, Account Profile and their modals
    new-account/              eight-step prototype new-account walkthrough
```

## Demo navigator

The floating **Demo states** button opens the same panel as the prototype. It jumps
straight to any of the 21 scripted states (guest journeys, dashboard variants, profile
gating) and can step through them in sequence, which is the quickest way to review the
whole flow.
