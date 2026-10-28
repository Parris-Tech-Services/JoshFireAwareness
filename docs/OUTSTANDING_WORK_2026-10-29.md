# JoshFireAwareness — outstanding engineering work (29 October 2026)

**Canonical source:** [Parris-Tech-Services/JoshFireAwareness](https://github.com/Parris-Tech-Services/JoshFireAwareness) `main`; README declares this a historical Victorian fire-awareness **prototype**, not an official live emergency service. Follow its emergency disclaimer and official-alert links. No root `AGENTS.md`, general engineering task register, or work checkpoint was found during this audit. This new general register does **not** replace or change the existing `podcasttodo.md` checklist.

**Review scope:** Reused Greptile run **36160046**, **COMPLETED** 2026-10-28 12:44:04 UTC, for [PR #6](https://github.com/Parris-Tech-Services/JoshFireAwareness/pull/6), source `privacy/remove-kids-names`, reviewed SHA `ceaaf7acf049a36ea6cf8b8ac68323eef4b4a20d`. GitHub compare proved reviewed SHA **identical** to current PR branch (0 commits ahead/behind), and PR branch is 1 commit ahead of `main` `72ec9088eeffdf93dc339b1b1b98575c2c861d6c`. One-file, one-line HTML copy change. Greptile reported confidence 5/5 and **zero inline findings**. This is **not** a whole-codebase audit, an assurance of safety, or proof of a successful browser test. **No duplicate review triggered.**

## Numbered tasks (do not renumber)

- [x] **JFA-AUD-001** [REVIEW / COMPLETE] Reconcile existing Greptile PR #6 privacy-copy review without spending review credits.
  - **Start/triage:** Read `README.md`, `index.html` on `main` and PR branch, `qa.mjs`, `verify-static.mjs`, and PR #6; check Greptile run `36160046` and zero inline comments.
  - **Evidence:** [PR #6](https://github.com/Parris-Tech-Services/JoshFireAwareness/pull/6), reviewed SHA `ceaaf7acf049a36ea6cf8b8ac68323eef4b4a20d`; source line `index.html:1109`; review completed 2026-10-28.
  - **Dependencies:** None; do not conflate review completion with a merged privacy fix.
  - **Minimal fix:** No code change requested by Greptile. Record only review status and separately track unresolved merge/release proof.
  - **Acceptance:** Same-head comparison and zero Greptile inline findings verified; review-only task complete.
  - **Closure:** Review evidence recorded here; **no production deployment or code fix claimed**.

- [ ] **JFA-AUD-002** [TRIAGE / PRIVACY] Finish and verify the already-proposed public checklist privacy correction.
  - **Start/triage:** Compare `index.html:1109` on canonical `main` and [PR #6](https://github.com/Parris-Tech-Services/JoshFireAwareness/pull/6); confirm the current public release surface and whether the obsolete copy remains exposed **without repeating any child's name or private location in reports**.
  - **Evidence:** Greptile run `36160046` (zero findings; **this is an independent baseline issue, not a Greptile finding**). The reviewed PR changes only the checklist copy; source `main` still has the pre-change wording at audit time.
  - **Dependencies:** Respect PR #6 ownership and CI/release controls; check active work before edits. Avoid a duplicate PR or paid review. Do not expose personal data in screenshots or issue text.
  - **Proposed minimal fix:** Complete the existing single-line PR only after checks, confirm the production commit and public rendered content no longer exposes the unnecessary personal wording; consider historical/public caches separately if exposure confirmed.
  - **Acceptance:** Focused static privacy regression that fails on old `main` and passes on corrected branch; clean source search for the targeted copy, CI/build and browser evidence, authorised merge and deployed-content verification if hosted.
  - **Closure:** Link merged commit, passing checks, actual release SHA and observed public result. Keep OPEN until all evidence exists.

- [ ] **JFA-AUD-003** [TRIAGE / QA] Reproduce and resolve the reported external-CDN browser smoke-test blocker without hiding page errors.
  - **Start/triage:** Inspect `qa.mjs` browser error collection and `index.html:1214-1215` Leaflet script dependencies. Reproduce the PR author's reported `L is not defined` in a restricted network on both unchanged `main` and PR #6; verify whether the same failure occurs on supported deployment networks.
  - **Evidence:** [PR #6](https://github.com/Parris-Tech-Services/JoshFireAwareness/pull/6) reports `npm run build` passed locally but Playwright smoke tests failed in its sandbox; **this has not been independently executed in this audit**. Not a Greptile finding.
  - **Dependencies:** Preserve the README's historical-demo/emergency disclaimers; coordinate with `JFA-AUD-002` for release gate, do not weaken QA or whitelist an actual JavaScript exception.
  - **Proposed minimal fix:** Make the dependency availability deterministic for QA (e.g. pin/serve permitted assets locally or provide an explicit safe degraded mode), keeping user-facing offline/stale warnings prominent.
  - **Acceptance:** `npm run build` and `npm run qa` pass with captured exit codes on desktop and mobile; an intentionally unavailable CDN triggers a deliberate, safe fallback or a clear test failure rather than an uncaught page error. Test warnings/stale feed state and official emergency links.
  - **Closure:** Link code/test commit, CI logs, browser observations, and relevant deployment SHA. Keep OPEN until reproduced and verified.

## Release and privacy gate

This is a historical demonstration and **must not** be represented as an authoritative emergency-alert product. Never publish real personal identifiers, private addresses, credentials or sensitive network details in this register. No new Greptile review, application fix, test execution, PR merge or production deployment was performed by this documentation audit.
