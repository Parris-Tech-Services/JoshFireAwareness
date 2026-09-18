# JoshFireAwareness

A personal **fire-awareness dashboard** prototype for the **Bendigo–Ballarat region of Victoria, Australia**. It surfaces fire/incident information and handy links to help with situational awareness during fire season.

---

## ⚠️ Important safety disclaimer

**This app is NOT an official emergency service and must not be relied on for safety-critical decisions.**

- It does **not** provide authoritative or guaranteed real-time fire warnings.
- It is **not** a replacement for official warnings, alerts, or evacuation instructions.
- Data shown may be **delayed, incomplete, stale, or unavailable**.

**In an emergency, call 000.**

Always follow the official sources below and the directions of emergency services and local authorities. If they tell you to leave, **leave** — regardless of anything shown in this app.

## Status

**Prototype / historical demo.** This was built around a specific Victorian location
(Bendigo/Epsom and the Bendigo↔Ballarat drive) and pulls from Emergency Management Victoria
(EMV) feeds. It is **not location-current** for users elsewhere (e.g. NSW) and is preserved
as a demonstration project rather than an actively maintained safety tool.

## Official sources (use these, not this app)

**Victoria**
- VicEmergency — https://emergency.vic.gov.au/
- CFA Victoria — https://www.cfa.vic.gov.au/
- VicEmergency Hotline — 1800 226 226

**New South Wales**
- NSW Rural Fire Service (RFS) — https://www.rfs.nsw.gov.au/
- Hazards Near Me NSW app — https://www.rfs.nsw.gov.au/hazards-near-me

**National**
- Bureau of Meteorology (BOM) — http://www.bom.gov.au/
- Emergency: **000**

## What it does

- Pulls incident/warning data via a small serverless proxy to the EMV feed
  (see [`serverless-readme.md`](serverless-readme.md), `api/emv.js`, `netlify/functions/emv.js`).
- Shows a Leaflet map, status banner, evacuation-centre helper, and quick official links.
- Works as a PWA (`service-worker.js`) with an offline banner indicating possibly-stale data.

## How to run

It's a static front end (`index.html`) plus an optional serverless proxy for the data feed.

```bash
# static preview (links/UI work; live data needs the proxy)
python -m http.server 8000
# then visit http://localhost:8000
```

For live data, deploy the included Netlify/Vercel function (`netlify/functions/emv.js` or
`api/emv.js`) per [`serverless-readme.md`](serverless-readme.md), or run
`server/emv-proxy-standalone.js`.

## Recommendation

Keep as a **portfolio/demo** project clearly labelled as a prototype. If you want a live
fire-awareness tool for your current NSW location, build on the **NSW RFS "Hazards Near Me"**
data rather than the Victorian EMV feed — and retain the disclaimers above.
