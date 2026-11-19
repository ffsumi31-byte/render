# Run ApiDuck on Render (instead of Netlify)

The Netlify site can remain online on its last published version while Render
runs a new deployment. Render must be a **Web Service**, not a Static Site:
`render-server.mjs` serves `public/` and routes the same account/admin/API functions.
This does not require Netlify production deploy credits.

## Prepare

1. Commit the **contents of `render-github-ready/` at the repository root**
   of your GitHub repository, not the enclosing workspace.
   Local file edits do not deploy until they are pushed to GitHub. Do not commit
   `.env`, `.env.*`, keys, `node_modules/`, or a database connection string.
2. Keep your existing PostgreSQL database. Run `schema.sql` against it if you
   have not already. You can use a Render Postgres instance or your current Neon
   database; do not create duplicate customer ledgers.
3. In Render, connect the repository and create a **Web Service** with:
   - Runtime: Node 22
   - Build command: `npm ci && npm test`
   - Start command: `npm start`
   - Health check path: `/` (until a dedicated health endpoint is added)
   Render sets `PORT`; the server listens on `0.0.0.0`.
   The included `render.yaml` describes this service; a manual Web Service is
   fine too. Check Render's current pricing and available instance types.
4. Set these **private** environment variables on the Render Web Service:
   - `PUBLIC_ORIGIN`: the exact HTTPS origin of your Render service, e.g.
     `https://your-service.onrender.com` (no trailing path or slash).
     This must match the address customers open. If you add a custom domain,
     update this variable and redeploy before switching clients.
   - `DATABASE_URL`: the full TLS PostgreSQL connection URL. **Secret.**
   - `ADMIN_ACCESS_KEY`: the admin key (`sk-admin-` plus 64 hex characters).
     **Secret.** Run `npm run admin-key` privately if you need a fresh one.
   - `INFERENCE_ENABLED`: `false` until the live database and provider quota
     checks in `METERING.md` pass.
   - `DEEPSEEK_API_KEY`: optional while inference is disabled; keep server-only.
     **Secret.**
   - `MAX_PROVIDER_REQUEST_TOKENS`: do not set a guessed value to make calls
     work. See `METERING.md`.
   `OPENROUTER_API_KEY` is not used by the hosted inference route.
5. Once Render reports a successful build, open its HTTPS URL and `/admin.html`.
   Use only the matching Render admin key there. Customer keys are checked
   against whichever database Render's `DATABASE_URL` points to.

## Important limitations

- Render **does not inherit** Netlify environment variables or your Netlify
  domain. Move the `apiduh.netlify.app` custom domain only after you have
  verified the Render service; a `*.netlify.app` address itself cannot be moved
  to Render. Until then, use the new Render URL.
- The unpublished Windows/Linux connector source currently targets
  `https://apiduh.netlify.app`. Update their base URL and publish new connector
  assets before telling customers they use the Render service.
- The login UI makes relative same-origin requests, so it works on the new
  Render origin. Provider keys stay server-side and are never embedded in HTML
  or download archives.
- `/v1/messages` remains disabled by default. Passing the unit tests does
  **not** validate provider accounting, streaming compatibility, or live
  PostgreSQL concurrency. Do not start paid sales from this deployment.
