# OpsNest Conference Sync

A desktop app that unifies Monday.com, Google Sheets, and Outlook for conference operations management. Powered by Claude AI for email analysis and smart escalations.

## What It Does

- **Syncs your tools**: Bi-directional sync between Monday.com (task tracking), Google Sheets (equipment source of truth), and Outlook (vendor emails)
- **AI-powered email analysis**: Automatically classifies vendor replies (auto-responses, non-answers, substantive replies, issues)
- **Smart escalations**: Flags unresponsive vendors, quantity mismatches, and items needing your attention
- **Email drafting**: AI composes vendor emails using your equipment data - you review and approve before sending
- **Conflict resolution**: Detects when data changes in multiple places and helps you resolve it

## Getting Started

### For Users (Download & Run)

1. Download the latest release for your platform (.exe for Windows, .dmg for Mac)
2. Install and open the app
3. Follow the 4-step setup wizard:
   - Enter your Anthropic API key (for AI features)
   - Enter your Monday.com API token
   - Share your Google Sheet with the provided email address
   - Sign in with your Microsoft 365 account

### For Developers

```bash
npm install
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Dev only | Full JSON string of Google Service Account credentials. In production, place `credentials.json` in the app resources directory instead. |
| `MICROSOFT_CLIENT_ID` | Yes | Azure AD app registration client ID for Outlook OAuth (PKCE flow). |

**Note:** Anthropic API key and Monday.com API token are entered by the user through the onboarding wizard and stored locally via electron-store. They are not environment variables.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process                          │
│  ├── Express server (OAuth callbacks :19876)    │
│  ├── IPC handlers (auth, sync, email, ai, data) │
│  ├── Services                                   │
│  │   ├── sheets.service    (Google Sheets API)  │
│  │   ├── monday.service    (GraphQL API)        │
│  │   ├── outlook.service   (Microsoft Graph)    │
│  │   ├── claude.service    (Anthropic API)      │
│  │   └── sync-engine       (poll-and-reconcile) │
│  ├── SQLite (8 tables + sync journal)           │
│  └── electron-store (encrypted credentials)     │
├─────────────────────────────────────────────────┤
│  Preload (contextBridge)                        │
├─────────────────────────────────────────────────┤
│  React 19 Renderer (Vite)                       │
│  ├── Onboarding wizard                          │
│  ├── Dashboard (areas, equipment, sync status)  │
│  ├── Email inbox + AI draft composer            │
│  └── Conflict resolution panel                  │
└─────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── main/
│   ├── index.ts              # App entry, BrowserWindow
│   ├── server.ts             # Express (OAuth callbacks)
│   ├── store.ts              # electron-store config
│   ├── db/                   # SQLite schema + init
│   ├── ipc/                  # IPC handlers (auth, sync, email, ai, data, events)
│   └── services/             # API integrations + sync engine
├── renderer/
│   ├── App.tsx               # Screen router
│   ├── components/           # onboarding/, dashboard/, email/, shared/
│   ├── stores/               # Zustand state
│   └── hooks/                # IPC wrapper
├── preload/index.ts          # contextBridge API
└── shared/
    ├── ipc-channels.ts       # IPC channel constants
    └── models.ts             # Shared TypeScript interfaces
```

## Releases

Releases are built automatically via GitHub Actions on all 3 platforms.

**To create a release:**

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the workflow to build `.exe` (Windows), `.dmg` (macOS), and `.AppImage` (Linux) installers, then uploads them to a GitHub Release.

You can also trigger a build manually from the Actions tab (workflow_dispatch) for testing without creating a release.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON content of your Google Service Account key file. Written to `credentials.json` and bundled into the app via `extraResources`. |
| `MICROSOFT_CLIENT_ID` | Azure AD application (client) ID for Outlook OAuth PKCE flow. |

## Tech Stack

- Electron (desktop shell)
- React 19 + TypeScript (UI)
- Vite (bundling)
- SQLite via better-sqlite3 (local data store)
- Google Sheets API (via Service Account)
- Microsoft Graph API (Outlook, PKCE OAuth)
- Monday.com GraphQL API
- Anthropic Claude API (AI features)
