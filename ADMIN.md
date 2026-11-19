# Admin setup — server-side only

1. Apply the updated `schema.sql` in PostgreSQL. It adds `admin_audit` without
   dropping existing customer data.
2. On your private admin computer, from this project, run `npm run admin-key`.
   It prints a new high-entropy admin key once. Store it in a password manager.
3. Set that exact value as `ADMIN_ACCESS_KEY` in Render's **Web Service**
   environment settings, alongside `DATABASE_URL`. Redeploy.
   Never put this value in HTML, frontend build variables, Git, screenshots, or chat.
4. Visit `https://YOUR-SERVICE.onrender.com/admin.html` and paste that admin key.

This is a single-admin-key prototype, not email/password or MFA admin accounts.
Creating an admin key locally does not automatically configure Render.
The admin page and API do not use DeepSeek/OpenRouter provider keys.

## Operations

- List the latest 100 customers and their lifetime granted/used/remaining tokens.
- Create a customer key with an initial grant. Raw keys are returned only once.
- Grant additional positive tokens, with a reason/purchase reference.
- Revoke a customer's key. There is deliberately no public reactivation/deletion
  or manual usage editing endpoint. A revoke does not cancel in-flight provider jobs.
- Each web mutation is audited transactionally. Duplicate operation IDs return 409,
  rather than granting twice. On an ambiguous network timeout, refresh first and
  inspect the audit table before resubmitting; do not blindly issue new operations.
- SQL-admin CLI operations remain separate and currently are not recorded in
  `admin_audit`. Keep database credentials restricted and audit those operations separately.

## Safety and limitations

HTTPS is required. Admin authorization is checked on EVERY server request.
Writes also require a matching Origin and JSON content type. The UI keeps the
admin key only in memory, clears it on logout/reload, and locks after 15 minutes.
This is a UI timeout, not expiration of the underlying admin key. Rotate the
 Render `ADMIN_ACCESS_KEY` and redeploy immediately if it leaks.
Do not share the admin key with customers. Add platform rate limits, monitoring,
MFA-backed administrator identity, database least privilege/backups, server audit
retention/access policy and integration tests before public production use.
There is no public endpoint to create or grant access without admin authorization.

Customer-key revocation and account display work against this cloud database.
 The existing local gateway is NOT connected to it. Hosted inference and quota
 settlement require live database/provider validation before they can be enabled;
 see `METERING.md`. Do not advertise these grants as usable AI credits yet.
