// Search, pathway, secretary, quality and storage logic. Pure functions; Node and browser.
(function (root, f) { const o = f(root.BBC || (typeof require !== 'undefined' ? require('./integrity.js') : {})); if (typeof module !== 'undefined') module.exports = o; root.BBC = Object.assign(root.BBC || {}, o); })(typeof self !== 'undefined' ? self : globalThis, function (I) {
  // ---------- Ask the brigade library ----------
  const STOP = new Set('a an the is are was were do does did i me my we our you your to of in on at for and or it this that be with what which who how when where from by as about need needs before still there any have has can could should will would brigade come get tell'.split(' '));
  const SYN = { absence: ['absences', 'away', 'holiday', 'leave'], absences: ['absence', 'away'], summer: ['christmas', 'holidays'], decide: ['decision', 'decided', 'resolution', 'agreed', 'request', 'asked'], decided: ['decision', 'decide', 'request', 'asked'], app: ['apps', 'tile', 'system', 'portal'], handles: ['handle', 'function', 'used'], figure: ['count', 'number', 'members', 'total'], membership: ['members', 'member'], confirmation: ['confirm', 'confirmed', 'unconfirmed', 'awaiting'], stage: ['ordinary', 'probationary', 'probation', 'milestone'], complete: ['training', 'finish', 'required', 'prerequisite'], report: ['reporting', 'concern', 'incident'], safety: ['hazard', 'injury', 'concern'], quorum: ['vote', 'voting'], training: ['course', 'courses', 'fuel', 'firefighter'], party: ['christmas'], money: ['bank', 'finance'], truck: ['fleet', 'appliance', 'vehicle'] };
  const stem = w => w.length > 4 ? w.replace(/(ing|ed|s)$/, '').replace(/e$/, '') : w;
  const toks = s => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  function buildIndex(d) {
    const docs = [], add = (type, id, title, body, extra) => docs.push(Object.assign({ type, id, title, body }, extra));
    d.claims.forEach(c => add('claim', c.id, c.topic, c.text + ' ' + (c.measure || ''), { topic: c.topic, claims: [c.id] }));
    d.apps.forEach(a => add('app', a.id, a.name, a.function + ' ' + a.tasks.join(' ') + ' ' + a.who, { topic: 'apps', claims: a.claims }));
    d.decisions.forEach(x => add('decision', x.id, 'Meeting ' + x.meeting.slice(2), x.text + ' decision decided ' + x.kind, { topic: 'meetings', claims: x.claims }));
    d.actions.forEach(x => add('action', x.id, 'Action', x.text + ' ' + x.owner, { topic: 'meetings', claims: x.claims }));
    d.questions.forEach(q => add('question', q.id, 'Awaiting ' + q.awaiting, q.text + ' ' + q.topic + ' unconfirmed awaiting confirmation ' + q.awaiting, { topic: q.topic, claims: q.claims }));
    d.pathway.steps.forEach(p => add('step', p.id, p.stage, p.title + ' ' + p.stage + ' next stage complete', { topic: 'training', claims: p.basis }));
    const df = {}; docs.forEach(x => { x.t = toks(x.title + ' ' + x.body).map(stem); x.tf = {}; x.t.forEach(w => x.tf[w] = (x.tf[w] || 0) + 1); Object.keys(x.tf).forEach(w => df[w] = (df[w] || 0) + 1); });
    return { docs, df, n: docs.length };
  }
  function ask(d, index, query, limit) {
    const q = toks(query); if (!q.length) return { answered: false, results: [], related: [], query };
    const terms = new Map(); q.forEach(w => { terms.set(stem(w), 1); (SYN[w] || []).forEach(s => { if (!terms.has(stem(s))) terms.set(stem(s), 0.5); }); });
    const exact = q.map(stem), ql = query.toLowerCase();
    const res = index.docs.map(x => {
      let s = 0, hit = 0;
      terms.forEach((wt, w) => { const tf = x.tf[w]; if (tf) { s += wt * (tf * 2.2 / (tf + 1.2)) * Math.log(1 + index.n / index.df[w]); } });
      q.forEach(w => { if (x.tf[stem(w)] || (SYN[w] || []).some(y => x.tf[stem(y)])) hit++; });
      if (/captain/.test(ql) && x.type === 'question' && /captain/.test(x.title)) s *= 1.8;
      if (/\bapp\b|tile|system/.test(ql) && x.type === 'app') s *= 1.6;
      if (/decide|decision|agree/.test(ql) && x.type === 'decision') s *= 1.6;
      if (/where .*come from|figure|how many/.test(ql) && x.type === 'claim' && d.claims.find(c => c.id === x.id).measure) s *= 1.7;
      if (/next|stage|before/.test(ql) && x.type === 'step') s *= 1.3;
      if (x.type === 'claim') { const v = d.claims.find(c => c.id === x.id).value; if (v && /^\d+$/.test(v) && new RegExp('\\b' + v + '\\b').test(ql)) s *= 1.6; }
      return { doc: x, score: s, coverage: hit / exact.length };
    }).filter(r => r.score > 0 && r.coverage > 0).sort((a, b) => b.score - a.score);
    const top = res[0], answered = !!top && top.score >= 2.5 && (top.coverage >= 0.6 || (exact.length <= 2 && top.coverage >= 0.5));
    const results = (answered ? res.slice(0, limit || 6) : []).map(r => ({ type: r.doc.type, id: r.doc.id, title: r.doc.title, text: r.doc.body.split(' decision decided ')[0].split(' unconfirmed awaiting ')[0].split(' next stage complete')[0], score: +r.score.toFixed(2), evidence: r.doc.claims.map(id => I.claimView(d, id)).filter(Boolean) }));
    const topics = new Set(results.slice(0, 3).map(r => index.docs.find(x => x.id === r.id).topic));
    const related = d.questions.filter(x => topics.has(x.topic) && !results.some(r => r.id === x.id)).slice(0, 4);
    return { answered, results, related, query };
  }

  // ---------- Pathway ----------
  // state[stepId] = { self: 'YYYY-MM-DD'|null, selfNote, official: 'YYYY-MM-DD'|null, officialBy }
  function pathwayStatus(d, state) {
    state = state || {};
    const st = id => state[id] || {};
    return d.pathway.steps.map(p => {
      const s = st(p.id), done = !!s.official, selfDone = !!s.self;
      const missing = p.requires.filter(r => !st(r).self && !st(r).official);
      const unconfirmed = p.requires.filter(r => st(r).self && !st(r).official);
      let status = done ? 'confirmed' : selfDone ? 'self-recorded' : missing.length ? 'blocked' : 'available';
      return { step: p, status, missing, unconfirmed, canSelfRecord: !p.official_only, record: s };
    });
  }
  const nextSteps = (d, state) => pathwayStatus(d, state).filter(x => x.status === 'available');
  function addMonths(iso, m) { const [y, mo, da] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + m, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(da, last)); return t.toISOString().slice(0, 10); }
  function ordinaryEstimate(d, o) {
    o = o || {}; const start = o.commencement || d.pathway.commencement.date, months = o.months || 6;
    const verified = !!(o.commencementVerified && o.ruleVerified);
    return { earliest: addMonths(start, months), start, months, provisional: !verified,
      working: `${start} + ${months} months = ${addMonths(start, months)}. This is the earliest date the minimum probation period could end; ordinary membership then needs acceptance at a brigade meeting, so the real date is later.`,
      unresolved: [!o.commencementVerified && 'Start date of probation is not verified (using the eMembership confirmation date).', !o.ruleVerified && 'The six-month minimum comes from the 2018 model constitution as reported by earlier research; it is not confirmed that it applies to Burrabadine.', 'Date of the meeting that would consider the membership is unknown.', 'Any competence or training requirements the brigade applies are unconfirmed.'].filter(Boolean) };
  }

  // ---------- Secretary: quorum ----------
  // Every input is explicit. No defaults: missing input returns {ok:false, need:[...]}.
  function quorum(i) {
    const need = [], int = v => Number.isInteger(v) && v >= 0;
    if (!int(i.eligible)) need.push('Number of members eligible to count toward quorum (whole number)');
    if (!(typeof i.percent === 'number' && i.percent > 0 && i.percent <= 100)) need.push('Quorum percentage (greater than 0, up to 100)');
    if (!['up', 'down', 'nearest'].includes(i.rounding)) need.push('Rounding method (up, down or nearest)');
    if (!i.basis || !String(i.basis).trim()) need.push('Which membership categories were counted as eligible');
    if (need.length) return { ok: false, need };
    const micro = Math.round(i.eligible * i.percent * 1e4); // exact integer arithmetic: units of 1e-6 members
    const whole = Math.floor(micro / 1e6), rem = micro % 1e6;
    let required = i.rounding === 'up' ? whole + (rem ? 1 : 0) : i.rounding === 'down' ? whole : whole + (rem >= 5e5 ? 1 : 0);
    const notes = [];
    if (int(i.minimum) && required < i.minimum) { notes.push(`Raised to the stated minimum of ${i.minimum}.`); required = i.minimum; }
    if (required === 0) notes.push('Calculated quorum is zero. Check the inputs; a meeting of nobody is not a meeting.');
    if (required > i.eligible) notes.push('Required number exceeds the eligible membership.');
    const provisional = !(i.ruleConfirmed && i.countConfirmed);
    const raw = (micro / 1e6);
    const out = { ok: true, required, raw, provisional, notes, denominator: i.eligible, percent: i.percent, rounding: i.rounding, basis: i.basis,
      explanation: `${i.percent}% of ${i.eligible} eligible members (${i.basis}) = ${raw}; rounded ${i.rounding} = ${required}.`,
      assumptions: [!i.ruleConfirmed && 'The rule (percentage, eligible categories, rounding) is not confirmed for Burrabadine.', !i.countConfirmed && 'The eligible-member count has not been confirmed against the brigade register.'].filter(Boolean) };
    if (int(i.present)) { out.present = i.present; out.met = i.present >= required; out.presentNote = 'Count only eligible members present. Attendance alone does not show eligibility.'; }
    return out;
  }

  // ---------- Secretary: CSV ----------
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, ''); const rows = []; let row = [], cell = '', q = false, i = 0;
    const delim = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
    while (i < text.length) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
      else cell += ch;
      i++;
    }
    if (q) throw new Error('CSV has an unclosed quote');
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const clean = rows.filter(r => r.some(c => c.trim() !== ''));
    if (!clean.length) throw new Error('CSV is empty');
    const header = clean[0].map(h => h.trim()); if (new Set(header).size !== header.length) throw new Error('CSV has duplicate column names');
    const ragged = clean.slice(1).filter(r => r.length !== header.length).length;
    return { header, rows: clean.slice(1).map(r => Object.fromEntries(header.map((h, k) => [h, (r[k] || '').trim()]))), ragged };
  }
  // Counts by an explicitly chosen column. Blank values are reported, never guessed. eligibleValues is chosen by the user.
  function analyseRoster(parsed, categoryColumn, eligibleValues) {
    if (!parsed.header.includes(categoryColumn)) return { ok: false, need: 'Choose which column holds the membership category. It is never inferred from attendance or any other column.' };
    const counts = {}; let blank = 0;
    parsed.rows.forEach(r => { const v = r[categoryColumn]; if (!v) blank++; else counts[v] = (counts[v] || 0) + 1; });
    const out = { ok: true, total: parsed.rows.length, counts, blank, ragged: parsed.ragged, column: categoryColumn };
    if (eligibleValues && eligibleValues.length) { out.eligible = eligibleValues.reduce((n, v) => n + (counts[v] || 0), 0); out.basis = `'${categoryColumn}' is ${eligibleValues.join(' or ')} (chosen by you)`; }
    return out;
  }
  const DEMO_ROSTER = 'Name,Category,Joined,At last meeting\n"Example, Alex",Ordinary,2015,Yes\nSample Bailey,Ordinary,2019,No\nDemo Casey,Ordinary,2021,Yes\nTest Drew,Probationary,2026,Yes\nFake Ellis,Social,2010,No\n"Placeholder, Finn",Ordinary,2008,Yes\nMock Gray,Associate,2022,No\nDummy Harper,Ordinary,2017,No\nInvented Indi,,2024,Yes\nNobody Jules,Ordinary,2012,Yes\n';

  // ---------- Secretary: agenda, actions, packs ----------
  const STANDING = ['Attendance and apologies', 'Minutes of previous meeting', 'Business arising', 'Correspondence', "Treasurer's report", "Captain's report", 'General business', 'Next meeting'];
  function seedActions(d) { return d.actions.map(a => ({ id: a.id, text: a.text, owner: a.owner, due: a.due, status: a.status === 'done' ? 'done' : 'open', origin: a.origin, claims: a.claims, history: [{ date: d.built, event: 'Imported from evidence base (' + a.origin + ')' }] })); }
  function buildAgenda(meeting, actions) {
    const open = actions.filter(a => a.status !== 'done');
    return { date: meeting.date, time: meeting.time, place: meeting.place, items: STANDING.map(t => ({ title: t, carried: t === 'Business arising' ? open.map(a => ({ id: a.id, text: a.text, owner: a.owner, due: a.due, origin: a.origin })) : [], notes: '' })).concat((meeting.extra || []).map(t => ({ title: t, carried: [], notes: '' }))) };
  }
  function updateAction(a, change, date) { const b = Object.assign({}, a, change); b.history = a.history.concat([{ date, event: Object.entries(change).map(([k, v]) => `${k}: ${a[k] || '-'} → ${v || '-'}`).join('; ') }]); return b; }
  const toCSV = rows => rows.map(r => r.map(c => { c = c == null ? '' : String(c); if (/^[=+\-@]/.test(c)) c = "'" + c; return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n') + '\r\n';

  // ---------- Local state: export / import ----------
  const STATE_VERSION = 1, STATE_KEYS = ['pathway', 'practice', 'research', 'answers', 'actions', 'meetings', 'quorumInputs', 'humanChecks'];
  const emptyState = () => ({ pathway: {}, practice: {}, research: [], answers: {}, actions: null, meetings: [], quorumInputs: {}, humanChecks: {} });
  // Roster data is never part of state, so it cannot be exported, synced or cached.
  function exportState(state, date) { const out = { app: 'burrabadine-companion', version: STATE_VERSION, exported: date, data: {} }; STATE_KEYS.forEach(k => out.data[k] = state[k]); return JSON.stringify(out, null, 1); }
  function importState(text) {
    let o; try { o = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    if (!o || o.app !== 'burrabadine-companion') throw new Error('That file is not a Companion export.');
    if (o.version !== STATE_VERSION) throw new Error('Export version ' + o.version + ' is not supported by this version.');
    const s = emptyState(), dd = o.data || {};
    STATE_KEYS.forEach(k => { if (dd[k] === undefined) return; const want = Array.isArray(s[k]) ? 'array' : 'object'; const got = Array.isArray(dd[k]) ? 'array' : typeof dd[k]; if (k === 'actions' ? !(dd[k] === null || got === 'array') : got !== want) throw new Error(`Export field '${k}' has the wrong shape.`); s[k] = dd[k]; });
    return s;
  }

  // ---------- Research quality ----------
  function quality(d, today) {
    const S = I.byId(d.sources), C = I.byId(d.claims), live = d.claims.filter(c => c.status !== 'retracted');
    const pairs = [], seen = new Set();
    live.forEach(c => (c.conflicts || []).forEach(k => { const key = [c.id, k.id].sort().join('|'); if (!seen.has(key)) { seen.add(key); pairs.push({ a: c.id, b: k.id, note: k.note }); } }));
    const age = s => s.published ? (Date.parse(today) - Date.parse(s.published)) / 31557600000 : null;
    const used = new Set(d.claims.map(c => c.source));
    const topicsWithClaims = new Set(d.claims.map(c => c.topic));
    return {
      unsupported: live.filter(c => S[c.source].class === 'unverified' || (c.verified === null)).map(c => ({ id: c.id, why: S[c.source].class === 'unverified' ? 'Rests on unverified research' : 'Source not re-read: ' + I.ACCESS_LABEL[S[c.source].access] })),
      conflicts: pairs,
      retracted: d.claims.filter(c => c.status === 'retracted').map(c => ({ id: c.id, by: c.superseded_by })),
      outdated: d.sources.filter(s => s.historical || (age(s) !== null && age(s) > 3)).map(s => ({ id: s.id, why: s.historical ? 'Historical archive' : `Published ${Math.floor(age(s))} years ago` })),
      links: d.links ? d.links.results.filter(l => l.status !== 'ok') : null, linksChecked: d.links ? d.links.checked : null,
      awaiting: d.questions,
      ruleDependent: d.rules.map(r => ({ rule: r, claims: d.claims.filter(c => (c.depends_on || []).includes(r.id)).map(c => c.id), steps: d.pathway.steps.filter(p => p.uncertain_rule === r.id).map(p => p.id) })),
      coverage: {
        sourcesNotRead: d.sources.filter(s => !['reread', 'ocr_reread'].includes(s.access)).map(s => ({ id: s.id, why: I.ACCESS_LABEL[s.access] })),
        sourcesUnused: d.sources.filter(s => !used.has(s.id) && !s.restricted).map(s => s.id),
        questionsWithoutEvidence: d.questions.filter(q => !q.claims.length).map(q => q.id),
        missing: ['Approved minutes of 13 November 2026', 'Brigade register counts by category', 'Locally approved brigade rules or confirmation that the model constitution applies', 'Official operational training material (no operational scenarios are offered until this exists)', 'The welcome letter itself (only a summary was read)'],
        topics: [...topicsWithClaims].sort()
      }
    };
  }

  // ---------- Public-safe export ----------
  // A record leaves only if ALL hold: its id is on the allowlist with a named reviewer and date; its source is official,
  // not private and not restricted; it is not retracted or rule-dependent; and its exported text passes the content scan.
  // Only allowlisted fields are copied. A 'public' flag on a record has no effect.
  const PUBLIC_FIELDS = ['id', 'topic', 'kind', 'text', 'confidence'];
  function publicExport(d, allow, privateTerms) {
    const S = I.byId(d.sources), out = [], rejected = [];
    const terms = (privateTerms || []).map(t => t.toLowerCase()).filter(t => t.length > 2);
    const fields = (allow.fields || []).filter(f => PUBLIC_FIELDS.includes(f));
    d.claims.forEach(c => {
      const entry = (allow.claims || []).find(a => a.id === c.id), s = S[c.source], why = [];
      if (!entry) why.push('not on the allowlist');
      else { if (!entry.reviewed_by || !I.isDate(entry.reviewed)) why.push('allowlist entry lacks reviewer or review date'); if (entry.text_hash !== hash(c.text)) why.push('text changed since review'); }
      if (!s || s.private) why.push('source is private'); if (s && s.restricted) why.push('source is restricted');
      if (s && s.class !== 'official') why.push('source is not official guidance');
      if (c.status === 'retracted') why.push('retracted'); if ((c.depends_on || []).length) why.push('depends on an unconfirmed rule');
      const rec = {}; fields.forEach(f => rec[f] = c[f]); const blob = JSON.stringify(rec).toLowerCase();
      I.sensitiveHits(blob).forEach(h => why.push('contains ' + h));
      terms.forEach(t => { if (blob.includes(t)) why.push('contains a private term'); });
      if (/drive\.google|mail\.google|gmail/.test(blob)) why.push('contains a private link');
      if (why.length) { if (entry || c.public) rejected.push({ id: c.id, why: [...new Set(why)] }); return; }
      rec.source = { title: s.title, url: s.url, published: s.published }; out.push(rec);
    });
    return { records: out, rejected, fields };
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); }
  // Names of private individuals are derived from brigade-record text so they can never be exported.
  function privateTerms(d) { const set = new Set(['Josh', 'Dad']); d.claims.filter(c => c.topic === 'officers').forEach(c => (c.text.match(/\b[A-Z][a-z]+\b/g) || []).forEach(w => { if (!/^(The|Join|Us|President|Secretary|Captain|Treasurer|Permit|Officers|September|November|Contact|Josh|Dad|July)$/.test(w)) set.add(w); })); return [...set]; }

  // Recall cards come only from text-checked, high-confidence document statements; each is tied to its exact claim.
  function recallCards(d) { return d.claims.filter(c => c.kind === 'statement' && c.status !== 'retracted' && c.confidence === 'high' && c.verified).map(c => ({ id: c.id, prompt: `What does the ${d.sources.find(s => s.id === c.source).title.replace(/^Burrabadine /, '')} record about ${c.topic}?`, answer: c.text })); }
  // Side-by-side versions per topic wherever claims conflict, with the open questions that would settle them.
  function reconcile(d) { const out = []; [...new Set(d.claims.filter(c => (c.conflicts || []).length).map(c => c.topic))].sort().forEach(t => { const ids = new Set(); d.claims.filter(c => c.topic === t && (c.conflicts || []).length).forEach(c => { ids.add(c.id); c.conflicts.forEach(k => ids.add(k.id)); }); out.push({ topic: t, versions: [...ids].map(id => I.claimView(d, id)).sort((a, b) => String(a.asAt).localeCompare(String(b.asAt))), settle: d.questions.filter(q => q.topic === t || q.claims.some(c => ids.has(c))) }); }); return out; }
  return { recallCards, reconcile, buildIndex, ask, pathwayStatus, nextSteps, ordinaryEstimate, addMonths, quorum, parseCSV, analyseRoster, DEMO_ROSTER, STANDING, seedActions, buildAgenda, updateAction, toCSV, emptyState, exportState, importState, STATE_KEYS, quality, publicExport, privateTerms, hash, PUBLIC_FIELDS };
});
