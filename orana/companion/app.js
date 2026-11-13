// Burrabadine Brigade Companion: views. All logic lives in lib/. No network calls are made by this file.
(function () {
  'use strict';
  const B = self.BBC, D = self.BBC_DATA, $ = (s, r) => (r || document).querySelector(s), main = $('#main');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const n = new Date(); return new Date(n - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const fmt = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'undated';
  const KEY = 'bbc.state.v1';
  let state = B.emptyState(), storageOK = true, roster = null; // roster: memory only, never persisted
  try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(B.emptyState(), JSON.parse(raw)); } catch (e) { storageOK = false; }
  if (!state.actions) state.actions = B.seedActions(D);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { storageOK = false; toast('Could not save on this device. Export your data to keep it.'); } };
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
  const index = B.buildIndex(D), S = B.byId(D.sources), C = B.byId(D.claims), Q = B.byId(D.questions);
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const printHTML = html => { $('#print-area').innerHTML = html; window.print(); };

  // ---------- shared pieces ----------
  const chipClass = s => `<span class="chip ${s.class}">${esc(B.CLASS_LABEL[s.class])}</span>`;
  function evidence(id, compact) {
    const c = B.claimView(D, id); if (!c) return '';
    const flags = [];
    if (c.status === 'retracted') flags.push('<span class="chip bad">Retracted</span>');
    if (c.kind === 'interpretation') flags.push('<span class="chip">Our reading</span>'); else flags.push('<span class="chip">Document says</span>');
    if (c.recollection) flags.push('<span class="chip warn">A recollection, not a finding</span>');
    if (c.conflicts && c.conflicts.length) flags.push(`<span class="chip warn">${c.conflicts.length} conflicting</span>`);
    if (c.depends_on && c.depends_on.length) flags.push('<span class="chip warn">Depends on unconfirmed rule</span>');
    return `<a class="card" href="#/claim/${c.id}">${chipClass(c.src)}${flags.join('')}
      <p>${esc(c.text)}</p>
      <p class="small">${esc(c.src.title)} · ${esc(c.locator)}<br>As at ${fmt(c.asAt)} · ${state.humanChecks[c.id] ? 'human-checked by ' + esc(state.humanChecks[c.id].by) : esc(B.VERIFICATION_LABEL[c.verification])} · confidence ${c.confidence}</p>${compact ? '' : `<p class="small">Limits: ${esc(c.src.limits)}</p>`}</a>`;
  }
  const sub = (base, tabs, cur) => `<nav class="sub" aria-label="Sub-sections">${tabs.map(([k, l]) => `<a href="#/${base}/${k}"${k === cur ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;

  // ---------- views ----------
  const LIBTABS = [['stories', 'Stories'], ['claims', 'Claims'], ['reconcile', 'Reconcile'], ['sources', 'Sources']];
  const KIND = { record: ['ok', 'From the record'], note: ['warn', 'A recollection'], reading: ['', 'Our reading'], open: ['bad', 'Not yet confirmed'] };
  const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const storyCard = s => `<a class="card story-card" href="#/read/${s.id}"><strong>${esc(s.title)}</strong><p>${esc(s.dek)}</p><p class="small">${s.minutes} min read · ${s.claims.length} sources</p></a>`;
  const V = {};
  V.home = () => {
    const next = B.nextSteps(D, state.pathway)[0], open = state.actions.filter(a => a.status !== 'done').length;
    return `<h1>Burrabadine Brigade Companion</h1>
    <p class="lead">Find what the brigade's records actually say, see what to do next, and prepare meeting paperwork. Everything you enter stays on this device.</p>
    <form data-form="ask" class="card"><label for="hq">Ask the brigade library</label><div class="row"><input id="hq" name="q" type="search" placeholder="e.g. What did the brigade decide about summer absences?" autocomplete="off"><button class="fit">Ask</button></div></form>
    <h2>Next for you</h2>
    ${next ? `<a class="card" href="#/pathway"><strong>${esc(next.step.title)}</strong><p class="small">${esc(next.step.stage)} · open the pathway to record progress</p></a>` : '<p class="card">No step is currently available. Open the pathway to see what is waiting on confirmation.</p>'}
    <h2>Worth reading</h2>${(D.stories || []).slice(0, 2).map(storyCard).join('')}<p class="small"><a href="#/library/stories">All ${(D.stories || []).length} stories</a></p>
    <h2>For the secretary</h2>
    <a class="card" href="#/secretary/agenda"><strong>Prepare the next meeting</strong><p class="small">${open} open action${open === 1 ? '' : 's'} will carry forward to the agenda</p></a>
    <p class="small"><a href="#/practice">Practice scenarios</a> · <a href="#/quality">Research quality</a> · <a href="#/data">Your data: export, import, delete</a></p>
    <p class="small">Evidence base built ${fmt(D.built)}: ${D.sources.length} sources, ${D.claims.length} claims. This is a personal study aid. For anything operational, follow your captain and official RFS systems.</p>`;
  };

  const EXAMPLES = ['What do I need to complete before the next membership stage?', 'Which app handles fire permits?', 'What did the brigade decide about summer absences?', 'What still needs confirmation from the captain?', 'Where did the membership figure of 68 come from?', 'Where do I report a safety concern?'];
  V.ask = (p, q) => {
    const query = q.get('q') || '', r = query ? B.ask(D, index, query) : null;
    let out = `<h1>Ask the brigade library</h1><form data-form="ask"><label for="q">Your question</label><div class="row"><input id="q" name="q" type="search" value="${esc(query)}" autocomplete="off"><button class="fit">Ask</button></div></form>
    <p class="small">This is a local keyword search over the evidence records, not an AI answer. It shows what the records say and how far to trust them.</p>`;
    if (!r) out += `<h2>Try</h2><ul class="plain">${EXAMPLES.map(e => `<li><a class="card" href="#/ask?q=${encodeURIComponent(e)}">${esc(e)}</a></li>`).join('')}</ul>`;
    else if (!r.answered) out += `<div class="note" id="noanswer"><strong>No supported answer in the library.</strong><p>Nothing in the evidence matches this well enough to show as an answer, so none is given.</p><button data-act="research-add" data-q="${esc(query)}">Save as a research item</button></div>`;
    else {
      out += `<h2>What the records show</h2>` + r.results.map(x => `<section class="card" data-result="${x.id}"><span class="chip">${x.type}</span><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p>
        ${x.type === 'question' ? '<p class="note">This is an open question. It has not been answered yet.</p>' : ''}
        <details${x === r.results[0] ? ' open' : ''}><summary>Supporting evidence (${x.evidence.length})</summary>${x.evidence.map(e => evidence(e.id, true)).join('') || '<p class="small">No evidence records are linked.</p>'}</details></section>`).join('');
      if (r.related.length) out += `<h2>Related open questions</h2><ul class="plain">${r.related.map(x => `<li class="card">${esc(x.text)}<p class="small">Awaiting: ${x.awaiting}</p></li>`).join('')}</ul>`;
      out += `<p class="small">Not what you needed? <button class="link" data-act="research-add" data-q="${esc(query)}">Save this as a research item</button></p>`;
    }
    if (state.research.length) out += `<h2>Your research items</h2><ul class="plain" id="research">${state.research.map((x, i) => `<li class="card">${esc(x.q)}<p class="small">Saved ${fmt(x.date)} · unanswered</p><button class="sec" data-act="research-del" data-i="${i}">Remove</button></li>`).join('')}</ul>`;
    return out;
  };

  V.read = p => {
    const st = D.stories || [], i = st.findIndex(x => x.id === p[0]), s = st[i]; if (!s) return notFound(); const nx = st[(i + 1) % st.length];
    return `<article class="story"><p><a href="#/library/stories">← Stories</a></p><h1>${esc(s.title)}</h1><p class="dek">${esc(s.dek)}</p><p class="small">${s.minutes} minute read · built from ${s.claims.length} evidence records</p>
    ${s.sections.map(x => `<h2>${esc(x.h)}</h2><span class="chip ${KIND[x.k || 'record'][0]}">${KIND[x.k || 'record'][1]}</span>${x.p.map(t => `<p>${rich(t)}</p>`).join('')}`).join('')}
    <p class="takeaway"><strong>The short version.</strong> ${esc(s.takeaway)}</p>
    <details><summary>Where this comes from (${s.claims.length})</summary>${s.claims.map(c => evidence(c, true)).join('')}</details>
    <h2>Read next</h2>${storyCard(nx)}</article>`;
  };
  V.library = (p, q) => {
    if (p[0] === 'reconcile') return `<h1>Library</h1>${sub('library', LIBTABS, 'reconcile')}<p class="lead">Where documents disagree, each version side by side in date order, and what would settle it. The library does not choose.</p>${B.reconcile(D).map(r => `<section class="card" data-rec="${esc(r.topic)}"><h2>${esc(r.topic[0].toUpperCase() + r.topic.slice(1))}</h2><div class="scroll"><table><tr><th>As at</th><th>Version</th><th>Evidence</th></tr>${r.versions.map(v => `<tr><td>${fmt(v.asAt)}</td><td><a href="#/claim/${v.id}">${esc(v.value ? v.value + ' — ' + v.measure : v.text.slice(0, 110) + '…')}</a></td><td>${chipClass(v.src)}</td></tr>`).join('')}</table></div><p class="small"><strong>What would settle it:</strong></p><ul class="small">${r.settle.map(q => `<li>${esc(q.text)} <em>(${q.awaiting})</em></li>`).join('') || '<li>No question recorded yet.</li>'}</ul></section>`).join('')}`;
    if (p[0] === 'stories') return `<h1>Library</h1>${sub('library', LIBTABS, 'stories')}<p class="lead">Short reads built from the evidence. Each one lists its sources and says how sure it is.</p>${(D.stories || []).map(storyCard).join('')}`;
    if (p[0] === 'sources') return `<h1>Library</h1>${sub('library', LIBTABS, 'sources')}<ul class="plain">${D.sources.map(s => `<li><a class="card" href="#/source/${s.id}">${chipClass(s)}${s.restricted ? '<span class="chip bad">Restricted: not opened</span>' : ''}<strong>${esc(s.title)}</strong><p class="small">Published ${fmt(s.published)} · ${esc(B.ACCESS_LABEL[s.access])}${s.checked ? ' ' + fmt(s.checked) : ''}</p></a></li>`).join('')}</ul>`;
    const f = { q: q.get('q') || '', cls: q.get('class') || '', topic: q.get('topic') || '', conf: q.get('conflicts') === '1' };
    const topics = [...new Set(D.claims.map(c => c.topic))].sort(), words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = D.claims.filter(c => (!f.cls || S[c.source].class === f.cls) && (!f.topic || c.topic === f.topic) && (!f.conf || (c.conflicts || []).length) && words.every(w => (c.text + ' ' + c.topic + ' ' + S[c.source].title + ' ' + c.id).toLowerCase().includes(w)));
    const measures = list.filter(c => c.measure);
    return `<h1>Library</h1>${sub('library', LIBTABS, 'claims')}
    <form data-form="library" class="card"><label for="lq">Search claims</label><input id="lq" name="q" type="search" value="${esc(f.q)}" autocomplete="off">
    <div class="row"><div><label for="lc">Type of evidence</label><select id="lc" name="class"><option value="">All</option>${B.CLASSES.map(c => `<option value="${c}"${f.cls === c ? ' selected' : ''}>${B.CLASS_LABEL[c]}</option>`).join('')}</select></div>
    <div><label for="lt">Topic</label><select id="lt" name="topic"><option value="">All</option>${topics.map(t => `<option${f.topic === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
    <label class="check"><input type="checkbox" name="conflicts" value="1"${f.conf ? ' checked' : ''}> Only claims with conflicting evidence</label><button>Apply</button></form>
    <p class="small" id="count">${list.length} of ${D.claims.length} claims</p>
    ${measures.length > 1 ? `<div class="card"><strong>These figures measure different things</strong><div class="scroll"><table><tr><th>Figure</th><th>What it counts</th><th>From</th></tr>${measures.map(c => `<tr><td>${esc(c.value)}</td><td>${esc(c.measure)}</td><td><a href="#/claim/${c.id}">${esc(S[c.source].title)}</a></td></tr>`).join('')}</table></div><p class="small">Do not swap one for another. None is an official register count.</p></div>` : ''}
    ${list.map(c => evidence(c.id, true)).join('') || '<p class="card">No claims match. Clear a filter or try a different word.</p>'}`;
  };
  V.claim = p => {
    const c = B.claimView(D, p[0]); if (!c) return notFound();
    const used = [].concat(D.apps.filter(a => a.claims.includes(c.id)).map(a => 'App: ' + a.name), D.decisions.filter(x => x.claims.includes(c.id)).map(x => 'Decision: ' + x.text), D.questions.filter(x => x.claims.includes(c.id)).map(x => 'Open question: ' + x.text), D.scenarios.filter(sc => JSON.stringify(sc).includes('"' + c.id + '"')).map(sc => 'Practice: ' + sc.title));
    return `<p><a href="#/library">← Library</a></p><h1>${c.kind === 'statement' ? 'What the document says' : "This library's reading"}</h1>
    ${c.status === 'retracted' ? '<p class="note bad"><strong>Retracted.</strong> Kept so the correction stays visible.</p>' : ''}${c.recollection ? '<p class="note"><strong>A recollection, not a finding.</strong> This records what one person remembers or was told. It does not establish that it is so.</p>' : ''}
    <div class="card">${chipClass(c.src)}<p>${esc(c.text)}</p></div>
    <dl><dt>Source</dt><dd><a href="#/source/${c.src.id}">${esc(c.src.title)}</a></dd><dt>Where in the source</dt><dd>${esc(c.locator)}</dd>
    <dt>Published</dt><dd>${fmt(c.published)}${c.publishedNote ? ' — ' + esc(c.publishedNote) : ''}</dd>
    <dt>True as at</dt><dd>${fmt(c.asAt)}${c.measure ? ' — a figure for that date; it does not tell you the current number' : ''}</dd>
    <dt>Verification</dt><dd>${esc(B.VERIFICATION_LABEL[c.verification])}${c.verified ? ', ' + fmt(c.verified) + ' (' + esc(B.ACCESS_LABEL[c.src.access]) + ')' : ' — ' + esc(B.ACCESS_LABEL[c.src.access])}</dd>
    <dt>Support</dt><dd>${esc(B.SUPPORT_LABEL[c.support])}</dd>
    <dt>Human check</dt><dd id="human">${state.humanChecks[c.id] ? `Checked against the original by <strong>${esc(state.humanChecks[c.id].by)}</strong> on ${fmt(state.humanChecks[c.id].date)} (your record). <button class="link" data-act="human-del" data-id="${c.id}">Remove</button>` : `None yet. <label for="hc-by" class="small">If you have compared this wording with the original yourself, enter your name:</label><input type="text" id="hc-by"><button class="sec" data-act="human-save" data-id="${c.id}">I checked this against the original</button>`}</dd>
    <dt>Confidence</dt><dd>${c.confidence}</dd><dt>Limits of this source</dt><dd>${esc(c.src.limits)}</dd></dl>
    ${(c.conflicts || []).length ? `<h2>Conflicting evidence</h2><p class="small">Shown side by side. The library does not pick a winner.</p>${c.conflicts.map(k => `<p class="note">${esc(k.note)}</p>${evidence(k.id, true)}`).join('')}` : ''}
    ${c.superseded_by ? `<h2>Superseded by</h2>${evidence(c.superseded_by, true)}` : ''}${(c.supersedes || []).length ? `<h2>Replaces</h2>${c.supersedes.map(x => evidence(x, true)).join('')}` : ''}
    ${(c.depends_on || []).length ? `<h2>Depends on an unconfirmed rule</h2>${c.depends_on.map(r => { const rule = D.rules.find(x => x.id === r); return `<p class="note">${esc(rule.title)}<br><span class="small">Ask: ${esc(Q[rule.ask].text)}</span></p>`; }).join('')}` : ''}
    ${used.length ? `<h2>Used by</h2><ul>${used.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}<p class="small">Record ${c.id}</p>`;
  };
  V.source = p => {
    const s = S[p[0]]; if (!s) return notFound(); const cl = D.claims.filter(c => c.source === s.id);
    return `<p><a href="#/library/sources">← Sources</a></p><h1>${esc(s.title)}</h1>${chipClass(s)}${s.private ? '<span class="chip">Private</span>' : ''}${s.restricted ? '<span class="chip bad">Restricted</span>' : ''}
    <dl><dt>Published</dt><dd>${fmt(s.published)}${s.published_note ? ' — ' + esc(s.published_note) : ''}</dd><dt>Where it is</dt><dd>${esc(s.location)}</dd>
    <dt>How this build checked it</dt><dd>${esc(B.ACCESS_LABEL[s.access])}${s.checked ? ', ' + fmt(s.checked) : ''}</dd><dt>Limits</dt><dd>${esc(s.limits)}</dd></dl>
    ${s.url && !s.restricted ? `<p><a class="btn sec" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open the original${s.private ? ' (needs your sign-in)' : ''}</a></p>` : ''}
    <h2>Claims from this source (${cl.length})</h2>${cl.map(c => evidence(c.id, true)).join('') || '<p class="card">No claims are drawn from this source.</p>'}`;
  };

  let card = { i: 0, shown: false };
  V.recall = () => { const cs = B.recallCards(D), c = cs[card.i % cs.length]; return `<p><a href="#/practice">← Practice</a></p><h1>Quick recall</h1><p class="small">Card ${card.i % cs.length + 1} of ${cs.length} · practice only</p><div class="card" id="recall"><p><strong>${esc(c.prompt)}</strong></p>${card.shown ? `<p>${esc(c.answer)}</p><p class="small"><a href="#/claim/${c.id}">See the evidence</a></p>` : ''}</div><p>${card.shown ? '<button data-act="card-next">Next card</button>' : '<button data-act="card-show">Show answer</button>'}</p>`; };
  V.pathway = () => {
    const st = B.pathwayStatus(D, state.pathway), est = B.ordinaryEstimate(D, state.pathway._est || {}), o = state.pathway._est || {};
    const label = { confirmed: ['ok', 'Officially confirmed (as recorded by you)'], 'self-recorded': ['warn', 'Recorded by you — not officially confirmed'], available: ['', 'You can do this next'], blocked: ['bad', 'Waiting on earlier steps'] };
    let stage = '', out = `<h1>Your pathway</h1><p class="lead">What you can do next, based on the prerequisites in the evidence. Your ticks are your own record; only the brigade or RFS can confirm completion.</p>
    <h2>What can I do next?</h2><ul id="next">${st.filter(x => x.status === 'available').map(x => `<li>${esc(x.step.title)}</li>`).join('') || '<li>Nothing is available until earlier steps are recorded.</li>'}</ul>`;
    st.forEach(x => {
      const p = x.step, r = x.record;
      if (p.stage !== stage) { stage = p.stage; out += `<h2>${esc(stage)}</h2>`; }
      out += `<section class="card" data-step="${p.id}"><span class="chip ${label[x.status][0]}">${label[x.status][1]}</span>${p.uncertain_rule ? '<span class="chip warn">Order or rule unconfirmed</span>' : ''}<h3>${esc(p.title)}</h3>
      ${x.missing.length ? `<p class="small">Needs first: ${x.missing.map(m => esc(D.pathway.steps.find(s => s.id === m).title)).join('; ')}</p>` : ''}
      ${x.unconfirmed.length && x.status !== 'blocked' ? `<p class="small">Relies on steps you recorded yourself that are not yet officially confirmed.</p>` : ''}
      ${p.official_only ? '<p class="small">This cannot be self-recorded. Record it only when the brigade or RFS confirms it.</p>' : `<label class="check"><input type="checkbox" data-act="path-self" data-id="${p.id}"${r.self ? ' checked' : ''}> I have done this${r.self ? ' (recorded ' + fmt(r.self) + ')' : ''}</label>`}
      <details><summary>Official confirmation and evidence</summary>
      <label for="ob-${p.id}">Confirmed by (name or system, e.g. "training record in Member Portal")</label><input type="text" id="ob-${p.id}" value="${esc(r.officialBy || '')}">
      <label for="od-${p.id}">Date confirmed</label><input type="date" id="od-${p.id}" value="${esc(r.official || '')}">
      <label for="on-${p.id}">Your note (where your proof is kept)</label><input type="text" id="on-${p.id}" value="${esc(r.selfNote || '')}">
      <p><button data-act="path-official" data-id="${p.id}">Save</button> ${r.official ? `<button class="sec" data-act="path-clear" data-id="${p.id}">Clear confirmation</button>` : ''}</p>
      ${p.question ? (state.answers[p.question] ? `<p class="note ok">You recorded an answer: ${esc(state.answers[p.question].text)} <span class="small">(${esc(state.answers[p.question].by || 'source not given')})</span></p>` : `<p class="note">Still to confirm: ${esc(Q[p.question].text)}</p>`) : ''}${p.basis.map(b => evidence(b, true)).join('')}</details></section>`;
    });
    out += `<h2>Ordinary membership: estimate only</h2><div class="card" id="estimate"><p><strong>Earliest end of minimum probation: ${fmt(est.earliest)}</strong> <span class="chip ${est.provisional ? 'warn' : 'ok'}">${est.provisional ? 'Estimate' : 'Based on inputs you marked verified'}</span></p><p>${esc(est.working)}</p>
    ${est.unresolved.length ? `<p class="small">Unresolved:</p><ul class="small">${est.unresolved.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    <label for="est-start">Probation start date</label><input type="date" id="est-start" value="${esc(est.start)}">
    <label class="check"><input type="checkbox" id="est-cv"${o.commencementVerified ? ' checked' : ''}> The brigade or RFS has confirmed this start date</label>
    <label class="check"><input type="checkbox" id="est-rv"${o.ruleVerified ? ' checked' : ''}> The captain has confirmed the six-month rule applies to Burrabadine</label>
    <button data-act="est-save">Update estimate</button>${evidence('C-PROB-SIX-MONTHS', true)}</div>
    <p class="small"><a href="#/data">Export, import or delete your pathway record</a></p>`;
    return out;
  };

  // ----- practice -----
  let run = null;
  const scenario = id => D.scenarios.find(s => s.id === id);
  V.practice = p => {
    if (p[0]) return player(p[0]);
    const weak = {}; Object.entries(state.practice).forEach(([id, r]) => { const sc = scenario(id); if (!sc || !r.last) return; r.last.path.filter(s => s.quality !== 'best').forEach(s => sc.nodes[s.node].choices.find(c => c.quality === 'best').claims.forEach(c => weak[c] = sc.title)); });
    return `<h1>Practice</h1><p class="practice-banner"><strong>Practice only.</strong> These scenarios help you learn where things are and who to ask. They do not grant any qualification and are not advice for a live incident.</p>
    <ul class="plain">${D.scenarios.map(sc => { const r = state.practice[sc.id]; return `<li><a class="card" href="#/practice/${sc.id}"><span class="chip">${esc(sc.category.replace('-', ' '))}</span><strong>${esc(sc.title)}</strong><p>${esc(sc.summary)}</p><p class="small">${r ? `Completed ${r.runs} time${r.runs === 1 ? '' : 's'} · last run ${r.last.score}/${r.last.path.length} best choices` : 'Not attempted'}</p></a></li>`; }).join('')}</ul>
    <h2>Quick recall</h2><a class="card" href="#/recall"><strong>${B.recallCards(D).length} recall cards</strong><p class="small">Drawn only from text-checked, high-confidence records. Tests your memory, not whether the source is right.</p></a>
    <h2>Targeted revision</h2>${Object.keys(weak).length ? `<p class="small">From choices in your last runs that were not the best option:</p>${Object.keys(weak).map(c => evidence(c, true)).join('')}` : '<p class="card">Nothing to revise yet. Revision appears here after a run where a choice could have been better.</p>'}
    <p class="small">No operational (fireground) scenarios are offered: no current official training material has been supplied to base them on.</p>`;
  };
  function player(id) {
    const sc = scenario(id); if (!sc) return notFound();
    if (!run || run.id !== id) run = { id, node: sc.start, path: [], pending: null };
    const n = sc.nodes[run.node], head = `<p><a href="#/practice">← Practice</a></p><p class="practice-banner"><strong>Practice only.</strong> Not a qualification and not live incident advice.</p><h1>${esc(sc.title)}</h1>`;
    if (n.end) {
      const score = run.path.filter(s => s.quality === 'best').length;
      if (!run.saved) { const prev = state.practice[id] || { runs: 0 }; state.practice[id] = { runs: prev.runs + 1, last: { date: today(), path: run.path, score } }; save(); run.saved = true; }
      const rev = [...new Set(run.path.filter(s => s.quality !== 'best').flatMap(s => sc.nodes[s.node].choices.find(c => c.quality === 'best').claims))];
      return head + `<h2>Debrief</h2><p id="debrief">${esc(n.debrief)}</p><p><strong>${score} of ${run.path.length}</strong> choices were the best available.</p>
      ${run.path.map((s, i) => { const nd = sc.nodes[s.node]; return `<details${s.quality !== 'best' ? ' open' : ''}><summary>Step ${i + 1}: ${esc(nd.situation.slice(0, 70))}…</summary>${nd.choices.map(c => `<div class="note ${c.quality === 'best' ? 'ok' : c.quality === 'poor' ? 'bad' : ''}"><strong>${c.id === s.choice ? 'You chose: ' : ''}${esc(c.label)}</strong><br>${c.quality === 'best' ? 'Helps: ' : c.quality === 'ok' ? 'Partly helps: ' : 'Causes problems: '}${esc(c.why)}</div>`).join('')}</details>`; }).join('')}
      <h2>Revision for you</h2><div id="revision">${rev.length ? rev.map(c => evidence(c, true)).join('') : '<p class="card">No revision needed from this run.</p>'}</div>
      <h2>Learning material</h2><p>${esc(sc.learn.label)}</p>${sc.learn.claims.map(c => evidence(c, true)).join('')}
      <p><button data-act="run-restart" data-id="${id}">Try again</button> <a class="btn sec" href="#/practice">All scenarios</a></p>`;
    }
    if (run.pending) {
      const c = n.choices.find(x => x.id === run.pending);
      return head + `<p class="small">Step ${run.path.length} · you chose</p><div class="card"><strong>${esc(c.label)}</strong></div><div class="note ${c.quality === 'best' ? 'ok' : c.quality === 'poor' ? 'bad' : ''}" id="consequence"><p><strong>What happens:</strong> ${esc(c.consequence)}</p><p><strong>Why:</strong> ${esc(c.why)}</p></div>
      <details><summary>Evidence behind this</summary>${c.claims.map(x => evidence(x, true)).join('')}</details><p><button data-act="run-next">Continue</button></p>`;
    }
    return head + `<p class="small">Step ${run.path.length + 1}</p><p id="situation">${esc(n.situation)}</p><div role="group" aria-label="Your options">${n.choices.map(c => `<button class="choice" data-act="run-choose" data-c="${c.id}">${esc(c.label)}</button>`).join('')}</div>`;
  }

  // ----- secretary -----
  const SEC = [['agenda', 'Agenda'], ['minutes', 'Minutes'], ['actions', 'Actions'], ['quorum', 'Roster & quorum'], ['forms', 'Forms'], ['pack', 'Meeting pack']];
  const meeting = () => { if (!state.meetings.length) state.meetings.push({ date: '', time: '19:00', place: 'Burrabadine Shed', extra: [], notes: {}, decisions: [] }); return state.meetings[0]; };
  const kindLabel = { resolution: 'Resolution (moved, seconded, carried)', noted: 'Noted (no vote)', request: 'Request from an officer' };
  function agendaHTML(m) { const a = B.buildAgenda(m, state.actions); return `<ol>${a.items.map(i => `<li>${esc(i.title)}${i.carried.length ? `<ul>${i.carried.map(c => `<li>${esc(c.text)} — ${esc(c.owner)}${c.due ? ', due ' + fmt(c.due) : ''} <span class="small">(from ${esc(c.origin.replace('M-', ''))})</span></li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`; }
  function packHTML(m) {
    const open = state.actions.filter(a => a.status !== 'done');
    return `<h1>Burrabadine Rural Fire Brigade — meeting pack</h1><p><strong>DRAFT prepared ${fmt(today())}. Not approved minutes.</strong></p><p>Meeting: ${m.date ? fmt(m.date) : '________'} at ${esc(m.time || '____')}, ${esc(m.place || '________')}</p>
    <h2>Agenda</h2>${agendaHTML(m)}<h2>Open actions carried forward</h2><table><tr><th>Action</th><th>Owner</th><th>Due</th><th>From</th></tr>${open.map(a => `<tr><td>${esc(a.text)}</td><td>${esc(a.owner)}</td><td>${a.due ? fmt(a.due) : ''}</td><td>${esc(a.origin.replace('M-', ''))}</td></tr>`).join('') || '<tr><td colspan="4">None</td></tr>'}</table>
    <h2 class="pagebreak">Draft minutes</h2>${B.STANDING.concat(m.extra).map(t => `<h3>${esc(t)}</h3><p>${esc(m.notes[t] || '') || '<span class="line" style="display:block"></span><span class="line" style="display:block"></span>'}</p>`).join('')}
    <h2>Decisions recorded</h2><table><tr><th>Decision</th><th>Type</th><th>Moved / seconded</th><th>Owner</th><th>Due</th><th>Source</th></tr>${m.decisions.map(d => `<tr><td>${esc(d.text)}</td><td>${esc(kindLabel[d.kind])}</td><td>${esc(d.moved || '')}${d.seconded ? ' / ' + esc(d.seconded) : ''}</td><td>${esc(d.owner || '')}</td><td>${d.due ? fmt(d.due) : ''}</td><td>${esc(d.source || '')}</td></tr>`).join('') || '<tr><td colspan="6">None recorded</td></tr>'}</table>
    <p>Quorum: record the number of eligible members present and the rule used. __________________________________</p>`;
  }
  const packText = m => $('#print-area').ownerDocument.createRange().createContextualFragment(packHTML(m).replace(/<\/(h1|h2|h3|p|li|tr)>/g, '\n</$1>').replace(/<\/t[dh]>/g, ' | ')).textContent.replace(/\n{3,}/g, '\n\n');
  V.secretary = p => {
    const tab = p[0] || 'agenda', m = meeting(), head = `<h1>Secretary workbench</h1><p class="small">A drafting aid for the brigade secretary. It prints and exports; it does not send anything or update any RFS system.</p>${sub('secretary', SEC, tab)}`;
    if (tab === 'agenda') return head + `<form data-form="meeting" class="card"><div class="row"><div><label for="m-date">Meeting date</label><input type="date" id="m-date" name="date" value="${esc(m.date)}"></div><div><label for="m-time">Time</label><input type="time" id="m-time" name="time" value="${esc(m.time)}"></div></div><label for="m-place">Place</label><input type="text" id="m-place" name="place" value="${esc(m.place)}">
      <label for="m-extra">Extra agenda items (one per line)</label><textarea id="m-extra" name="extra">${esc(m.extra.join('\n'))}</textarea><button>Save and rebuild agenda</button></form>
      <h2>Agenda</h2><div class="card" id="agenda">${agendaHTML(m)}</div><p class="small">Open actions appear under Business arising automatically. Close them in <a href="#/secretary/actions">Actions</a>.</p><p><button data-act="print-agenda">Print agenda</button></p>`;
    if (tab === 'minutes') return head + `<p class="small">Notes save as you type and stay on this device.</p>${B.STANDING.concat(m.extra).map((t, i) => `<label for="mn-${i}">${esc(t)}</label><textarea id="mn-${i}" data-note="${esc(t)}">${esc(m.notes[t] || '')}</textarea>`).join('')}
      <h2>Decisions</h2><p class="small">Choose the type honestly: only something moved, seconded and carried is a resolution.</p><ul class="plain" id="decisions">${m.decisions.map((d, i) => `<li class="card"><span class="chip">${esc(kindLabel[d.kind])}</span><p>${esc(d.text)}</p><p class="small">${d.moved ? 'Moved ' + esc(d.moved) + (d.seconded ? ', seconded ' + esc(d.seconded) : '') + ' · ' : ''}${d.owner ? 'Owner ' + esc(d.owner) + ' · ' : ''}${d.due ? 'Due ' + fmt(d.due) + ' · ' : ''}${d.source ? 'Source: ' + esc(d.source) : 'No source reference'}</p><button class="sec" data-act="dec-del" data-i="${i}">Remove</button></li>`).join('') || '<li class="card">No decisions recorded yet.</li>'}</ul>
      <form data-form="decision" class="card"><h3>Add a decision</h3><label for="d-text">What was decided</label><textarea id="d-text" name="text" required></textarea><label for="d-kind">Type</label><select id="d-kind" name="kind" required><option value="">Choose…</option>${Object.entries(kindLabel).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <div class="row"><div><label for="d-moved">Moved by</label><input type="text" id="d-moved" name="moved"></div><div><label for="d-sec">Seconded by</label><input type="text" id="d-sec" name="seconded"></div></div>
      <div class="row"><div><label for="d-owner">Owner of any follow-up</label><input type="text" id="d-owner" name="owner"></div><div><label for="d-due">Due</label><input type="date" id="d-due" name="due"></div></div>
      <label for="d-src">Source reference (e.g. "Correspondence from Orana, 3 Nov")</label><input type="text" id="d-src" name="source"><label class="check"><input type="checkbox" name="action" value="1"> Also add the follow-up to the action register</label><button>Add decision</button></form>`;
    if (tab === 'actions') return head + `<ul class="plain" id="actions">${state.actions.map((a, i) => `<li class="card" data-action="${esc(a.id)}"><span class="chip ${a.status === 'done' ? 'ok' : 'warn'}">${a.status === 'done' ? 'Done' : 'Open'}</span><strong>${esc(a.text)}</strong><p class="small">Owner: ${esc(a.owner || 'not recorded')}${a.due ? ' · due ' + fmt(a.due) : ''} · from ${esc(a.origin.replace('M-', ''))}</p>
      <button class="sec" data-act="act-toggle" data-i="${i}">${a.status === 'done' ? 'Reopen' : 'Mark done'}</button><details><summary>History (${a.history.length})</summary><ul class="small">${a.history.map(h => `<li>${fmt(h.date)}: ${esc(h.event)}</li>`).join('')}</ul></details></li>`).join('')}</ul>
      <form data-form="action" class="card"><h3>Add an action</h3><label for="a-text">Action</label><input type="text" id="a-text" name="text" required><div class="row"><div><label for="a-owner">Owner</label><input type="text" id="a-owner" name="owner"></div><div><label for="a-due">Due</label><input type="date" id="a-due" name="due"></div></div><button>Add action</button></form><p><button class="sec" data-act="act-csv">Export register as CSV</button></p>`;
    if (tab === 'quorum') return head + quorumView();
    if (tab === 'forms') return head + `<div class="card"><h2>Summer absence form</h2><p>For members to tell the captain when they will be away, as he asked in September.</p>${evidence('C-SUMMER-ABSENCE', true)}<button data-act="print-form" data-f="summer">Print form</button></div>
      <div class="card"><h2>Training interest form</h2><p>For members to tell the training contact what they would like to do.</p>${evidence('C-TRAIN-MONTHLY', true)}<button data-act="print-form" data-f="training">Print form</button></div><div class="card"><h2>Christmas party invitation</h2><p>A letterbox invitation with the date, time and RSVP left blank until the brigade confirms them.</p>${evidence('C-XMAS-SEPT', true)}<button data-act="print-form" data-f="xmas">Print invitation</button></div><p class="small">Forms are blank paper forms. Nothing typed here is collected.</p>`;
    return head + `<p>A draft pack: agenda, carried-forward actions, draft minutes and decisions.</p><div class="card" id="pack">${packHTML(m)}</div><p><button data-act="print-pack">Print pack</button> <button class="sec" data-act="export-pack">Export as text file</button></p>`;
  };
  const FORMS = {
    xmas: `<div style="text-align:center;border:3px double #000;padding:28pt 22pt"><p style="letter-spacing:3pt">YOU ARE INVITED</p><h1 style="font-size:26pt;margin:6pt 0">Burrabadine Rural Fire Brigade<br>Christmas Party</h1><p>Your local volunteer brigade would love to see you, your family and your neighbours.</p><p style="font-size:14pt;line-height:2.2">Date: ____________________<br>Time: ____________________<br>Where: ___________________<br>Bring: ___________________<br>RSVP to: _________________</p><p>Come and meet the people who turn out when our area needs them.</p></div><p style="font-size:9pt;text-align:center">Draft invitation. Date, time and wording to be confirmed by the brigade before it is delivered.</p>`,
    summer: `<h1>Burrabadine Rural Fire Brigade</h1><h2>Summer absence notice</h2><p>The captain has asked members to let him know if they will be away over summer, so crew strength is known. Please return this form to the captain.</p><table><tr><th style="width:35%">Name</th><td>&nbsp;</td></tr><tr><th>Away from (date)</th><td>&nbsp;</td></tr><tr><th>Back on (date)</th><td>&nbsp;</td></tr><tr><th>Second period away, if any</th><td>&nbsp;</td></tr><tr><th>Best way to reach you while away (optional)</th><td>&nbsp;</td></tr><tr><th>Anything else the captain should know</th><td><br><br></td></tr></table><p>Signed: ______________________ Date: ____________</p><p style="font-size:9pt">This form only tells the captain when you are away. It does not change your membership or record your availability in any RFS system.</p>`,
    training: `<h1>Burrabadine Rural Fire Brigade</h1><h2>Training interest</h2><p>The brigade plans training about once a month. Tell the training contact what you would like to do.</p><table><tr><th style="width:35%">Name</th><td>&nbsp;</td></tr><tr><th>Training or skills I would like</th><td><br><br><br></td></tr><tr><th>RFS courses I am interested in</th><td><br><br></td></tr><tr><th>Days or times that suit me</th><td><br></td></tr><tr><th>I could help run a session on</th><td><br></td></tr></table><p>Date: ____________</p><p style="font-size:9pt">An expression of interest only. Course enrolment and prerequisites are handled through official RFS channels.</p>`
  };
  function quorumView() {
    const qi = state.quorumInputs, an = roster && roster.column ? B.analyseRoster(roster.parsed, roster.column, roster.eligible) : null;
    const num = v => v === '' || v == null ? NaN : Number(v);
    const res = qi.tried ? B.quorum({ eligible: num(qi.eligible), percent: num(qi.percent), rounding: qi.rounding, basis: qi.basis, present: Number.isInteger(num(qi.present)) ? num(qi.present) : undefined, ruleConfirmed: qi.ruleConfirmed, countConfirmed: qi.countConfirmed }) : null;
    return `<h2>Membership list (optional)</h2><p class="small">A CSV you choose is read in this browser tab only. It is held in memory, never saved, uploaded, cached or exported, and is gone when you close or reload the page.</p>
    ${roster ? `<div class="card" id="roster"><p><strong>${roster.demo ? 'Fake demonstration roster' : 'Your roster'}</strong>: ${roster.parsed.rows.length} rows${roster.parsed.ragged ? ` · ${roster.parsed.ragged} row(s) have the wrong number of columns` : ''}</p>
      <label for="r-col">Which column holds the membership category?</label><select id="r-col" data-act-change="roster-col"><option value="">Choose…</option>${roster.parsed.header.map(h => `<option${roster.column === h ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select>
      ${an && an.ok ? `<div class="scroll"><table><tr><th>${esc(an.column)}</th><th>Count</th><th>Counts toward quorum?</th></tr>${Object.entries(an.counts).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td><td><label class="check"><input type="checkbox" data-act="roster-elig" data-v="${esc(k)}"${(roster.eligible || []).includes(k) ? ' checked' : ''}> <span>Yes<span class="small"> — ${esc(k)}</span></span></label></td></tr>`).join('')}${an.blank ? `<tr><td><em>Blank</em></td><td>${an.blank}</td><td class="small">Not counted. Category unknown.</td></tr>` : ''}<tr><th>Total rows</th><th>${an.total}</th><th></th></tr></table></div>
      <p class="small">You decide which categories count; the app does not infer eligibility from category names, attendance or any other column.</p>${an.eligible !== undefined ? `<p><button data-act="roster-use">Use ${an.eligible} as the eligible count</button></p>` : ''}` : '<p class="note">Choose the category column. It is never guessed.</p>'}
      <button class="danger" data-act="roster-clear">Delete this roster from memory</button></div>` : `<div class="card"><label for="r-file">Choose a CSV file</label><input type="file" id="r-file" accept=".csv,text/csv"><p><button class="sec" data-act="roster-demo">Load fake demonstration roster</button></p></div>`}
    <h2>Quorum calculator</h2><p class="note">Provisional until the brigade's own rule is confirmed. The 2018 model constitution is reference material here, not an assumed rule. <a href="#/claim/C-QUORUM-MODEL">See the evidence</a>.</p>
    <form data-form="quorum" class="card"><label for="q-el">Members eligible to count toward quorum</label><input type="number" id="q-el" name="eligible" min="0" step="1" inputmode="numeric" value="${esc(qi.eligible ?? '')}">
    <label for="q-basis">Which categories did you count as eligible?</label><input type="text" id="q-basis" name="basis" value="${esc(qi.basis || '')}" placeholder="e.g. ordinary members on the register at 1 Nov">
    <div class="row"><div><label for="q-pc">Quorum percentage</label><input type="number" id="q-pc" name="percent" min="0" max="100" step="any" inputmode="decimal" value="${esc(qi.percent ?? '')}"></div><div><label for="q-rd">Rounding of a fraction</label><select id="q-rd" name="rounding"><option value="">Choose…</option>${[['up', 'Round up'], ['nearest', 'Round to nearest'], ['down', 'Round down']].map(([k, l]) => `<option value="${k}"${qi.rounding === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <label for="q-pr">Eligible members present (optional)</label><input type="number" id="q-pr" name="present" min="0" step="1" inputmode="numeric" value="${esc(qi.present ?? '')}">
    <label class="check"><input type="checkbox" name="ruleConfirmed" value="1"${qi.ruleConfirmed ? ' checked' : ''}> The captain or district has confirmed this percentage, these categories and this rounding for Burrabadine</label>
    <label class="check"><input type="checkbox" name="countConfirmed" value="1"${qi.countConfirmed ? ' checked' : ''}> The eligible count has been checked against the brigade register</label><button>Calculate</button></form>
    <div id="quorum-result" aria-live="polite">${!res ? '' : !res.ok ? `<div class="note bad"><strong>More information is needed.</strong><ul>${res.need.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : `<div class="card"><p><span class="chip ${res.provisional ? 'warn' : 'ok'}">${res.provisional ? 'PROVISIONAL' : 'Based on confirmed inputs'}</span></p><p><strong>Quorum: ${res.required}</strong></p><p>${esc(res.explanation)}</p><dl><dt>Denominator</dt><dd>${res.denominator} eligible members — ${esc(res.basis)}</dd><dt>Rule used</dt><dd>${res.percent}%, rounded ${res.rounding}</dd></dl>
      ${res.met !== undefined ? `<p><strong>${res.present} eligible present: quorum ${res.met ? 'met' : 'not met'}.</strong> <span class="small">${esc(res.presentNote)}</span></p>` : ''}${res.notes.map(n => `<p class="note">${esc(n)}</p>`).join('')}${res.assumptions.length ? `<p class="small">Assumptions:</p><ul class="small">${res.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}</div>`}</div>`;
  }

  V.quality = () => {
    const q = B.quality(D, today()), sec = (id, t, n, body, open) => `<details id="${id}"${open ? ' open' : ''}><summary>${t} (${n})</summary>${body}</details>`;
    const li = (id, why) => `<li><a href="#/claim/${id}">${esc(C[id] ? C[id].text.slice(0, 90) : id)}…</a>${why ? `<br><span class="small">${esc(why)}</span>` : ''}</li>`;
    const pe = D.allowlist ? B.publicExport(D, D.allowlist, B.privateTerms(D)) : null;
    return `<h1>Research quality</h1><p class="lead">Where the evidence is weak, contradictory or missing. Nothing here is hidden to make the library look finished.</p>
    ${sec('q-conf', 'Conflicting claims', q.conflicts.length, `<ul>${q.conflicts.map(p => `<li><strong>${esc(p.note)}</strong><br><span class="small"><a href="#/claim/${p.a}">${esc(C[p.a].text.slice(0, 70))}…</a><br>versus <a href="#/claim/${p.b}">${esc(C[p.b].text.slice(0, 70))}…</a></span></li>`).join('')}</ul>`, true)}
    ${sec('q-unsup', 'Unsupported or unverified claims', q.unsupported.length, `<ul>${q.unsupported.map(x => li(x.id, x.why)).join('')}</ul>`)}
    ${sec('q-retr', 'Corrections carried through', q.retracted.length, `<ul>${q.retracted.map(x => li(x.id, 'Replaced by ' + x.by)).join('')}</ul>`, true)}
    ${sec('q-out', 'Outdated or historical sources', q.outdated.length, `<ul>${q.outdated.map(x => `<li><a href="#/source/${x.id}">${esc(S[x.id].title)}</a> — ${esc(x.why)}</li>`).join('')}</ul>`)}
    ${sec('q-links', 'Links that did not open', q.links ? q.links.length : 0, q.links ? `<p class="small">Checked ${fmt(q.linksChecked)} from the build machine. "Blocked" means the site refused an automated check; the page may be fine in your browser.</p><ul>${q.links.map(l => `<li><a href="#/source/${l.id}">${esc(S[l.id].title)}</a> — ${esc(l.status)}${l.code ? ' (HTTP ' + l.code + ')' : ''}</li>`).join('')}</ul>` : '<p>No link check has been run. Run <code>node scripts/linkcheck.js</code>.</p>')}
    ${sec('q-await', 'Awaiting brigade confirmation', q.awaiting.length, `<p><button class="sec" data-act="print-questions">Print questions sheet</button></p>` + ['captain', 'secretary', 'district'].map(w => `<h3>${w[0].toUpperCase() + w.slice(1)}</h3><ul class="plain">${q.awaiting.filter(x => x.awaiting === w).map(x => { const a = state.answers[x.id]; return `<li class="card" data-q="${x.id}">${a ? '<span class="chip ok">Answer recorded by you</span>' : ''}<p>${esc(x.text)}</p>${a ? `<p class="note ok">${esc(a.text)}<br><span class="small">${esc(a.by || 'source not given')} · ${fmt(a.date)}. Your record; the library's evidence is unchanged until a document supports it.</span></p>` : ''}<details><summary>${a ? 'Change' : 'Record'} an answer</summary><label for="an-${x.id}">What you were told</label><textarea id="an-${x.id}">${esc(a ? a.text : '')}</textarea><label for="ab-${x.id}">Who told you, and how (e.g. "Captain, at the January meeting")</label><input type="text" id="ab-${x.id}" value="${esc(a ? a.by : '')}"><p><button data-act="ans-save" data-id="${x.id}">Save answer</button> ${a ? `<button class="sec" data-act="ans-del" data-id="${x.id}">Remove</button>` : ''}</p></details></li>`; }).join('')}</ul>`).join(''))}
    ${sec('q-rule', 'Records that depend on an uncertain rule', q.ruleDependent.length, q.ruleDependent.map(r => `<h3>${esc(r.rule.title)}</h3><ul>${r.claims.map(c => li(c)).join('')}${r.steps.map(s => `<li>Pathway step: ${esc(D.pathway.steps.find(p => p.id === s).title)}</li>`).join('')}</ul>`).join(''))}
    ${sec('q-log', 'Search log', (D.searchLog || []).length, `<p class="small">Every search behind this library, including the ones that failed.</p><div class="scroll"><table><tr><th>Where</th><th>What</th><th>Result</th></tr>${(D.searchLog || []).map(e => `<tr><td>${esc(e.where)}<br><span class="small">${fmt(e.date)}</span></td><td>${esc(e.query)}</td><td>${esc(e.result)}</td></tr>`).join('')}</table></div>`)}
    ${sec('q-cov', 'Missing source coverage', q.coverage.missing.length + q.coverage.sourcesNotRead.length, `<h3>Not held at all</h3><ul>${q.coverage.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul><h3>Sources not read in this build</h3><ul>${q.coverage.sourcesNotRead.map(x => `<li><a href="#/source/${x.id}">${esc(S[x.id].title)}</a> — ${esc(x.why)}</li>`).join('')}</ul>${q.coverage.questionsWithoutEvidence.length ? `<h3>Questions with no evidence yet</h3><ul>${q.coverage.questionsWithoutEvidence.map(x => `<li>${esc(Q[x].text)}</li>`).join('')}</ul>` : ''}`)}
    <h2>Public-safe export</h2>${pe ? `<div class="card" id="public-export"><p>${pe.records.length} record(s) pass every check and could be offered to Orana Fieldnotes. ${pe.rejected.length} allowlisted or flagged record(s) were refused.</p><p class="small">A record leaves only if it is on the reviewed allowlist, comes from a public official source, is not rule-dependent, and its text contains no private names, contact details or private links. Fields copied: ${pe.fields.join(', ')}.</p>${pe.rejected.length ? `<ul class="small">${pe.rejected.map(r => `<li>${r.id}: ${esc(r.why.join('; '))}</li>`).join('')}</ul>` : ''}<button class="sec" data-act="public-export">Download public-safe export</button></div>` : '<p>No allowlist found.</p>'}`;
  };

  V.data = () => `<h1>Your data</h1><p>Your pathway ticks, practice progress, research items, meeting drafts and action register are stored only in this browser on this device${storageOK ? '' : ' — <strong>storage is not available here, so nothing will be kept after you close this page</strong>'}. ${self.BBC_SYNC ? 'Nothing leaves this device unless you press "Save to my account" below.' : 'Nothing is sent anywhere.'} There are no analytics.</p>
    <p class="small">Imported rosters are never stored and are not part of an export.</p>
    <div class="card"><h2>Export</h2><p>Save a backup file you can restore later or on another device.</p><button data-act="export">Export my data</button></div>
    <div class="card"><h2>Import</h2><label for="imp">Choose a Companion export file. It replaces what is stored here.</label><input type="file" id="imp" accept=".json,application/json"><p id="imp-msg" class="small" role="status"></p></div>
    <div class="card"><h2>Delete</h2><p>Remove everything this app has stored on this device.</p><button class="danger" data-act="reset">Delete all my data</button></div>
    ${self.BBC_SYNC ? `<div class="card" id="sync"><h2>Account sync</h2><p>Signed in as <strong>${esc(self.BBC_SYNC.user)}</strong>. Saving is manual, so nothing leaves this device until you press a button. Imported rosters are never included.</p><p class="small"><strong>Private to you:</strong> pathway, practice progress, research items, recorded answers. <strong>Shared with everyone who can sign in:</strong> the action register and meeting drafts.</p><p><button data-act="sync-save">Save to my account</button> <button class="sec" data-act="sync-load">Load from my account</button></p><p id="sync-msg" class="small" role="status"></p><p><button class="danger" data-act="sync-out-all">Sign out on every device</button></p></div>` : ''}
    <p class="small">${'serviceWorker' in navigator && location.protocol.startsWith('http') ? 'Offline copy: the app pages and the evidence base are cached for offline use. Your records are not in that cache.' : 'Opened as a file: no offline cache is used.'}</p>`;
  const notFound = () => `<h1>Not found</h1><p>That page or record does not exist. <a href="#/">Go to the start</a>.</p>`;

  // ---------- router ----------
  function render(keepFocus) {
    const [path, qs] = (location.hash.slice(2) || '').split('?'), parts = path.split('/').filter(Boolean).map(decodeURIComponent), name = parts[0] || 'home';
    if (name !== 'practice' || !parts[1]) run = null;
    let html; try { html = (V[name] || notFound)(parts.slice(1), new URLSearchParams(qs || '')); } catch (e) { html = `<h1>Something went wrong</h1><p class="note bad">${esc(e.message)}</p><p><a href="#/">Go to the start</a></p>`; }
    main.innerHTML = html;
    document.querySelectorAll('.tabs a').forEach(a => a.dataset.tab === name || (name === 'claim' || name === 'source' || name === 'read') && a.dataset.tab === 'library' || name === 'recall' && a.dataset.tab === 'practice' ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    document.title = (main.querySelector('h1') ? main.querySelector('h1').textContent + ' · ' : '') + 'Burrabadine Companion';
    if (!keepFocus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  addEventListener('hashchange', () => render());

  // ---------- events ----------
  const go = h => { if (location.hash === h) render(); else location.hash = h; };
  main.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, fd = new FormData(f), g = k => (fd.get(k) || '').toString().trim(), m = meeting();
    switch (f.dataset.form) {
      case 'ask': return go('#/ask?q=' + encodeURIComponent(g('q')));
      case 'library': { const u = new URLSearchParams(); ['q', 'class', 'topic', 'conflicts'].forEach(k => g(k) && u.set(k, g(k))); return go('#/library?' + u); }
      case 'meeting': Object.assign(m, { date: g('date'), time: g('time'), place: g('place'), extra: g('extra').split('\n').map(s => s.trim()).filter(Boolean) }); save(); toast('Agenda rebuilt'); return render(true);
      case 'decision': m.decisions.push({ text: g('text'), kind: g('kind'), moved: g('moved'), seconded: g('seconded'), owner: g('owner'), due: g('due'), source: g('source') }); if (g('action')) state.actions.push({ id: 'ACT-' + Date.now(), text: g('text'), owner: g('owner'), due: g('due') || null, status: 'open', origin: 'M-' + (m.date || 'draft'), claims: [], history: [{ date: today(), event: 'Created from a decision in draft minutes' }] }); save(); toast('Decision added'); return render(true);
      case 'action': state.actions.push({ id: 'ACT-' + Date.now(), text: g('text'), owner: g('owner'), due: g('due') || null, status: 'open', origin: 'M-' + (m.date || 'draft'), claims: [], history: [{ date: today(), event: 'Created' }] }); save(); return render(true);
      case 'quorum': state.quorumInputs = { tried: true, eligible: g('eligible'), percent: g('percent'), rounding: g('rounding'), basis: g('basis'), present: g('present'), ruleConfirmed: !!g('ruleConfirmed'), countConfirmed: !!g('countConfirmed') }; save(); render(true); return $('#quorum-result').scrollIntoView({ block: 'nearest' });
    }
  });
  main.addEventListener('input', e => { const t = e.target; if (t.dataset.note) { meeting().notes[t.dataset.note] = t.value; save(); } });
  main.addEventListener('change', e => {
    const t = e.target, a = t.dataset.act;
    if (t.dataset.actChange === 'roster-col') { roster.column = t.value; roster.eligible = []; return render(true); }
    if (a === 'path-self') { const r = state.pathway[t.dataset.id] = state.pathway[t.dataset.id] || {}; r.self = t.checked ? today() : null; save(); return render(true); }
    if (a === 'roster-elig') { const s = new Set(roster.eligible); t.checked ? s.add(t.dataset.v) : s.delete(t.dataset.v); roster.eligible = [...s]; return render(true); }
    if (t.id === 'r-file' && t.files[0]) { const fr = new FileReader(); fr.onload = () => { try { roster = { parsed: B.parseCSV(fr.result), column: '', eligible: [] }; render(true); } catch (err) { toast(err.message); } }; fr.onerror = () => toast('That file could not be read.'); return fr.readAsText(t.files[0]); }
    if (t.id === 'imp' && t.files[0]) { const fr = new FileReader(); fr.onload = () => { try { state = B.importState(fr.result); if (!state.actions) state.actions = B.seedActions(D); save(); toast('Data restored'); go('#/pathway'); } catch (err) { $('#imp-msg').textContent = err.message; } }; return fr.readAsText(t.files[0]); }
  });
  main.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT') return; const a = t.dataset.act, m = meeting(), id = t.dataset.id;
    const acts = {
      'research-add': () => { if (!state.research.some(r => r.q === t.dataset.q)) state.research.push({ q: t.dataset.q, date: today() }); save(); toast('Saved as a research item'); },
      'research-del': () => { state.research.splice(+t.dataset.i, 1); save(); },
      'path-official': () => { const r = state.pathway[id] = state.pathway[id] || {}; r.officialBy = $('#ob-' + id).value.trim(); r.official = r.officialBy ? $('#od-' + id).value || null : null; r.selfNote = $('#on-' + id).value.trim(); save(); toast(r.official ? 'Confirmation recorded' : r.officialBy ? 'Add the date it was confirmed' : 'Note saved'); },
      'path-clear': () => { const r = state.pathway[id]; r.official = null; r.officialBy = ''; save(); },
      'est-save': () => { state.pathway._est = { commencement: $('#est-start').value || undefined, commencementVerified: $('#est-cv').checked, ruleVerified: $('#est-rv').checked }; save(); },
      'run-choose': () => { run.pending = t.dataset.c; const n = scenario(run.id).nodes[run.node]; run.path.push({ node: run.node, choice: run.pending, quality: n.choices.find(c => c.id === run.pending).quality }); },
      'run-next': () => { const sc = scenario(run.id); run.node = sc.nodes[run.node].choices.find(c => c.id === run.pending).next; run.pending = null; },
      'run-restart': () => { run = null; },
      'dec-del': () => { m.decisions.splice(+t.dataset.i, 1); save(); },
      'act-toggle': () => { const i = +t.dataset.i, x = state.actions[i]; state.actions[i] = B.updateAction(x, { status: x.status === 'done' ? 'open' : 'done' }, today()); save(); },
      'act-csv': () => download('action-register.csv', B.toCSV([['Action', 'Owner', 'Due', 'Status', 'From', 'History']].concat(state.actions.map(x => [x.text, x.owner, x.due, x.status, x.origin, x.history.map(h => h.date + ' ' + h.event).join(' | ')]))), 'text/csv'),
      'print-agenda': () => printHTML(`<h1>Burrabadine Rural Fire Brigade</h1><h2>Agenda — ${m.date ? fmt(m.date) : '________'}, ${esc(m.time)}, ${esc(m.place)}</h2>${agendaHTML(m)}`),
      'print-pack': () => printHTML(packHTML(m)), 'export-pack': () => download('meeting-pack-' + (m.date || 'draft') + '.txt', packText(m)),
      'print-form': () => printHTML(FORMS[t.dataset.f]),
      'roster-demo': () => { roster = { parsed: B.parseCSV(B.DEMO_ROSTER), column: '', eligible: [], demo: true }; },
      'roster-clear': () => { roster = null; toast('Roster deleted from memory'); },
      'roster-use': () => { const an = B.analyseRoster(roster.parsed, roster.column, roster.eligible); Object.assign(state.quorumInputs, { eligible: String(an.eligible), basis: an.basis + (roster.demo ? ' — FAKE DEMO DATA' : ''), tried: false }); save(); },
      'export': () => download('companion-export-' + today() + '.json', B.exportState(state, today()), 'application/json'),
      'reset': () => { if (!confirm('Delete everything this app has stored on this device? This cannot be undone.')) return; try { localStorage.removeItem(KEY); } catch (err) { } state = B.emptyState(); state.actions = B.seedActions(D); roster = null; toast('All local data deleted'); },
      'human-save': () => { const by = $('#hc-by').value.trim(); if (!by) return toast('Enter your name first'); state.humanChecks[id] = { by, date: today() }; save(); toast('Human check recorded'); },
      'human-del': () => { delete state.humanChecks[id]; save(); },
      'card-show': () => { card.shown = true; }, 'card-next': () => { card = { i: card.i + 1, shown: false }; },
      'ans-save': () => { const tx = $('#an-' + id).value.trim(); if (!tx) return toast('Write the answer first'); state.answers[id] = { text: tx, by: $('#ab-' + id).value.trim(), date: today() }; save(); toast('Answer recorded'); },
      'ans-del': () => { delete state.answers[id]; save(); },
      'print-questions': () => printHTML(`<h1>Burrabadine Rural Fire Brigade — questions to confirm</h1><p>Prepared ${fmt(today())}. Personal list; not an official document.</p>` + ['captain', 'secretary', 'district'].map(w => `<h2>For the ${w}</h2><table>${D.questions.filter(x => x.awaiting === w && !state.answers[x.id]).map(x => `<tr><td style="width:55%">${esc(x.text)}</td><td>&nbsp;</td></tr>`).join('') || '<tr><td>None outstanding</td></tr>'}</table>`).join('')),
      'sync-save': () => { const msg = t => { const el = $('#sync-msg'); if (el) el.textContent = t; }; self.BBC_SYNC.put({ pathway: state.pathway, practice: state.practice, research: state.research, answers: state.answers, quorumInputs: state.quorumInputs, humanChecks: state.humanChecks }, { actions: state.actions, meetings: state.meetings }).then(ok => msg(ok ? 'Saved to your account ' + new Date().toLocaleTimeString('en-AU') + '.' : 'Not saved: your sign-in has expired. Sign out and in again.')).catch(e => msg('Not saved: ' + e.message)); return false; },
      'sync-load': () => { const msg = t => { const el = $('#sync-msg'); if (el) el.textContent = t; }; if (!confirm('Replace what is on this device with the copy saved in your account?')) return false; self.BBC_SYNC.get().then(r => { if (!r) return msg('Your sign-in has expired. Sign out and in again.'); if (!r.mine && !r.shared) return msg('Nothing has been saved to your account yet.'); if (r.mine) Object.assign(state, r.mine.data); if (r.shared) Object.assign(state, r.shared.data); save(); render(true); msg('Loaded.' + (r.shared ? ' Shared register last saved by ' + r.shared.by + '.' : '')); }).catch(e => msg('Not loaded: ' + e.message)); return false; },
      'sync-out-all': () => { self.BBC_SYNC.signOutEverywhere(); return false; },
      'public-export': () => { const pe = B.publicExport(D, D.allowlist, B.privateTerms(D)); download('public-safe-export.json', JSON.stringify({ generated: today(), note: 'Reviewed public-safe records only.', records: pe.records }, null, 1), 'application/json'); }
    };
    if (acts[a] && acts[a]() !== false) render(true);
  });
  self.BBC_TEST = { getState: () => state, hasRoster: () => !!roster };
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  render(true);
})();
