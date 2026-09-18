# JoshFireAwareness — To Do List

**Generated:** 2026-01-10

This document lists prioritized improvements, their short descriptions, and current status (kept in-app via the todo tool).

- [x] Finalize incident feed reliability (ArcGIS/EMV fallback)
  - Ensure the app uses a reliable incident source with a robust fallback or a small server-side proxy to avoid CORS and rate-limit issues.

- [In progress] Add Wind Compass card (BOM wind API)
  - Integrate BOM or other weather API to show current wind direction, speed, and an emoji compass. Use this for route/departure guidance.

- [x] Add Incident Level Explainer modals (Emergency / Watch & Act / Advice)
  - Add three small modal popups with plain-language Australian emergency definitions and recommended actions.

- [x] Kids-specific travel checklist (Sylvie & Elias)
  - Replace generic checklist with child-specific items (nappies, wipes, snacks, comfort toys, car-seat checks).

- [x] Improve map performance: marker clustering & lazy rendering
  - Use Leaflet.markercluster (or cluster on the fly) and avoid rendering >200 markers at once; batch updates when refreshing.

- [x] Add offline support (service worker + cached tiles/assets)
  - Implement a service worker to cache the app shell and essential assets. Consider tile caching strategy or an offline map snapshot.

- [In progress] Add push/SMS notifications (opt-in alerts)
  - Add optional push notifications (web push) or integrate an SMS gateway for `I'm safe` check-ins and incident alerts.

- [ ] Accessibility improvements (ARIA, keyboard, color contrast)
  - Add ARIA labels, keyboard navigation, descriptive alt text, and ensure color contrast meets WCAG AA.

- [ ] Mobile polish & responsive testing (iPhone/Android)
  - Test on common devices, fix layout breakpoints, touch targets, and font scaling.

- [ ] Deploy to GitHub Pages + add simple CI
  - Create a GitHub repo, push `index.html` and `docs/`, enable Pages; add GH Actions to lint and deploy.

- [ ] Add test suite (unit + integration) and linting
  - Add lightweight tests for core utilities (haversine, risk scoring) and basic DOM integration tests; add ESLint/Prettier.

- [ ] Add logging/error reporting (Sentry or similar)
  - Capture runtime errors and key usage metrics to help debug issues in the field.

---

Notes:
- The app's formal todo state is tracked in the app (`manage_todo_list`). Keep that in sync when you complete items.
- For immediate reliability, deploying a tiny server-side proxy (Heroku/Vercel) for incident fetches is recommended.

- [x] Add Countdown Timer to header
  - Show "Time until safe departure (8:00am Sat)" in the header and update every 60s.

- [ ] Clean up old files (delete duplicates, zip)
  - Remove `josh-fire-awareness.html`, `JoshFireAwareness/`, and `JoshFireAwareness.zip` per audit recommendations.

- [x] Add Monitoring Plan & Rapid-Check Prompt (30-60min cadence)
  - Add a rapid-check prompt and short monitoring checklist in the docs for hourly checks (VicEmergency, BOM wind change, road closures).

- [x] Add favicon & small branding assets
  - Create a small favicon and app title so Live Server / GitHub Pages doesn't 404 on `favicon.ico`.

- [x] Add contextual help tooltips / incident dictionary
  - Add inline tooltips and a small incident dictionary for terms like "spotting", "crowing", "contained".

- [ ] Add evacuation centre dynamic lookup
  - Add optional dynamic lookup for evacuation/relief centres from council or EMV sources (low priority).

---

## New Ideas (Feature Additions - 10)

- [ ] Live smoke plume map overlay (satellite + wind)
- [ ] Safe routes comparison with "avoid fire zones" toggle
- [ ] Local CFA/SES radio stream embed with one-tap play
- [ ] Neighborhood check-in map (family pins)
- [ ] Fire danger rating forecast card (next 3 days)
- [ ] Battery saver mode (reduced refresh + lighter map)
- [ ] Emergency packing timer with checklist countdown
- [ ] Air quality index (AQI) and smoke health warnings
- [ ] Nearby evacuation centers map + capacity notes
- [ ] Trip log timeline (depart/arrive/updates)

## New Ideas (Upgrades - 10)

- [ ] Add PWA install banner + app icon set
- [ ] Add caching for map tiles (offline snapshot)
- [ ] Add incident severity filters (watch/advice/controlled)
- [ ] Add map style toggle (terrain/satellite)
- [ ] Add route pinch-zoom performance optimizations
- [ ] Add resilient telemetry/logging to localStorage
- [ ] Add "last verified by" stamp for updates
- [ ] Add robust error UI with guided recovery steps
- [ ] Add multi-location profiles (home/work/parents)
- [ ] Add secure export/import of settings

## New Ideas (Improvements - 10)

- [ ] Improve color contrast for badges and buttons
- [ ] Improve accessibility: keyboard focus trap in modals
- [ ] Improve copy tone for calm/clear language
- [ ] Improve map legend for statuses + icons
- [ ] Improve empty states with clear next steps
- [ ] Improve day card templates (today/tomorrow presets)
- [ ] Improve mobile spacing on small screens
- [ ] Improve incident list sorting options
- [ ] Improve GPS permission guidance
- [ ] Improve offline notice banner

10 Cool Features (IDs 19–28):

Real-time fire perimeter visualization
Air quality & smoke forecasting
Multi-route risk scoring
Family location sharing
Emergency contact cards + SMS templates
Fire Hazard Index (FHI) integration
Fuel consumption calculator
Photo/video incident reporting
Fuel load alerts
Trip sharing with live updates
10 Upgrades (IDs 29–38):

Dark/Light mode toggle
Multi-language support
SMS/WhatsApp alerts
Calendar integration
Historical incident analysis
Animated BOM radar
Offline map pre-caching UI
Location history trail
Vehicle telemetry integration
Settings/preferences page
10 Improvements (IDs 39–48):

Better error & retry UI
Incident search/filter
Incident timeline view
Performance dashboard
WCAG AAA compliance
Print-friendly route card
Geofence alerts
Battery optimization
Screen reader optimization
Haptic feedback options