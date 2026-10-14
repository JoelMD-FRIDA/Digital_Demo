# Digital Documents deployment preparation

Target: `https://documents.sandbox.freeinsurancedata.de`, central issuer
`https://login.freeinsurancedata.de`, distinct OIDC client
`frida-digital-documents`, entitlement `groups: sandbox-users`.
The approved initialization is **fresh empty**. No old Supabase accounts or data
are imported. Nothing in this repository activates the server or resets data.

## Runtime contract

One non-root Next server on port 3000, private PostgreSQL 18, and short-lived
maintenance containers. App/tools UID:GID is `10001:10001`. PostgreSQL image uses
`999:999` and `/var/lib/postgresql`, PGDATA `/var/lib/postgresql/18/docker`.
Map these IDs through the dedicated rootless runtime; never share Cyber's user,
DB credentials, volumes or app session cookies. Persistent database and bounded
backup staging are the only durable app directories. PDFs are generated in
memory, so no uploads volume, object store, queue or worker is needed.

`.env.example` lists runtime-only app values. Provision actual secrets privately
in mode-0600 files on the server; do not pass them to builds. Use separate DB
credentials for owner/migrations, `frida_documents_app` and
`frida_documents_backup`. PostgreSQL and all app/maintenance ports stay private.
Expose only the reviewed public route. Deny `/api/internal/` and `/api/health/`
at public ingress. Allow only necessary DNS, identity and reviewed delivery
endpoints from the runtime; no app-to-peer or host management access.

Pinned app/tools Dockerfiles and `.github/workflows/frida-release.yml` build on
GitHub-hosted runners. Checks compile, exercise disposable DB/OIDC fixtures and
build/run readonly containers. Main publication additionally requires
`FRIDA_INTEGRATION_READY=true` and all source contract acceptance checks.
Image/provenance and `release.json` bind the repository, main commit, workflow
and immutable app/tools digests. Host verification precedes every pull/rollout.
Readonly/cache/tmp/UID mappings, enforced resource limits and real IdP behavior
must still be tested in the production runtime; local tests cannot assert them.

## Maintenance commands

The tools image has entrypoint `node /tools/tools.mjs`. Its commands are `provision`,
`init`, `migrate`, `backup`, `verify`, `restore`, `create-probe`, `resume`, `smoke`.
The framework passes `["migrate"]`, `["backup"]`, `["verify"]`, `["smoke"]`.
`provision` and `init` are explicit first-install steps, never routine rollout.

All DB commands read `PGSERVICEFILE`, an absolute mode-0600 file containing:

```ini
[frida]
host=postgres
port=5432
dbname=frida_documents
user=CHOOSE_OWNER_APP_OR_BACKUP_ROLE
password=ENTER_PRIVATE_PASSWORD
sslmode=disable
```

Use `disable` only on the isolated stack network; `verify-full` additionally
requires `sslrootcert`. No password belongs in shell arguments/history.

1. With an empty dedicated DB, owner credentials, `FRIDA_EMPTY_INSTALL=true`,
   and independently generated `FRIDA_APP_DB_PASSWORD` /
   `FRIDA_BACKUP_DB_PASSWORD` (24+ characters), run `provision`, then `init`.
   Initialization refuses any unknown populated target. Migration checksums and
   ordering are checked transactionally under an advisory lock. Rerun `migrate`
   for additive upgrades; old baseline SQL is never part of that directory.
2. Owner `create-probe` returns an inactive synthetic profile UUID. Configure the
   app's `DEPLOYMENT_PROBE_PROFILE_ID` and independent 32+ character
   `DEPLOYMENT_PROBE_SECRET`. The probe can only check readiness and that profile;
   it cannot authenticate browser sessions or mutate documents.
3. Backup credentials plus `BACKUP_STAGING_DIRECTORY=/backup-staging` run
   `backup`; save its binary stdout as a private `.tar` bundle. It drains writes,
   pauses mutations and dumps PostgreSQL including all RLS-protected rows with
   an explicit read-only backup policy. Metadata and dump checksums are bundled.
   Staging and stdout are limited to 256 MiB. A failed drain/dump stops rollout.
4. `verify` reads the bundle on stdin, needs staging but no DB credentials or
   network, rejects path/link/extra-entry/checksum corruption and validates the
   dump catalog. Encrypt and retain accepted bundles through the host backup
   framework. Off-server backup setup is currently deferred by the operator.
5. `restore` reads the bundle on stdin and requires owner credentials,
   `FRIDA_EMPTY_RESTORE=true`, and a **different empty database**. It never
   overwrites a populated target. Restored sessions and OIDC transactions are
   invalidated, maintenance is cleared and role grants reapplied. Provision
   target roles before restoring on a separate PostgreSQL cluster. Rehearse with
   synthetic accounts before production activation; do not restore old data as
   an application rollback.
6. `smoke` uses only `SMOKE_BASE_URL=http://app:3000` and narrow `SMOKE_TOKEN`.
   It receives no DB credentials and reads the private authenticated probe.

Normal deployment is verify/pull → backup/verify → locked migrations → replace
only this app → readiness/authenticated smoke → record success. A failed migration
stops before replacement; rollback may change only a compatible app image.
Database data survives app replacement. Migration/backup/rollout remain serialized
by the host coordinator. If a maintenance process is killed after pausing, fail
closed; the owner must inspect its state before explicitly running `resume`.

`/api/health/live` checks only process response. `/api/health/ready` validates
origin/session config, exact schema checksum, restricted DB role, sample catalog,
maintenance and verified OIDC discovery. Missing dependencies return 503.

For central account removal, expire/disable the authoritative central session;
this app's entitlement can remain valid at most 60 seconds. Local `profiles.enabled`
is checked immediately; changes require owner access. Claims do not create staff
roles or administrator privileges. Old registration/password/recovery routes
redirect to central login and their underlying Supabase services are absent.
