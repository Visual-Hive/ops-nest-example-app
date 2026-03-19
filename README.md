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

## Tech Stack

- Electron (desktop shell)
- React 19 + TypeScript (UI)
- Vite (bundling)
- SQLite (local data store)
- Google Sheets API (via Service Account)
- Microsoft Graph API (Outlook)
- Monday.com GraphQL API
- Anthropic Claude API (AI features)
