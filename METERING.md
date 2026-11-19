# Hosted token enforcement — test before launch

## Why this is on the server

The downloadable app must contain only the customer's `sk-gw-…` key and your HTTPS
URL. A local counter can be edited or deleted, so it never authorizes requests.
Every hosted `/v1/messages` call authenticates the key, checks revocation, and uses
the customer's persistent PostgreSQL ledger. A copied key shares that same balance.
Changing/reinstalling a client cannot reset it.

## Current implementation

- Apply the updated `schema.sql`. Set database/provider secrets on the Render Web Service.
- Inference stays disabled unless `INFERENCE_ENABLED=true`.
- Before enabling, set `MAX_PROVIDER_REQUEST_TOKENS` to a VERIFIED upper bound of
  the provider's accepted total input + cache + output tokens per request.
  This is a safety reservation, not an estimated prompt size or output limit.
  Do not lower it to squeeze a request into a user's remaining balance.
- PostgreSQL locks the customer row and allows only one unsettled request per
  customer. That prevents simultaneous requests spending the same allowance.
- Reserve the full verified ceiling BEFORE calling the provider. If insufficient,
  return HTTP 402 without a provider call. Requests can therefore stop EARLY,
  even with a positive balance smaller than the required safety reservation.
- Use DeepSeek Flash explicitly, thinking disabled, client tools only, 4096 max
  requested output tokens. No arbitrary provider URL/model is accepted.
- Obtain one final upstream response, count input + output + cached input exactly
  once, and debit actual tokens in an idempotent transaction before sending the answer.
- If actual usage exceeds the configured ceiling, record it and freeze the account.
  That indicates a configuration/provider-contract breach; it must be investigated.
- Unknown provider errors, missing usage, timeouts, or DB settlement failures keep
  the reservation held and block new calls. NEVER auto-refund an ambiguous charge.
  Reconcile against provider records through trusted database administration.
  Do not blindly delete holds or rerun requests. No public hold-release endpoint exists.

This fail-closed design trades availability for protecting your allowance.
A request already accepted by the provider may still incur charges after revocation,
client cancellation, or timeout. No distributed proxy can promise to undo those charges.
Dollar budgets and tier-multiplied credits are separate from this raw-token ledger
and have NOT been connected here. OpenRouter helpers are NOT metered by this route yet.

## Client setup after deployment

Once validated and enabled, use your Render HTTPS origin as the gateway base URL,
and the customer's `sk-gw-…` key as its API key. Do NOT use `local-gateway`.
The existing HTTP local server is independent and bypasses this database; it must
not be included in a production bundle with your provider keys.

Its authenticated `/v1/messages/count_tokens` companion uses offline
`cl100k_base` tiktoken plus approximate message framing and does not debit tokens.
It is a compatibility estimate, not DeepSeek's official billed-token count.
Provider credentials must be configured as Render Web Service
environment variables; no provider key belongs in a download or browser bundle.

Non-streaming and buffered SSE responses expose:
- `X-Gateway-Tokens-Used`
- `X-Gateway-Tokens-Remaining`
- `X-Gateway-Request-ID`

The portal `/api/account` shows settled and reserved tokens. Reload/login to refresh.
These headers are not a universal Claude UI widget. Normal provider `usage` fields
are preserved for client compatibility; package balance is not substituted into them.
No edits or patches to Claude Desktop binaries are made.

## Operational restrictions and mandatory validation

This prototype buffers generation before emitting SSE. It is not realtime token
streaming and sends no keepalives during generation. Provider timeout is 45 seconds;
verify your hosting plan's execution limits and use a long-running server if needed.
The hosted endpoint currently caps requested output at 4096; clients requesting more
receive 400. Hosted model listing/count_tokens endpoints remain future work.

Current tests use mocked database interactions; they do NOT prove PostgreSQL locking,
 Render deployment behavior, real usage accounting, or Claude streaming compatibility.
Before enabling for paying users, run real database tests for parallel calls,
revocation, duplicate settlement, cold starts, provider failures, process termination,
and reconciliation. Add deployment-level rate limits and authentication abuse
protection. Review costs, privacy, supported content and billing terms.

This is not "fully secure" certification or a ready-to-sell metering service.
