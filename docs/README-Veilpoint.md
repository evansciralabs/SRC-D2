# VEILPOINT — docs

This folder is the open part of this repository. Everything in it is
licensed under Apache License 2.0 (see [LICENSE](LICENSE) and
[NOTICE](NOTICE)). Nothing outside this folder is.

## What's in here

- **Incident logs:** `VP-2026-001` through `VP-2026-003`, three sourced
  write-ups of 2026 AI-agent incidents (Hugging Face, the Services
  Australia Medicare portal and a related AIHW probe, and US federal and
  state government sites). Each names its sources and marks open
  questions as open.
- **`VEILPOINT_Proposed_Solutions.txt`:** the design document — how each
  incident's specific detection gap maps to a specific feature, and the
  overall architecture (declaration, action record, verdict, the external
  witness process).
- **`veilpoint-witness-daemon.mjs`:** the external witness process. Runs
  outside any browser, as its own local process. Zero dependencies —
  Node's standard library only.
- **`veilpoint-witness-bridge.js`:** the browser-side half. A plain
  `<script>` you add to a dashboard's page, wiring its existing UI to the
  witness process above.
- **`veilpoint.css`:** one new CSS state (`.stale`) the bridge script
  needs.
- **`FILE-HEADERS.txt`:** explains the header block at the top of each
  code file above, and why it's there.

## What is NOT in here, and is not covered by this license

The SRC-D2 dashboard itself (`index.html`, at the repository root, and
everything else outside this folder) is a separate, all-rights-reserved
project. It is not open source. The live dashboard is free for anyone to
open and use in their own browser, but its source code is not licensed
for reuse, modification, or redistribution.

**If you found this folder by way of the full repository export**, note
that some exported files (for example an SDAP export or launch packet)
may contain a copy of the dashboard's own source pasted inline as
context. That copy is still the dashboard's code. It is not made open
source by appearing inside a file that also contains VEILPOINT material.
Please don't reuse it. If you're unsure whether something is in scope,
check whether it lives in this `/docs` folder — if it doesn't, assume it
isn't licensed for reuse.

## How the two pieces fit together

`veilpoint-witness-bridge.js` renders a verdict; it does not compute
trust. `veilpoint-witness-daemon.mjs` is the only thing that computes
trust, and it must run somewhere the thing it's watching can't write to.
Running the bridge script without the daemon gets you a UI with nothing
behind it. See `VEILPOINT_Proposed_Solutions.txt` for the full
architecture and the reasoning behind that split.

## Status

This is a design plus a working reference implementation of the witness
process and the browser bridge, built and tested independently of any
specific dashboard. It has not been reviewed by OpenAI or any of the
organizations named in the incident logs. Corrections are welcome.
