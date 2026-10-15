# FRIDA Digital Documents

One Next.js application, a private local PostgreSQL database and central FRIDA
OIDC login. The operator selected a fresh empty sandbox. New accounts start with
an empty inbox; connecting the three fictional insurers imports 18 sample
documents with 21 PDF files. German/English layouts and on-demand PDFs remain.
The fictional policyholder is Alex Morgan. No real insurer is connected.

Use Node 24.21.0 / npm 11.19.0 and PostgreSQL tools 16 or newer for local checks:

```sh
npm ci
npm ci --prefix deployment
npm test
npm run test:integration
npm run lint
npm run typecheck
NEXT_TELEMETRY_DISABLED=1 npm run build
```

The integration command creates and destroys its own Unix-socket-only PostgreSQL
cluster and local TLS OIDC fixture. It never uses an existing database or account.
`FRIDA_PG_ROOT` can point to extracted PostgreSQL 18 packages. Native Supabase
password/Auth/REST adapters and their old browser fixtures have been replaced.
The old SQL under `supabase/` is historical reference; never apply it to the new
runtime. Browser acceptance against the real central login is still required.

Production preparation and exact maintenance commands are documented in
[deployment/README.md](deployment/README.md). Local evidence and remaining server
checks are in [deployment/VERIFICATION.md](deployment/VERIFICATION.md). Image
builds run on GitHub-hosted runners. Publication and automatic deployment remain
blocked by the source contract and repository variable until integration passes.

## API

Use the application's `/api` base with its host-only opaque session cookie.
Bearer credentials are rejected, including when a valid cookie is also supplied.
Mutations require the exact application Origin and `x-frida-csrf` matching the
session and CSRF cookie. The browser receives no database or OIDC client secrets.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/documents?sortAsc=true` | Search active simulated connections with optional ISO timestamp bounds |
| GET | `/api/insurance-infos` | Active insurer metadata |
| GET | `/api/files/{uuid}` | Authorized PDF; `locale=de/en`, `preview=1` for inline display |
| GET | `/api/workspace` | Own saved inbox and connections |
| POST | `/api/connections` | `action: connect/sync/disconnect`, `insurerId`; connect requires `accepted: true`, `locale: de/en` |
| PATCH | `/api/documents/{uuid}` | Mark own imported document read |
| POST | `/api/reset` | Reset only the requesting account's progress |

Contract vocabulary, including `casuality`, and inclusive timestamp-group
pagination are preserved. Imports are idempotent and derive metadata from the
server-owned catalog. Per-account transaction locks serialize consent, imports,
disconnect and reset. Row-level policies enforce the transaction's account ID;
app credentials cannot create schema, change profiles or replace document
metadata. Downloads require an active connection or a previously imported
record. Imported documents remain available after disconnect. All protected
responses use `private, no-store`.

Login uses signed OIDC authorization-code flow with PKCE/state/nonce, exact
issuer/audience and sandbox entitlement. Identity mappings use issuer+subject;
matching email alone never links accounts. App sessions expire after at most
60 seconds, then central SSO reauthenticates without a second password prompt
while the central session remains valid. Local disabling is checked on each
request. Local logout removes this app's session; central SSO logout is separate.
This sandbox has no staff tool or MCP access.

Supply the actual operator privacy/legal and central account-management details
before inviting external users. The UI notice describes the sandbox's data use;
it is not a complete legal notice. Sample screenshots in `docs/screenshots` and
the historical verification report describe the earlier implementation.
