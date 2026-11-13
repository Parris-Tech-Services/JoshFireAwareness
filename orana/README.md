# Orana Fieldnotes — independent NSW RFS learning companion

**Public website:** https://orana-fieldnotes.vercel.app/  
**Source:** `Parris-Tech-Services/JoshFireAwareness/orana/index.html`  
**Deployment:** Vercel project `orana-fieldnotes`, production branch `main`, root directory `orana`.

Orana Fieldnotes is a responsive, static, accessible study/reference site for the NSW Rural Fire Service volunteer experience in **Dubbo Regional, Burrabadine, Narromine and Orana**. This lives alongside, not instead of, the original historical Victoria-focused fire-awareness demo in this repository.

## Features

- Training pathway orientation: Member Induction, RIW, Code of Conduct, USI, BF/BFG and Firefighter 1/2 (always confirm with current RFS requirements and local officers).
- Browser-local checklist and completion count, not synced or certified.
- Meeting questions that can be copied.
- Orana BFMC region facts and illustration (decorative; explicitly not a map).
- Official live RFS incident, fire danger and permit links — **no replicated/stale warnings**.
- Direct member tools links (OneRFS, FUEL, official FireMapper guideline); secure credentials never requested.
- Search/filter for useful RFS links and 10 interactive learning questions.
- No login, analytics, third-party frontend libraries, images or member data submissions.

## Accuracy & safety

This is **independent** and **not authorised, endorsed or maintained by NSW RFS**. It is **not** incident alert software, an assessment, member certification or operational guidance. Never rely on it for emergency decisions. **Call 000** for emergencies. Follow official current [NSW RFS](https://www.rfs.nsw.gov.au/) alerts, directions and your brigade/district trainer.

Research and links were checked on **13 November 2026**. The public local area figures come from the [RFS Orana Bush Fire Management Committee](https://www.rfs.nsw.gov.au/plan-and-prepare/managing-bush-fire-risk/bush-fire-management-committees/orana): ~61% grassland, ~37% bushland, ~1.28 million hectares. The public RFS training page describes the national learning bands; a separate 2026 Orana induction letter supplied onboarding details and is **not reproduced** on the public website.

The 2025 [FireMapper official guideline](https://www.rfs.nsw.gov.au/resources/publications/doctrine/technical/firemapper) is preferred over historic 2023 rollout emails. The current RFS [Fire Danger & Total Fire Ban](https://www.rfs.nsw.gov.au/fire-information/fire-danger-ratings-and-total-fire-bans) and [BFDP/Permits](https://www.rfs.nsw.gov.au/fire-information/bush-fire-danger-period) pages should be consulted every time; no forecast is retained locally.

The fuller personalised research and original Gmail index live in a **separate private repository**, [Josh's RFS research folder](https://github.com/joshualparris/ResearchLibrary/tree/main/rfs), visible only to authorised GitHub users.

## Verification performed

- GitHub source commit on `main` confirmed.
- Vercel production deployment `dpl_JB7zJQqMC4gfSGTmrC2B7GoEAfVb` returned **READY** for source commit `bd152b19c13b0a9d18930b33b322c78fe2ab66f2`.
- Public URL fetched successfully with expected title, body sections and source links.
- Inline JavaScript compiled without syntax errors; DOM selectors, 10 quiz questions and 8 checklist tasks passed source checks.
- **Not performed:** automated browser interaction/playwright click test. The connected external browser-test tool reported insufficient wallet balance; do not represent interaction testing as verified.

## Maintenance reminders

- Recheck official dynamic links, membership onboarding requirements and local terminology each fire season.
- Never store a member number, personal home addresses, health/police records, authentication data, staff-only documents, duty rosters, restricted radio plans, incident imagery or raw emails here.
- For changes, edit `orana/index.html` on the public repository `main`; the linked Vercel production project builds automatically.
