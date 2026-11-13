// Hosted sign-in. This site ships no brigade data: the evidence bundle is returned by the database only for a valid login.
(function () {
  'use strict';
  const API = 'https://sbstmqmagwvgoayagbxt.supabase.co/rest/v1/rpc/', KEY = 'sb_publishable_QtZruVVQVgqkkQexbr_lVw_y-idmoPF', SS = 'bbc.bundle';
  const main = document.getElementById('main'), rpc = (fn, body) => fetch(API + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error('Service unavailable (' + r.status + ')'); return r.json(); });
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
  async function start(data) {
    self.BBC_DATA = data; document.body.classList.remove('locked');
    const b = document.createElement('button'); b.className = 'signout'; b.textContent = 'Sign out'; b.onclick = () => { sessionStorage.removeItem(SS); location.hash = ''; location.reload(); };
    document.querySelector('.top').appendChild(b);
    for (const s of ['lib/integrity.js', 'lib/logic.js', 'app.js']) await load(s);
  }
  function gate(msg) {
    document.body.classList.add('locked');
    main.innerHTML = `<div class="gate"><form class="gate-card" id="gate"><div class="gate-mark" aria-hidden="true">B</div><h1>Burrabadine Companion</h1><p class="small">Private brigade reference. Sign in to load it.</p>
      <label for="g-u">Username</label><input type="text" id="g-u" autocomplete="username" autocapitalize="none" required>
      <label for="g-p">Password</label><input type="password" id="g-p" autocomplete="current-password" required style="width:100%;padding:.6rem .65rem;border:1px solid var(--mute);border-radius:8px;background:var(--card);min-height:44px">
      <button>Sign in</button><p class="err" id="g-e" role="alert">${msg || ''}</p>
      <details><summary class="small">Change password</summary><label for="g-n">New password (12 or more characters)</label><input type="password" id="g-n" autocomplete="new-password" style="width:100%;padding:.6rem .65rem;border:1px solid var(--mute);border-radius:8px;background:var(--card);min-height:44px"><button type="button" class="sec" id="g-c">Change password</button></details>
      <p class="small">Your notes and progress stay on this device. Sign-in only unlocks the reference library.</p></form></div>`;
    const u = () => document.getElementById('g-u').value.trim(), p = () => document.getElementById('g-p').value, err = t => document.getElementById('g-e').textContent = t;
    document.getElementById('gate').addEventListener('submit', async e => {
      e.preventDefault(); err('Signing in…');
      try { const d = await rpc('bbc_login', { u: u(), p: p() }); if (!d) return err('Username or password not recognised. After several failed tries, sign-in pauses for 15 minutes.'); try { sessionStorage.setItem(SS, JSON.stringify(d)); } catch (x) { } main.innerHTML = ''; start(d); }
      catch (x) { err(x.message || 'Could not reach the sign-in service.'); }
    });
    document.getElementById('g-c').addEventListener('click', async () => {
      const n = document.getElementById('g-n').value; if (n.length < 12) return err('New password needs 12 or more characters.');
      try { err(await rpc('bbc_change_password', { u: u(), p: p(), newp: n }) ? 'Password changed. Sign in with the new one.' : 'Current username or password not recognised.'); } catch (x) { err(x.message); }
    });
  }
  let cached = null; try { cached = JSON.parse(sessionStorage.getItem(SS)); } catch (x) { }
  if (cached && cached.claims) start(cached); else gate();
})();
