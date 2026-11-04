# Production operations

This repository does not provision production infrastructure or create backups by itself. Complete the following steps with the selected hosting and managed-database providers before accepting real customer bookings.

## Deployment configuration

- Deploy `client/` and `server/` as separate services and use a managed MySQL-compatible database (the backend uses `mysql2`; PostgreSQL is unsupported). Keep staging and production databases separate.
- Set the server environment to `NODE_ENV=production`. Startup validates database settings, HTTPS client origins, and distinct, non-placeholder JWT secrets of at least 32 characters.
- Provision the database and separate accounts: `DB_USER` is the runtime account and should have only application DML privileges; `MIGRATION_DB_USER` is a release-only account with the schema and data privileges needed by the migration files. Provide `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` to the API service. Provide the migration credentials only to the release migration step; it needs the runtime username for separation validation, but not the runtime password. Use unique passwords for both accounts. The migration runner connects only to the configured database and does not create databases or require server-level credentials. Do not use the development root account.
- Set `JWT_SECRET` and `JWT_REFRESH_SECRET` to separate randomly generated secrets. Store them in the provider's secret manager, never in source control or build logs.
- Generate each JWT secret with a cryptographically secure random generator (for example, `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`). The values must be different.
- Set `CLIENT_URL` to the comma-separated HTTPS origin(s) allowed to call the API. Set `COOKIE_SAME_SITE` to `lax` unless the frontend and API require cross-site cookies; cross-site deployments must use `none` over HTTPS.
- Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` in the frontend's build environment.
- Configure `REDIS_URL` with a managed Redis-compatible service for shared rate limits. Configure `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, and `OBJECT_STORAGE_PUBLIC_URL` for S3-compatible media storage; use `OBJECT_STORAGE_ENDPOINT` and `OBJECT_STORAGE_FORCE_PATH_STYLE=true` only when required by the provider. Supply object-storage credentials through the hosting platform's workload identity or secret manager, not repository files.
- Apply database migrations as a single release step before switching traffic. MySQL advisory locking prevents concurrent migration runners from applying the same migration simultaneously; it does not make MySQL DDL transactional or provide down migrations. Keep the previous application release available for rollback.
- Migrations are additive and must remain backward compatible with the prior application release. Verify a fresh MySQL 8.4 migration and an upgrade from the previous release before deployment.
- The Compose file provisions only a local MySQL database bound to loopback. Its required credentials are for development and must not be used in a hosted environment.

## Backup and restore

Before launch, configure the managed database to take encrypted automated backups and enable point-in-time recovery where available. Restrict backup access to the operations team and use a retention period that meets the organization's legal and recovery requirements.

1. Define and approve the recovery point objective (maximum acceptable data loss) and recovery time objective (maximum acceptable outage).
2. Record the provider-specific backup schedule, retention, encryption, access controls, and restore procedure in the operations runbook.
3. Before schema or application releases, verify a recent restorable snapshot is available.
4. Perform a restore drill into an isolated database at least quarterly and after changing providers or backup configuration. Never test a restore over production.
5. After restoring, apply only the migrations required for the selected application release, verify key tables and a read-only health check, and document the result.
6. For rollback, restore a snapshot only when data loss is approved. Prefer rolling application code back while keeping backward-compatible schema changes in place.

The migration runner tracks applied migrations and uses a MySQL advisory lock, but does not implement down migrations. Use additive, backward-compatible schema changes and provider snapshots; do not assume application rollback reverses a database migration.

## Health, logs, and incident response

- Monitor `GET /api/health`; a healthy response includes `status: "ok"` and `database: "ok"`. Alert on non-200 responses and sustained latency.
- Forward the backend's structured request and error logs to the hosting provider's log service. Use the `X-Request-Id` response header to correlate a report with server logs.
- Configure frontend and backend error reporting (for example, Sentry) and uptime checks in the chosen providers. This repository does not contain vendor credentials or send events to a third-party monitoring service.
- Alert on elevated 5xx responses, database connection failures, authentication rate-limit responses, and backup failures.
- Production rate limits use the configured shared Redis-compatible store; non-production runs use process-local memory. Tune per-endpoint limits for expected traffic and abuse patterns.
- Production uploads use configured S3-compatible object storage and the configured public media URL. Non-production runs store images on local disk. Configure a CDN in front of object storage where appropriate.
- Pending, confirmed, and active reservations block overlapping dates. Public and admin reservation creation share a transaction that locks the car row before checking availability and inserting the booking.
- Successful admin mutation responses are held until the audit row is inserted. Audit entries include the actor, action, target ID, and a JSON before/after summary for reservation status changes and extensions; generic mutation entries include changed field names only. If the audit insert fails, the request returns an error, but this request-level mechanism is not an atomic transactional outbox with the business mutation.
- Refresh tokens are stored as hashes, rotated on refresh, and revocable on logout. The authenticated `/api/v1/auth/logout-all` endpoint revokes all refresh sessions for the current user. Cookie refresh/logout endpoints require an allowed `Origin`.
- Any future password-change or password-reset flow must call `revokeUserRefreshSessions(userId)` after the password update commits. No password-change endpoint currently exists.
- Keep a tested rollback release and an incident contact list available to the on-call operator.
- Email delivery is not implemented in the backend; do not promise booking or contact-email notifications until a provider integration, retries, and failure handling have been added and tested.

## Release checks

The GitHub Actions workflow starts MySQL 8.4, applies migrations, and runs backend unit and database concurrency/booking integration tests. It also runs Playwright browser checks for customer registration, booking, cancellation, and an admin reservation view, alongside frontend lint/build and dependency audits. Dependabot is configured for weekly npm and GitHub Actions updates. Enable repository Dependabot security alerts/security updates and protect the production branch with required CI checks and reviews; do not deploy when checks fail. Provider-specific staging deployment, backup/restore evidence, alert destinations, and rollback execution still need to be configured and verified outside this repository.
