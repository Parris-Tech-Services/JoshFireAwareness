# 🔥 FireReady (JoshFireAwareness)

A calm, non-official **household fire-readiness practice tool**. It helps a household get
*ready* — a readiness checklist and scenario practice — and points clearly to the **official**
sources for live warnings. It does **not** provide alerts or real-time data.

> ⚠️ **Not official advice. Not a live warning service.** In an emergency call **000** and
> always follow **NSW RFS**, **BOM**, **ABC Emergency**, and local authorities.

## Features

- **Readiness checklist** — documents, medications, pets, kids, water, power, go-bag, car fuel,
  communication plan. Ticks saved to localStorage with a progress bar.
- **Scenario practice** — think through calm responses to *Watch and Act nearby*, *Power outage*,
  *Smoke in the area*, and *Leaving early*, with plain-English feedback.
- **Official sources** — quick links to RFS, Hazards Near Me, BOM, ABC Emergency (and VicEmergency).

## What changed from the old version

The earlier version pulled live Victorian (Bendigo) emergency data via a serverless proxy and
implied real-time warnings. That has been **removed**. This is now a generic, location-neutral
*practice* tool with strong disclaimers and no data scraping.

## Run

Static, single file:

```bash
start index.html        # Windows — or
python -m http.server 8000
```

## Status

See [STATUS.md](STATUS.md). **Working MVP** — checklist + scenarios + official links.

## Privacy
No accounts, no live data, no tracking. Checklist state stays in your browser.
