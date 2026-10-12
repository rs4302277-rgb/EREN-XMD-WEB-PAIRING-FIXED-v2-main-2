# EREN XMD — WhatsApp Bot + Pairing Website

A Node.js WhatsApp multi-session bot with a mobile-friendly web pairing portal. Telegram bot functionality has been removed; pairing is handled through the website.

## Requirements
- Node.js 20 or newer
- Persistent disk/storage for `sessions/` and `data/` (important: ephemeral storage loses WhatsApp sessions and visit counts)

## Run locally or on Railway
```bash
npm install
npm run check
npm start
```
Railway should use the repository root and the `npm start` command. It automatically provides `PORT`.

## Website
- `/` — pairing website
- `/api/stats` — public aggregate counters only
- `/api/health` — health check
- `POST /api/pair` — request a pairing code; includes per-IP throttling and per-number cooldown

Administrative session endpoints are disabled unless `ADMIN_API_KEY` is set in Railway Variables. When enabled, pass it using the `x-admin-key` header to `/api/admin/sessions`, `/api/admin/stop/:sessionId`, and `/api/admin/logout/:sessionId`.

## Important deployment notes
1. Add a persistent volume mounted at the project root if your hosting plan supports it. Without persistent storage, WhatsApp auth files can disappear during redeploys/restarts.
2. Never upload `sessions/`, `data/`, `.env`, auth credentials, or API tokens to a public repository.
3. The pairing portal must only be used to link WhatsApp accounts you own or are authorized to manage. The portal rate-limits code requests, but public endpoints can still attract abuse; monitor Railway logs.
4. WhatsApp/Baileys is an unofficial integration and upstream protocol changes may affect pairing and group-status features.
5. `npm run check` checks JavaScript syntax. It does not prove that every third-party API command works; external API services and WhatsApp permissions must be tested live.

## Private third-party cookies
The bundled Instagram cookie file has been cleared for security. If you use Instagram commands that require an authenticated session, store your own cookie file in private Railway storage and set `COOKIES_FILE` to its path. Never commit browser cookies or session IDs to GitHub. If the cookie values from the original ZIP belonged to a real account, log that account out of other sessions and refresh its credentials.
