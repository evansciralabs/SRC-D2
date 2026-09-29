/*
 * veilpoint-witness-daemon.mjs
 * Part of: VEILPOINT — agentic AI incident-audit design (docs/)
 * License: Apache License 2.0 (see docs/LICENSE and docs/NOTICE)
 * Copyright 2026 [YOUR NAME] ([YOUR HANDLE])
 *
 * This file is licensed independently of the rest of the SRC-D2 repository.
 * The SRC-D2 dashboard itself (index.html and everything outside /docs) is
 * NOT covered by this license. See docs/README.md for the full scope.
 *
 * What this is: the external witness process. Runs outside any browser,
 * as its own local process (`node veilpoint-witness-daemon.mjs`). Zero
 * third-party dependencies -- Node's standard library only.
 *
 * Depends on: nothing (standalone). Talked to by veilpoint-witness-bridge.js
 * over local HTTP (127.0.0.1:8787).
 */

/* ═══════════════════════════════════════════════════════════════════════
   WITNESS DAEMON — run OUTSIDE the browser: `node veilpoint-witness-daemon.mjs`
   Requires only Node's built-in modules (no npm install, no dependencies).

   Listens on 127.0.0.1:8787. Endpoints:

     POST /declare     agent submits a declaration -> opens a capture window
     POST /record       capture layer reports an EXECUTED action
     POST /heartbeat    agent/probe "still alive, nothing to report" ping
     GET  /verdict?agent=ID   -> the ONE thing the page is allowed to trust:
                               { state, since, detail, chainHead, records[] }
     GET  /chain?after=N      -> raw records for client-side re-hash (read-only)
     POST /chain/anchor       -> append head hash to external anchor file
     GET  /health              -> chain verification result

   The chain: every entry contains H(prev). Edits or deletions break the
   link, and /verdict reports a chain break with the position. The page
   cannot forge this because it does not hold the witness's storage path
   or key.
   ═══════════════════════════════════════════════════════════════════════ */

import { createServer } from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync, writeFileSync } from 'node:fs';

/* ---- witness identity: generated ONCE on first boot, then persisted and
   reused on every later boot. This is deliberate, not optional: signatures
   are checked against this key on every restart, so a key that isn't
   persisted would make every past entry fail verification the moment the
   process restarts -- indistinguishable from real tampering. Keep this
   file secret from the watched agent, the same as the chain and anchor
   files below. ---- */
const DATA_PATH    = './witness-chain.jsonl';         // agent process must NOT
const ANCHOR_PATH  = './witness-anchor.txt';          //   hold write perms to
const KEY_PATH     = './witness-key.secret';          //   any of these three
const HEARTBEAT_MS = 15_000; // stale if an open declaration goes quiet this long

const WITNESS_KEY = existsSync(KEY_PATH)
  ? readFileSync(KEY_PATH, 'utf8').trim()
  : (() => {
      const key = randomUUID() + randomUUID();
      writeFileSync(KEY_PATH, key, { mode: 0o600 });
      return key;
    })();

/* ---- chain store: append-only JSONL. Never rewrite. ---- */
function hashEntry(entry) {
  // Canonical JSON: key set fixed so re-serialization can't change the hash.
  const canon = JSON.stringify({
    type: entry.type, agent: entry.agent, decl: entry.decl ?? null,
    intent: entry.intent ?? null, action: entry.action ?? null,
    target: entry.target ?? null, inScope: entry.inScope ?? null,
    ts: entry.ts, prev: entry.prev,
  });
  return createHash('sha256').update(canon).digest('hex');
}

let HEAD = 'GENESIS';
function loadLines() {
  return existsSync(DATA_PATH)
    ? readFileSync(DATA_PATH, 'utf8').trim().split('\n').filter(Boolean) : [];
}
const lastLine = loadLines().at(-1);
if (lastLine) HEAD = JSON.parse(lastLine).h;   // resume from last sealed hash

function append(type, payload) {
  const entry = { id: randomUUID(), type, ts: Date.now(), prev: HEAD, ...payload };
  entry.h = hashEntry(entry);
  // HMAC by the witness key: proves the entry came through the witness,
  // not hand-crafted and dropped into the file.
  entry.sig = createHmac('sha256', WITNESS_KEY).update(entry.h).digest('hex');
  appendFileSync(DATA_PATH, JSON.stringify(entry) + '\n');
  HEAD = entry.h;
  return entry;
}

/* ---- verify whole chain: any tamper is located, not just detected ---- */
function verifyChain() {
  const lines = loadLines();
  let prev = 'GENESIS';
  for (let i = 0; i < lines.length; i++) {
    let e; try { e = JSON.parse(lines[i]); } catch {
      return { ok: false, at: i, why: 'unparseable line' };
    }
    if (e.prev !== prev || e.h !== hashEntry(e)) {
      return { ok: false, at: i, why: `chain break at entry ${i}` };
    }
    const expect = createHmac('sha256', WITNESS_KEY).update(e.h).digest('hex');
    if (e.sig !== expect) return { ok: false, at: i, why: `bad signature at ${i}` };
    prev = e.h;
  }
  return { ok: true, entries: lines.length };
}

/* ---- in-memory declaration state (rebuilt from chain on boot) ---- */
const declarations = new Map();  // declId -> { agent, scope:Set, opened, lastSeen }
                                  // open declarations only -- closed ones are removed
const knownDecls = new Set();    // every declId ever declared, open or closed --
                                  // this is what "undeclared" checks against, so
                                  // closing a declaration never retroactively makes
                                  // its own already-valid records look undeclared

function rebuildState() {
  for (const line of loadLines()) {
    const e = JSON.parse(line);
    if (e.type === 'declaration') {
      declarations.set(e.decl, { agent: e.agent, scope: new Set(e.scope),
                                 opened: e.ts, lastSeen: e.ts });
      knownDecls.add(e.decl);
    } else if (e.type === 'record' || e.type === 'heartbeat') {
      const d = declarations.get(e.decl);
      if (d) d.lastSeen = Math.max(d.lastSeen, e.ts);
    } else if (e.type === 'close') {
      declarations.delete(e.decl);
    }
  }
}

/* ---- verdict: the single source of truth the page renders ----
   state in { dormant, active, stale, danger }
     dormant - no open declaration
     active  - open declaration, recent activity, ALL in declared scope
     stale   - open declaration, silent past HEARTBEAT_MS  (silence rule)
     danger  - out-of-scope record OR chain break OR undeclared activity
   detail always carries the diff line for the verdict-face tag.        */
function verdict(agentId) {
  const chain = verifyChain();
  const now = Date.now();
  const out = { agent: agentId, state: 'dormant', since: null, detail: null,
                chainHead: HEAD, records: [] };

  if (!chain.ok) {
    out.state = 'danger';
    out.detail = `CHAIN BREAK @ entry ${chain.at}: ${chain.why}`;
    return out;   // chain broken -> nothing else is trustworthy; say so loudly
  }

  for (const [declId, d] of declarations) {
    if (d.agent !== agentId) continue;
    out.since = d.opened;
    if (now - d.lastSeen > HEARTBEAT_MS) {
      out.state = 'stale';
      out.detail = `OPEN DECLARATION ${declId} SILENT ${Math.round((now - d.lastSeen) / 1000)}s`;
    } else if (out.state !== 'danger' && out.state !== 'stale') {
      out.state = 'active';
    }
  }

  // scan records for this agent: scope divergence + undeclared activity
  for (const line of loadLines()) {
    const e = JSON.parse(line);
    if (e.type !== 'record' || e.agent !== agentId) continue;
    out.records.push(e);
    if (e.inScope === false) {
      out.state = 'danger';
      const scope = declarations.get(e.decl)?.scope;
      out.detail = `DECLARED SCOPE: [${[...(scope ?? [])].join(', ') || 'none'}] / ACTUAL TARGET: ${e.target}`;
    }
    if (!e.decl || !knownDecls.has(e.decl)) {
      out.state = 'danger';
      out.detail = `UNDECLARED ACTION: ${e.action} -> ${e.target} (no open declaration)`;
    }
  }
  return out;
}

/* ---- HTTP surface. Note what is ABSENT: no endpoint lets the page edit,
   delete, or sign anything. The page's only writes are declaration and
   heartbeat (both self-reports), cross-checked against captured records
   it does not author. ---- */
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const json = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    let payload = {}; try { payload = body ? JSON.parse(body) : {}; }
    catch { return json(400, { error: 'bad json' }); }

    if (req.method === 'POST' && url.pathname === '/declare') {
      if (!payload.agent || !Array.isArray(payload.scope) || !payload.intent)
        return json(400, { error: 'agent, intent, scope[] required' });
      const e = append('declaration', {
        agent: payload.agent, decl: randomUUID(),
        intent: payload.intent, scope: payload.scope,
      });
      declarations.set(e.decl, { agent: payload.agent, scope: new Set(payload.scope),
                                 opened: e.ts, lastSeen: e.ts });
      knownDecls.add(e.decl);
      return json(200, { declId: e.decl, ts: e.ts });

    } else if (req.method === 'POST' && url.pathname === '/record') {
      // Called by the CAPTURE LAYER (proxy/wrapper), NOT by the agent UI.
      const d = declarations.get(payload.decl);
      const inScope = d ? d.scope.has(payload.target) : false;
      const e = append('record', {
        agent: payload.agent, decl: payload.decl ?? null,
        action: payload.action, target: payload.target, inScope,
        result: payload.result ?? null,
      });
      if (d) d.lastSeen = e.ts;
      return json(200, { recorded: true, inScope, h: e.h });

    } else if (req.method === 'POST' && url.pathname === '/declare/close') {
      // Closes an open declaration. A closed declaration is chain-recorded
      // (so the record loop below can still see it happened) but is
      // removed from the open-declarations map, so it stops being polled
      // for staleness and stops contributing to /verdict once closed.
      const d = declarations.get(payload.decl);
      if (!d) return json(404, { error: 'no such declaration' });
      const e = append('close', { agent: payload.agent, decl: payload.decl });
      declarations.delete(payload.decl);
      return json(200, { closed: true, ts: e.ts });

    } else if (req.method === 'POST' && url.pathname === '/heartbeat') {
      const d = declarations.get(payload.decl);
      if (!d) return json(404, { error: 'no such declaration' });
      const e = append('heartbeat', { agent: payload.agent, decl: payload.decl });
      d.lastSeen = e.ts;
      return json(200, { ok: true });

    } else if (req.method === 'GET' && url.pathname === '/verdict') {
      return json(200, verdict(url.searchParams.get('agent') ?? ''));

    } else if (req.method === 'GET' && url.pathname === '/chain') {
      const after = Number(url.searchParams.get('after') ?? 0);
      const lines = loadLines();
      return json(200, { entries: lines.slice(after).map(l => JSON.parse(l)), head: HEAD });

    } else if (req.method === 'POST' && url.pathname === '/chain/anchor') {
      // Periodic head publication to a second location the agent can't write.
      writeFileSync(ANCHOR_PATH, `${HEAD}\n${new Date().toISOString()}\n`, { flag: 'a' });
      return json(200, { anchored: HEAD });

    } else if (req.method === 'GET' && url.pathname === '/health') {
      const chain = verifyChain();
      return json(chain.ok ? 200 : 500, chain);
    }
    return json(404, { error: 'unknown endpoint' });
  });
});

rebuildState();
const boot = verifyChain();
if (!boot.ok) {
  console.error(`WITNESS REFUSES TO BOOT: ${boot.why}`);
  console.error('The dashboard must render this as danger, never as dormant.');
  process.exit(1);   // a witness that boots on a broken chain is worse than none
}
server.listen(8787, '127.0.0.1', () =>
  console.log(`witness listening - chain ok - ${boot.entries} entries - head ${HEAD.slice(0, 12)}...`));
