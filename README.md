# TimeTracker

A lightweight clock-in / clock-out time tracker built with plain HTML, JavaScript, and Tailwind CSS. Data is stored locally in IndexedDB. The app runs as a **Progressive Web App (PWA)** on mobile and as a **Chrome extension** side panel on desktop.

**Live app:** [https://hatguy68.github.io/TimeTracker/](https://hatguy68.github.io/TimeTracker/)

> Update the URL in [`site.config.json`](site.config.json) if your GitHub Pages path differs from the repo name.

## Features

- Clock in and clock out with live elapsed time while on shift
- Daily or weekly progress toward a configurable hour goal (e.g. 40h or 27h)
- Weekly activity log for today's sessions
- Settings page: progress period, goal hours, auto-clear schedule, JSON export, manual data wipe
- Auto-clear time entries on a schedule (daily at midnight, weekly, or monthly)
- Offline-first PWA with service worker caching
- Chrome extension side panel (no page service worker in extension context)
- Dark theme, mobile-friendly layout, no build step

## Project Structure

```text
.
├── index.html              # App shell and settings UI
├── script.js               # UI controller
├── sw.js                   # PWA service worker (web only)
├── background.js           # Chrome extension background worker
├── manifest.webmanifest    # PWA install manifest
├── manifest.json           # Chrome extension manifest (MV3)
├── site.config.json        # Public GitHub Pages URL for sharing
├── tailwind.min.js
├── assets/                 # Icons and iOS splash screens
├── scripts/
│   ├── generate-assets.py  # Generate icons and splash PNGs
│   └── generate-uuid.js
├── src/lib/
│   ├── db/db.js            # IndexedDB layer
│   ├── models/             # TimeEntry and settings types
│   └── services/           # Time tracking and settings logic
└── test/
    └── server.py           # Local HTTPS dev server
```

## Getting Started

### Static server (quick local preview)

```bash
python -m http.server 5500
```

Open `http://localhost:5500`.

### HTTPS dev server (PWA testing)

PWAs require HTTPS on physical devices. Use the included server:

```bash
python test/server.py
```

Open `https://localhost:8443` and accept the self-signed certificate warning in your browser.

For Android PWA install, use a **trusted HTTPS URL** (self-signed certs usually only add a home-screen shortcut):

```bash
ngrok http https://localhost:8443
```

Open the ngrok URL on your phone in Chrome.

## GitHub Pages

The repo includes a [GitHub Actions workflow](.github/workflows/pages.yml) that deploys the app on push to `main` or `master`.

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`/`master` and wait for the workflow to finish.
4. Open the deployed URL (typically `https://<username>.github.io/<repo-name>/`).

Update [`site.config.json`](site.config.json) with your Pages URL so the in-app **Live App Link** and header shortcut point to the right place:

```json
{
  "liveUrl": "https://your-username.github.io/your-repo-name/"
}
```

### Quick access in the app

- **Header** — tap the external-link icon to open the live app URL.
- **Settings → Live App Link** — view, copy, or open the shareable URL.

When you are already on GitHub Pages, the app detects the current URL automatically.

## Installation

### Android (PWA)

1. Open the trusted HTTPS URL in Chrome.
2. Wait a few seconds for the service worker to activate.
3. Menu → **Install app** (not just “Add to Home screen” shortcut).
4. Launch from the home screen — the app opens without the browser chrome.

If install is not offered, clear site data, remove any old shortcut, and reload. Check **Application → Manifest** in Chrome DevTools for errors.

### iOS (PWA)

1. Open the URL in Safari.
2. Tap **Share** → **Add to Home Screen**.

### Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder.
4. Click the extension icon to open the side panel.

The extension uses `manifest.json` and `background.js`. Page service worker registration is skipped automatically in `chrome-extension://` context.

## Settings

Open the gear icon in the header:

| Setting | Description |
|---------|-------------|
| Progress period | Track progress against a **daily** or **weekly** goal |
| Goal duration | Target hours (presets: 40h, 27h, or custom 1–168) |
| Auto-clear data | Never, daily at midnight, weekly (Sunday), or monthly (1st) |
| Export data | Download all entries as JSON |
| Clear all data now | Wipe IndexedDB time entries (with confirmation) |

Settings are stored in `localStorage`. Time entries are stored separately in IndexedDB (`ClockInClockOutDB`).

## Data Model

Each clock event is stored as a `TimeEntry`:

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `type` | `CLOCK_IN` or `CLOCK_OUT` |
| `timestamp` | Unix ms when the event occurred |
| `note` | Optional text |
| `deleted` | Optional soft-delete flag |

Work sessions are derived by pairing clock-in and clock-out events.

## Regenerate Icons

Icons match the app’s dark clock theme. Regenerate PNGs and `icon.svg`:

```bash
python scripts/generate-assets.py
```

This writes `assets/icon.svg`, PNG sizes (16–512), maskable icon, and splash screens.

## PWA vs Extension

| | Web / PWA | Chrome extension |
|--|-----------|------------------|
| Manifest | `manifest.webmanifest` | `manifest.json` |
| Offline | `sw.js` service worker | Extension cache not required; IndexedDB works offline |
| Install | Add to home screen / Install app | Load unpacked in `chrome://extensions` |

## Notes

- PWAs need HTTPS outside localhost. Self-signed certificates on a local IP often produce a shortcut only, not a full install.
- After changing `sw.js` or the manifest, hard-refresh or clear the site cache and unregister old service workers.
- Auto-clear removes all time entries at the scheduled boundary, including an active clock-in. Export first if you need a backup.

## License

Use for personal, educational, or commercial projects.
