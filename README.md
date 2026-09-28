# SRC-D2

A browser-based dashboard for tracking projects and incidents, with a multi-tab scratchpad, local sandboxes, and a set of built-in tools. Current version: v6.0 "Peace Operator". Work in progress.

The whole dashboard is one HTML file. It runs in your browser and keeps your data on your own device.

## What it does

- **Projects and incidents:** Two registries, each with status, due dates, notes, and attachments. Incidents can be filed under 13 categories: cyber/account, fraud/financial, property/theft/loss, vehicle, housing/tenancy, consumer goods and services, employment, medical/insurance, utility/service, environment/nuisance, personal safety/harassment, admin/documents, and other. Each category has its own fields.
- **Scratchpad:** Three tabs (main, code, and VIP context) with autosave, saved to and loaded from `.srcd` files.
- **SDAP logs and launch packets:** Task lists, work logs, and decisions, plus a generator that bundles them with your context into a single packet you can hand to an AI assistant. SDAP logs and packets are always plain text, because they are meant to be fed to an AI.
- **Peace Operator:** A hybrid DSP tool for audio engineers, with a live sound meter and analyzer. It only asks for the microphone when you open it. Experimental: wildlife field detection and auto-capture. The detector can flag a call, but the capture filters are still being tuned and may not record it yet. Planned: rolling buffers, and later communal safety tools on an individual's own terms. The design goal is non-invasive and privacy-respecting, not authoritarian or corporate surveillance.
- **Sandboxes:** In-browser code sandboxes, including Python through Pyodide, plus an optional remote runner for other languages (see Network below).
- **Companion-app bridges:** A project whose notes carry a chassis header can be sent to Omni Frame, and a track library feeds Shadeproof.
- **Themes and ghost mode:** Several color themes, and a greyscale power-saving mode.
- **Network tools:** A network killswitch (the dashboard loads with all optional network features off), a live network status indicator, network diagnostics, and a device audit view. The status indicator reads "Link online" or "Link offline" and monitors the connection, with a row of six green and red dots showing pass or fail for connection health checks.

## Run it

Open `index.html` in a modern browser. Some features (the web manifest and service worker) need the page to be served over HTTPS or from `localhost`.

## Getting started

1. **Pick a session type.** Use guest mode for a quick session. Enter an operator callsign for a persistent vault tied to your device. Use the same callsign each time to get your saved data and backups back. See Portability and sharing below.
2. **Add entries.** Create a project or an incident from the entry forms. For incidents, choose a category to get its fields.
3. **Use the scratchpad.** Type in any of the three tabs. It autosaves. Save a tab as a `.srcd` file to keep it, and load the file to bring it back.
4. **Attach files** to projects and incidents. Attachments are stored with the entry.
5. **Back up.** Export a full backup regularly, because browser storage can be cleared. Import a backup to restore it. To save a plain-text file you can share, bypass encryption first (see Data and privacy).
6. **Go online only when you mean to.** Leave the killswitch engaged to stay fully offline. Release it to use the optional online features.
7. **Try Peace Operator.** Open the panel and allow the microphone when your browser asks. Close the panel to release the microphone.

## Data and privacy

- **Storage:** Everything is stored in your browser (localStorage and IndexedDB). Nothing is synced to a server by the dashboard.
- **Encryption:** Sessions are encrypted by default, and files you save are encrypted to your device.
- **Encryption switch:** Click the network status text (Link online or Link offline) to turn encryption on or bypass it. While it is bypassed, files are saved as plain-text JSON. These are not protected: anyone who has the file can read it. That is what makes them easy to share or move between devices. Don't put sensitive data in a plain-text file you plan to share.
- **SDAP is always plain text.** SDAP logs and launch packets are meant to be handed to an AI, so they are never encrypted. Keep secrets out of them.
- **Exports:** Full backups and scratchpad tabs are saved as `.srcd` files.

## Portability and sharing

- **Callsign sessions are tied to one device.** A file saved from a callsign session opens on that device, and a copy of the file can't be opened elsewhere on its own.
- **Moving or sharing a session:** Add a glyph to a callsign session. Anyone with the callsign and the glyph can then open the files on their own device, so a group can share a session. This is a deliberate trade: the files become portable, and they no longer depend on a single device. Treat the glyph like a shared secret.
- **Saving guest sessions:** Guest sessions can also be saved and reopened. Set up the glyph system without a callsign and you get an 8-character passkey. Copy it, paste it somewhere private for the moment (the scratchpad works), memorize it, and delete the copy. That passkey is your password for saving, sharing, and reopening encrypted guest sessions. Make sure nobody can see it while you copy it.
- **What this does and doesn't protect:** Encryption protects your saved files from someone who gets a copy of them. It can't protect a device that is unlocked or compromised, or a passkey or glyph that someone else can see.

## Network

The dashboard works without a network connection, apart from two things:

- **Fonts:** It loads its fonts from Google Fonts when the page opens. If Google can't be reached, it falls back to default fonts.
- **Optional online features:** The network killswitch is engaged by default, so these stay off until you release it. They include a public-IP check in the diagnostics and the remote code runner, which is a third-party service that receives whatever code you run through it.

## License

Not yet specified.

## Support

This work is developed independently. If it's useful to you, or you'd like to see the agent-audit research continue, support helps me keep building and documenting it. Feedback and corrections are just as welcome: open an issue.

PayPal: MavArtCreator@gmail.com
