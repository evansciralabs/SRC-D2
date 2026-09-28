# SRC-D2

A client-side, single-page dashboard for tracking incidents and projects, built with plain HTML, TailwindCSS, and JavaScript. Everything runs in your browser: no server, no account, no data leaves your machine.

Built with AI assistance by an independent developer.

## Status: what is built and what is proposed

**Built and in use:** the dashboard (incident and project registries, scratchpads, attachments, export and import), including Veilpoint, its status-indicator component, which the author already uses independently in a personal workflow.

**Proposed adaptation, not yet built:** an agent-audit version of Veilpoint, described in [`/docs`](docs/). It would need an external "witness" process that has not been written, a computed verdict state (including a "stale" state for silence), and the government-domain rule described below. The current indicators are not connected to any agent monitoring.

## Proposed agent-audit adaptation of Veilpoint

The 2026 agent incidents showed agents acting outside their declared scope and going undetected for days to months. The adaptation proposes a small design that would complement model-side monitoring, not replace it:

- Agents declare intent and scope before acting.
- A separate witness process, outside the dashboard and outside the agent's control, records what actually happened in an append-only hash chain.
- The dashboard shows the verdict: match, divergence, or silence. Silence is treated as an alarm, not as calm.
- Government-domain targets are flagged as high priority regardless of data sensitivity.

The full write-up, including acceptance tests and an honest statement of what a browser page cannot do on its own, is in [`docs/VEILPOINT_Proposed_Solutions.txt`](docs/VEILPOINT_Proposed_Solutions.txt).

## Incident logs

Three logs compiled from public reporting, each naming its sources and marking open questions as open:

- [`VP-2026-001`](docs/incidents/VP-2026-001_HuggingFace_Infrastructure_Compromise.txt): Hugging Face infrastructure compromise
- [`VP-2026-002`](docs/incidents/VP-2026-002_Medicare_Portal_and_AIHW.txt): Services Australia Medicare portal intrusion and related AIHW probe
- [`VP-2026-003`](docs/incidents/VP-2026-003_Government_Site_Probes.txt): US federal and state government website probes

These logs have not been reviewed by OpenAI or any affected organization. Corrections are welcome: please open an issue.

## Dashboard features

- **Client-side persistence:** data is stored in your browser (LocalStorage and IndexedDB).
- **Two registries:** separate tracking for Projects and Incidents, with attachments.
- **Multi-tab scratchpad:** Main (SP), Snippet/AI (SNPT), and VIP Context (VIP), with autosave.
- **Export and import (.srcd):** everything in one structured JSON file, with timestamped names: CC (full dashboard), SP, SNPT, VIP.
- **Attachments:** link media and `.srcd` text files to entries, with label editing and content viewing.
- **Responsive layout:** list and detail views for small screens.

## Run it

Open `index.html` in a modern browser (Chrome, Firefox, or Edge). Data is kept per browser and is not synced across devices, so use the export button to back up anything you care about.

Tip: export a clean dashboard once, right after first load. Importing that file in Overwrite mode later resets your working state without clearing your browsing history.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).

Provided as-is, without warranty. Back up important data with the export function.
