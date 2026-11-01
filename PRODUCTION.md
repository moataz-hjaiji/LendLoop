# Running LendLoop in production

What I would change, most important first.

## Secrets and rotation

- Keep secrets in a manager (Vault, AWS Secrets Manager or similar), not a `.env` file.
- Rotate HMAC secrets without downtime: add a key ID header, have verifiers accept current and previous keys for a window, then retire the old one. Today, rotation needs both sides changed together.
- Back up `N8N_ENCRYPTION_KEY` separately. Without it, stored n8n credentials cannot be read.

## Network and n8n hardening

- Serve n8n over HTTPS on a public URL, because cloud Convex must reach it. Expose only `/webhook/*` through the reverse proxy, and put the editor behind SSO or a VPN.
- Limit who can edit workflows: an editor can use the HMAC credential in a new node without ever reading it.
- Use Postgres and queue mode with workers instead of SQLite and a single process.

## Rate limiting and abuse

- Rate limit at the edge on the n8n webhook and on `/n8n/*` routes. Today every forged webhook writes an error row, so an attacker could flood the log. Aggregate repeated rejections into one alert.
- Rate limit mutations per user (the Convex rate limiter component), especially `loans.request`.

## Replay

- Store seen signatures for the 5-minute window to reject replays outright. Today idempotency makes them harmless rather than rejected.
- Sign the method and path as well as the timestamp and body, so a signature is valid for only one route.
- Sign responses too, or rely on TLS plus pinning, for the overdue feed.

## Queueing and delivery

- Replace the chain of scheduled retries with an outbox table and a Convex cron that re-drives anything stuck in `queued` or `sending`. An action that crashes mid-run currently leaves a visible row but no automatic recovery.
- Add a dead-letter view with a "retry" button.
- Use a real email provider with its own idempotency key, and handle bounce webhooks. Provider-side keys would also close the gap between claim and send.
- Paginate the overdue feed and batch sends.

## Monitoring and alerting

- Send workflow failures to Slack or PagerDuty from the Error Handler, not just to the Admin page.
- Add a heartbeat: alert if the daily workflow has not run in 25 hours. No error workflow can report a schedule that never fired.
- Alert on signature rejection spikes, rows stuck in `queued` or `sending`, and failure rates.
- Ship logs to a central store with Convex log streams, and add error tracking such as Sentry.

## Audit logs

- Add an append-only `auditLog` table for role changes, Trusted Lender grants, admin removals and every status change, recording actor, action, target and time.
- Replace the CLI-only admin bootstrap with an audited, two-person process.

## Backups and data

- Schedule Convex exports, back up the n8n database, and test restores.
- Set retention for `automationEvents` and n8n execution data, and shorten n8n's 14 days or turn off saving successful execution data, because it holds email addresses.
- Provide account deletion and data export for GDPR, including a Clerk `user.deleted` webhook.

## Web security

- Add a strict CSP using nonces, allowing Clerk and Convex origins, starting in report-only mode. `next.config.ts` currently sets only frame, content-type and referrer headers.
- Add HSTS, and use Clerk production keys and domains.

## Product and correctness

- Store a timezone per neighborhood so overdue status follows local midnight.
- Add pagination, and auto-decline overlapping requests on approval.
- Add CI running tests, typecheck, lint and `check:secrets` on each push, plus Playwright end-to-end tests.
- Separate dev, staging and production deployments, each with its own secrets.
