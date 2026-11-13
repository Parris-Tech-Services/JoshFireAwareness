// Data integrity and scenario validation. Pure functions; runs in Node and the browser.
(function (root, f) { const o = f(); if (typeof module !== 'undefined') module.exports = o; root.BBC = Object.assign(root.BBC || {}, o); })(typeof self !== 'undefined' ? self : globalThis, function () {
  const CLASSES = ['official', 'brigade_record', 'personal_note', 'unverified'];
  const CLASS_LABEL = { official: 'Official guidance', brigade_record: 'Brigade record', personal_note: 'Personal note', unverified: 'Unverified research' };
  const ACCESS_LABEL = { ocr_reread: 'OCR text re-read', reread: 'Re-read', prior_review: 'Carried from earlier research', blocked: 'Could not be opened (blocked)', link_only: 'Link answered; text not read', not_opened: 'Deliberately not opened' };
  const CONF = ['high', 'medium', 'low'];
  const CATEGORIES = ['onboarding', 'app-navigation', 'reporting-concerns', 'meeting-procedure', 'finding-guidance', 'administration', 'operational'];
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));

  // Returns a list of problems; empty means the evidence base is internally consistent.
  function validateData(d) {
    const errs = [], E = m => errs.push(m);
    const S = byId(d.sources), C = byId(d.claims), Q = byId(d.questions), R = byId(d.rules), A = byId(d.apps), P = byId(d.pathway.steps), M = byId(d.meetings);
    const dup = (list, n) => { const seen = new Set(); list.forEach(x => { if (!x.id) E(`${n}: record without id`); if (seen.has(x.id)) E(`${n}: duplicate id ${x.id}`); seen.add(x.id); }); };
    dup(d.sources, 'source'); dup(d.claims, 'claim'); dup(d.questions, 'question'); dup(d.apps, 'app'); dup(d.pathway.steps, 'step'); dup(d.decisions, 'decision'); dup(d.actions, 'action');
    d.sources.forEach(s => {
      if (!CLASSES.includes(s.class)) E(`${s.id}: bad class`);
      if (!ACCESS_LABEL[s.access]) E(`${s.id}: bad access`);
      if (s.published !== null && !isDate(s.published)) E(`${s.id}: bad published date`);
      if (s.checked !== null && !isDate(s.checked)) E(`${s.id}: bad checked date`);
      if (!s.location || !s.limits) E(`${s.id}: location and limits are required`);
      if (s.restricted && s.access !== 'not_opened') E(`${s.id}: restricted source must not be opened`);
    });
    d.claims.forEach(c => {
      const s = S[c.source];
      if (!s) return E(`${c.id}: unknown source ${c.source}`);
      if (s.restricted) E(`${c.id}: claims may not cite a restricted source`);
      if (!['statement', 'interpretation'].includes(c.kind)) E(`${c.id}: kind must be statement or interpretation`);
      if (!CONF.includes(c.confidence)) E(`${c.id}: bad confidence`);
      if (!c.locator) E(`${c.id}: locator required (say 'not available' if so)`);
      if (c.verified !== null && !isDate(c.verified)) E(`${c.id}: bad verified date`);
      if (c.verified && !['ocr_reread', 'reread'].includes(s.access)) E(`${c.id}: marked verified but its source was not re-read (${s.access})`);
      if (c.verified === null && c.confidence === 'high' && c.kind === 'statement') E(`${c.id}: unverified statement cannot be high confidence`);
      (c.conflicts || []).forEach(k => {
        const o = C[k.id];
        if (!o) return E(`${c.id}: conflict with unknown claim ${k.id}`);
        if (!k.note) E(`${c.id}: conflict with ${k.id} needs a note`);
        if (!(o.conflicts || []).some(b => b.id === c.id)) E(`${c.id}: conflict with ${k.id} is not recorded on both sides`);
      });
      (c.depends_on || []).forEach(r => { if (!R[r]) E(`${c.id}: unknown rule ${r}`); });
      if (c.superseded_by) { const n = C[c.superseded_by]; if (!n) E(`${c.id}: superseded_by unknown`); else if (!(n.supersedes || []).includes(c.id)) E(`${c.id}: superseding claim does not link back`); }
      (c.supersedes || []).forEach(o => { if (!C[o] || C[o].superseded_by !== c.id) E(`${c.id}: supersedes ${o} without a back-link`); });
      if (c.status === 'retracted' && !c.superseded_by) E(`${c.id}: retracted claim needs superseded_by`);
      if (c.measure && !c.value) E(`${c.id}: measure without value`);
      if (c.measure && !(c.as_at || s.published)) E(`${c.id}: a figure needs an as-at date`);
      if (c.as_at && !isDate(c.as_at)) E(`${c.id}: bad as_at date`);
      if ((c.reviewer || c.human_verified) && !(c.reviewer && isDate(c.reviewed))) E(`${c.id}: a human check needs a named reviewer and a date; an AI may not mark itself as the verifier`);
    });
    const refs = (owner, ids) => (ids || []).forEach(i => { if (!C[i]) E(`${owner}: unknown claim ${i}`); });
    d.rules.forEach(r => { if (!Q[r.ask]) E(`${r.id}: unknown question ${r.ask}`); });
    d.apps.forEach(a => { refs(a.id, a.claims); if (!a.claims.length) E(`${a.id}: needs at least one claim`); if (!CONF.includes(a.confidence)) E(`${a.id}: bad confidence`); });
    d.questions.forEach(q => { refs(q.id, q.claims); if (!['captain', 'secretary', 'district'].includes(q.awaiting)) E(`${q.id}: bad awaiting`); });
    d.decisions.forEach(x => { refs(x.id, x.claims); if (!M[x.meeting]) E(`${x.id}: unknown meeting`); if (!['resolution', 'noted', 'request', 'unconfirmed'].includes(x.kind)) E(`${x.id}: bad kind`); });
    d.actions.forEach(x => { refs(x.id, x.claims); if (!M[x.origin]) E(`${x.id}: unknown origin meeting`); });
    d.meetings.forEach(m => { if (!S[m.source]) E(`${m.id}: unknown source`); });
    d.pathway.steps.forEach(p => {
      refs(p.id, p.basis); if (!p.basis.length) E(`${p.id}: needs a basis`);
      p.requires.forEach(r => { if (!P[r]) E(`${p.id}: unknown prerequisite ${r}`); });
      if (p.app && !A[p.app]) E(`${p.id}: unknown app`);
      if (p.question && !Q[p.question]) E(`${p.id}: unknown question`);
      if (p.uncertain_rule && !R[p.uncertain_rule]) E(`${p.id}: unknown rule`);
    });
    // prerequisite cycles
    const state = {}; const visit = id => { if (state[id] === 1) return true; if (state[id] === 2) return false; state[id] = 1; const cyc = P[id].requires.some(r => P[r] && visit(r)); state[id] = 2; return cyc; };
    d.pathway.steps.forEach(p => { if (visit(p.id)) E(`${p.id}: prerequisite cycle`); });
    // nothing sensitive in text fields: phone numbers, emails, BSB/account numbers
    const scan = (id, t) => { const hit = sensitiveHits(t); if (hit.length) E(`${id}: sensitive pattern in text (${hit.join(', ')})`); };
    d.claims.forEach(c => scan(c.id, c.text)); d.apps.forEach(a => scan(a.id, a.function + ' ' + (a.caveat || ''))); d.decisions.forEach(x => scan(x.id, x.text)); d.actions.forEach(x => scan(x.id, x.text)); d.questions.forEach(q => scan(q.id, q.text));
    (d.scenarios || []).forEach(sc => validateScenario(sc, d).forEach(m => E(`scenario ${sc.id || '?'}: ${m}`)));
    return errs;
  }

  // Patterns that must never appear in committed evidence text or public exports.
  function sensitiveHits(text) {
    const t = String(text || ''), hits = [];
    if (/(?:\+?61|\b0)[23478](?:[ -]?\d){8}\b/.test(t) || /\b1[38]00(?:[ -]?\d){6}\b/.test(t) || /\b13(?:[ -]?\d){4}\b/.test(t)) hits.push('phone number');
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t)) hits.push('email address');
    if (/\bBSB\b|\b\d{3}-\d{3}\b/i.test(t)) hits.push('bank detail');
    if (/\b(password|passcode|verification code)\s*[:=]/i.test(t)) hits.push('credential');
    return hits;
  }

  function validateScenario(sc, d) {
    const errs = [], E = m => errs.push(m);
    const C = byId(d.claims), S = byId(d.sources);
    if (!/^[a-z0-9-]+$/.test(sc.id || '')) E('id must be a lowercase slug');
    for (const k of ['title', 'summary']) if (!sc[k]) E(`${k} is required`);
    if (!CATEGORIES.includes(sc.category)) E(`category must be one of ${CATEGORIES.join(', ')}`);
    if (sc.category === 'operational') {
      const src = S[sc.official_training_source];
      if (!src || src.class !== 'official' || !['reread', 'ocr_reread'].includes(src.access) || src.historical) E('operational scenarios need official_training_source: a current official source that has been read');
    }
    if (!sc.learn || !sc.learn.label || !Array.isArray(sc.learn.claims) || !sc.learn.claims.length) E('learn.label and learn.claims are required');
    else sc.learn.claims.forEach(c => { if (!C[c]) E(`learn: unknown claim ${c}`); });
    const N = sc.nodes || {};
    if (!N[sc.start]) { E('start node not found'); return errs; }
    const ends = new Set();
    for (const [id, n] of Object.entries(N)) {
      if (n.end) { if (!n.debrief) E(`${id}: end node needs a debrief`); ends.add(id); continue; }
      if (!n.situation) E(`${id}: situation is required`);
      if (!Array.isArray(n.choices) || n.choices.length < 2) { E(`${id}: at least two choices`); continue; }
      if (!n.choices.some(c => c.quality === 'best')) E(`${id}: one choice must be 'best'`);
      const ids = new Set();
      n.choices.forEach(c => {
        const w = `${id}/${c.id}`;
        if (!c.id || ids.has(c.id)) E(`${w}: choice ids must be unique`); ids.add(c.id);
        if (!['best', 'ok', 'poor'].includes(c.quality)) E(`${w}: quality must be best, ok or poor`);
        for (const k of ['label', 'consequence', 'why']) if (!c[k]) E(`${w}: ${k} is required`);
        if (!Array.isArray(c.claims) || !c.claims.length) E(`${w}: at least one supporting claim`);
        else c.claims.forEach(x => { if (!C[x]) E(`${w}: unknown claim ${x}`); });
        if (!N[c.next]) E(`${w}: next node '${c.next}' not found`);
      });
    }
    if (!ends.size) E('at least one end node');
    // reachability from start, and every node must be able to reach an end
    const seen = new Set(), stack = [sc.start];
    while (stack.length) { const id = stack.pop(); if (seen.has(id) || !N[id]) continue; seen.add(id); (N[id].choices || []).forEach(c => stack.push(c.next)); }
    Object.keys(N).forEach(id => { if (!seen.has(id)) E(`${id}: unreachable from start`); });
    const canEnd = new Set(ends); let grew = true;
    while (grew) { grew = false; for (const [id, n] of Object.entries(N)) if (!canEnd.has(id) && (n.choices || []).some(c => canEnd.has(c.next))) { canEnd.add(id); grew = true; } }
    Object.keys(N).forEach(id => { if (!canEnd.has(id)) E(`${id}: cannot reach an ending`); });
    const blob = JSON.stringify(sc);
    sensitiveHits(blob).forEach(h => E(`contains ${h}`));
    return errs;
  }

  // Join a claim with its source for display.
  function claimView(d, id) {
    const c = d.claims.find(x => x.id === id); if (!c) return null;
    const s = d.sources.find(x => x.id === c.source);
    const verification = c.status === 'retracted' ? 'rejected' : c.verified ? 'text_checked' : s.access === 'link_only' ? 'metadata_verified' : 'unverified';
    const support = c.status === 'retracted' ? 'no support' : ['blocked', 'not_opened'].includes(s.access) ? 'inaccessible' : (s.class === 'unverified' || s.access === 'prior_review') ? 'indirect' : 'direct';
    return Object.assign({}, c, { verification, support, asAt: c.as_at || s.published || null, recollection: s.class === 'personal_note', src: s, cls: s.class, clsLabel: CLASS_LABEL[s.class], published: s.published, publishedNote: s.published_note || null });
  }
  const VERIFICATION_LABEL = { unverified: 'Not checked', metadata_verified: 'Link checked only', text_checked: 'Text checked by AI (not a human review)', independently_reproduced: 'Independently reproduced', rejected: 'Rejected' };
  const SUPPORT_LABEL = { direct: 'Direct: the source itself was read', indirect: 'Indirect: via a summary or earlier research', inaccessible: 'Source could not be opened', 'no support': 'No support' };
  // Living-person gate: every capitalised two-word phrase in evidence text must already be on the reviewed list.
  const phrases = t => [...new Set(String(t).match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [])];
  function newPhrases(d, known) { const k = new Set(known), out = new Set(); const scan = t => phrases(t).forEach(p => { if (!k.has(p)) out.add(p); }); d.claims.forEach(c => scan(c.text)); (d.stories || []).forEach(s => scan(JSON.stringify(s))); (d.scenarios || []).forEach(s => scan(JSON.stringify(s))); d.decisions.forEach(x => scan(x.text)); d.actions.forEach(x => scan(x.text + ' ' + x.owner)); d.questions.forEach(q => scan(q.text)); return [...out]; }
  return { VERIFICATION_LABEL, SUPPORT_LABEL, phrases, newPhrases, CLASSES, CLASS_LABEL, ACCESS_LABEL, CATEGORIES, validateData, validateScenario, sensitiveHits, claimView, byId, isDate };
});
