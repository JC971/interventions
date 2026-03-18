# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Type-check (tsc -b) then build for production
npm run lint      # Run ESLint on all files
npm run preview   # Preview production build locally
```

No test runner is configured.

## Architecture

Single-page React 19 application (Vite + JSX) for managing property interventions. No backend — all data persists in **localStorage**. PWA-ready with a service worker.

### Entry points
- `src/main.jsx` — React root mount + service worker registration
- `src/index.js` — Injects global styles, registers SW with update notification
- `src/App.jsx` — Entire application (~1700 lines): all components, hooks, and state

### Everything lives in `src/App.jsx`
There is no component folder. All components, custom hooks, and business logic are co-located in a single file:

- **Custom hooks:** `useWindowSize()`, `useOnlineStatus()`, `useInstallPrompt()`
- **Small components:** `OfflineBanner`, `InstallBanner`, `Badge`, `InfoRow`, `InterventionCard`, `LoginModal`, `InterventionModal`, `MobileHeader`, `DesktopHeader`
- **Main `App` component:** holds all state (localStorage read/write), filtering logic, CRUD operations

### Data model
```js
Intervention {
  id: number,
  bien: string,          // property name
  adresse: string,
  date: string,          // ISO date
  heureDebut: string,    // "HH:MM"
  heureFin: string,      // "HH:MM"
  intervenant: string,
  etatGeneral: "bon" | "moyen" | "mauvais",
  remarques?: string,
  createdBy: string,
  createdAt: string,
  updatedAt?: string
}
```

### Auth & roles
Hardcoded test users (no real auth). Admin sees all interventions; `intervenant` role sees only their own.

### Styling
All styles are inline JS objects — no CSS framework, no CSS modules, no Sass. Color palette: blue/purple gradients (`#667eea`, `#764ba2`); status colors green/orange/red.

### Responsive
Mobile breakpoint at 768px, detected via `useWindowSize()`. Separate `MobileHeader` and `DesktopHeader` components.

### Localization
UI is entirely in French.
