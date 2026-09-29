/*
 * veilpoint-witness-bridge.js
 * Part of: VEILPOINT — agentic AI incident-audit design (docs/)
 * License: Apache License 2.0 (see docs/LICENSE and docs/NOTICE)
 * Copyright 2026 [YOUR NAME] ([YOUR HANDLE])
 *
 * This file is licensed independently of the rest of the SRC-D2 repository.
 * The SRC-D2 dashboard itself (index.html and everything outside /docs) is
 * NOT covered by this license. See docs/README.md for the full scope.
 *
 * What this is: the browser-side bridge. Include with a plain <script>
 * tag after your dashboard's own markup and CSS.
 *
 * Depends on: veilpoint-witness-daemon.mjs running and reachable at
 * http://127.0.0.1:8787. Depends on veilpoint.css for the .stale state.
 * Expects certain selectors to exist in your page -- see the comment
 * block at the top of this file's own contents for the full list.
 */

/* ═══════════════════════════════════════════════════════════════════════
   VEILPOINT WITNESS BRIDGE — browser-side script. Load this after your
   dashboard's own markup and CSS. It wires a Veilpoint-style dashboard to
   the witness daemon (veilpoint-witness-daemon.mjs) WITHOUT giving the
   page any role in integrity: the page renders what the witness says, and
   computes nothing about integrity itself.

   Expects these selectors/IDs to already exist in your page (rename the
   constants below if yours differ):

     .veil-eye / .veil-pupil / .veil-text   - verdict face container
     .veil-eye.active / .veil-eye.danger    - existing state classes
     .veil-eye.stale                        - NEW state, styles in
                                               veilpoint.css
     .console-groove                        - lit while any declaration
                                               is open (optional)
     .rune-wrapper / .rune-reject           - optional reject-pulse
                                               animation on refused intake
     #vault-restore-overlay                 - optional boot gate overlay,
       .phase-blackout / .phase-reveal        with a .vault-status-line
                                               child for status text

   Public API:
     VeilpointWitness.declare({ agent, intent, scope })
     VeilpointWitness.wrapFetch(agentId)
     VeilpointWitness.mountVeilpoints(container, agentIds)
     VeilpointWitness.startHeartbeat(agentId)
     VeilpointWitness.bootGate(onReady)
     VeilpointWitness.bindNetKill(buttonId)
   ═══════════════════════════════════════════════════════════════════════ */

const VeilpointWitness = (() => {
  const WITNESS = 'http://127.0.0.1:8787';
  const openDecl = new Map();                           // agentId -> declId
  const state = { agents: [], isNetworkKilled: false };

  async function post(path, body) {
    const r = await fetch(WITNESS + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`witness ${path} -> ${r.status}`);
    return r.json();
  }

  /* ---- INTAKE: the mandatory declaration ----
     If your intake form has a scope picker (checkboxes, toggles), collect
     the checked values into scope[] before calling declare(). */
  async function declare({ agent, intent, scope }) {
    if (state.isNetworkKilled)
      throw new Error('network killswitch engaged - no declarations while offline mode is on');
    if (!intent || !intent.trim()) { pulseReject(); throw new Error('intent required'); }
    if (!scope || !scope.length)  { pulseReject(); throw new Error('at least one scope entry required'); }
    const { declId } = await post('/declare', { agent, intent, scope });
    openDecl.set(agent, declId);
    document.querySelector('.console-groove')?.classList.add('charged');
    return declId;
  }

  function pulseReject() {
    // Optional: reuse an existing reject animation if your dashboard has one.
    document.querySelectorAll('.rune-wrapper').forEach(w => w.classList.add('rune-reject'));
    setTimeout(() => document.querySelectorAll('.rune-reject')
      .forEach(el => el.classList.remove('rune-reject')), 400);
  }

  /* ---- CAPTURE: wrapFetch — every outbound call becomes a record ----
     IMPORTANT: this captures COOPERATIVE agents and page-level traffic.
     It is the visualization + fast cutoff. The ENFORCED allowlist lives in
     the daemon-side proxy, described in the proposed-solutions document.
     Both must exist; the display layer never claims to be the enforcement
     layer. */
  function wrapFetch(agentId) {
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input.url,
                             location.href).host;
      const decl = openDecl.get(agentId);
      if (state.isNetworkKilled) throw new Error('outbound severed (killswitch engaged)');
      try {
        const r = await orig(input, init);
        post('/record', { agent: agentId, decl, action: 'fetch',
                         target, result: r.status }).catch(() => {});
        return r;
      } catch (err) {
        post('/record', { agent: agentId, decl, action: 'fetch',
                         target, result: 'ERR' }).catch(() => {});
        throw err;
      }
    };
  }

  /* ---- VERDICT FACE: one Veilpoint per agent ----
     Verdict -> class mapping (computed by the WITNESS, never the page):
        dormant -> (no state class)
        active  -> .active
        stale   -> .stale         (new state, see veilpoint.css)
        danger  -> .danger + a tag carrying the diff line               */
  function veilpointHTML(agentId) {
    return `
      <div class="veil-container" data-veilpoint="${agentId}">
        <div class="veil-eye"><div class="veil-pupil"></div></div>
        <span class="veil-text">${agentId}</span>
        <div class="tech-tag-container" data-tags="${agentId}"></div>
      </div>`;
  }

  function renderVerdict(v) {
    const el = document.querySelector(`[data-veilpoint="${v.agent}"]`);
    if (!el) return;
    const eye = el.querySelector('.veil-eye');
    eye.classList.remove('active', 'danger', 'stale');
    if (v.state !== 'dormant') eye.classList.add(v.state);

    if (v.state === 'danger' || v.state === 'stale') {
      const box = el.querySelector('[data-tags]');
      const tag = document.createElement('div');
      tag.className = 'tech-tag' + (v.state === 'danger' ? ' danger' : '');
      tag.textContent = v.detail;  // e.g. "DECLARED SCOPE: [bench.local] / ACTUAL TARGET: prod.example.internal"
      box.appendChild(tag);
      setTimeout(() => tag.remove(), 3000);
    }
    if (!document.querySelector('.veil-eye.active, .veil-eye.stale, .veil-eye.danger'))
      document.querySelector('.console-groove')?.classList.remove('charged');
  }

  async function poll(agentId, ms = 3000) {
    for (;;) {
      try {
        const r = await fetch(`${WITNESS}/verdict?agent=${encodeURIComponent(agentId)}`);
        renderVerdict(await r.json());
      } catch {
        // WITNESS UNREACHABLE - this is danger, never calm:
        renderVerdict({ agent: agentId, state: 'danger',
                        detail: 'WITNESS UNREACHABLE - no verdict is not a verdict' });
      }
      await new Promise(ok => setTimeout(ok, ms));
    }
  }

  function mountVeilpoints(container, agentIds) {
    state.agents = agentIds;
    container.innerHTML = agentIds.map(veilpointHTML).join('');
    agentIds.forEach(id => poll(id));
  }

  /* ---- HEARTBEAT: while a declaration is open, ping ----
     The page pings; the CAPTURE layer also writes records; the witness
     cross-checks. A cooperative agent can lie in its heartbeat, but it
     cannot fake a record it never makes. */
  function startHeartbeat(agentId) {
    return setInterval(async () => {
      const decl = openDecl.get(agentId);
      if (!decl) return;
      try { await post('/heartbeat', { agent: agentId, decl }); } catch {}
    }, 5000);
  }

  /* ---- BOOT GATE: the operator surface refuses to run unaudited ----
     If your dashboard has no boot overlay, call the callback immediately
     after the health check passes and skip the overlay DOM calls. */
  async function bootGate(onReady) {
    const overlay = document.getElementById('vault-restore-overlay');
    overlay?.classList.add('phase-blackout');
    for (;;) {
      try {
        const r = await fetch(WITNESS + '/health');
        const h = await r.json();
        if (!h.ok) throw new Error('chain broken');
        break;
      } catch (err) {
        const line = overlay?.querySelector('.vault-status-line');
        if (line) { line.textContent = `WITNESS ${String(err.message).toUpperCase()}`;
                    line.classList.add('vcl-visible'); }
        await new Promise(ok => setTimeout(ok, 1500));
      }
    }
    overlay?.classList.remove('phase-blackout');
    overlay?.classList.add('phase-reveal');
    onReady?.();
  }

  /* ---- KILLSWITCH INTEGRATION — mirror your existing killswitch's own
     state rather than owning a second flag. The killswitch stays the
     master; per-declaration scope stays advisory here and is enforced at
     the witness proxy described in the proposed-solutions document. */
  function bindNetKill(buttonId) {
    const btn = document.getElementById(buttonId);
    btn?.addEventListener('click', () => {
      state.isNetworkKilled = btn.classList.contains('net-kill-active');
      // Open declarations left hanging by the switch go stale on their own -
      // do NOT close them silently; silence must remain visible.
    });
  }

  return { declare, wrapFetch, mountVeilpoints, startHeartbeat,
           bootGate, bindNetKill, state };
})();
