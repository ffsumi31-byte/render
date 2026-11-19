# ApiDuck — Render Web Service

This folder is the **GitHub repository root** for the current ApiDuck customer
workspace and its account/admin API. The customer UI is `public/index.html`
with `public/console.css`; `public/style.css` and `public/workspace.css` are
retained solely because the admin page still uses them.

## Deploy

1. Push the **contents of this folder** to a GitHub repository (not the
   enclosing `local-ai-gateway` directory).
2. Follow [RENDER.md](RENDER.md) to configure a Render **Web Service**, not a
   Static Site. The included `render.yaml` runs `npm ci && npm test`, then
   `npm start` with Node 22.
3. Set `PUBLIC_ORIGIN`, `DATABASE_URL`, and `ADMIN_ACCESS_KEY` privately in
   Render. Keep `INFERENCE_ENABLED=false`; see [METERING.md](METERING.md)
   before enabling any hosted inference.

Locally, run `npm ci`, `npm test`, then set `PUBLIC_ORIGIN=http://127.0.0.1`
and `PORT=4178` before `npm start`. The password-free localhost button is a
**sample UI preview only**; hosted customer login requires an issued key.
See [ADMIN.md](ADMIN.md) for key management and `schema.sql` for the database.

The Windows/Linux launcher files in `connectors/` are unpublished source
examples and still target the old Netlify address. There are **no connector
downloads** in this repository. Do not announce hosted inference or publish
launchers until live provider, database, quota, and URL validation passes.
