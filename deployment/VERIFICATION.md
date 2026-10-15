# Verification — 14 October 2026

Canonical source: `JoelMD-FRIDA/Digital_Demo` main
`5a04b7eae5f85cb650e862bd87d2f75bfbb338c8`. Native integration is on the
separate `codex/digital-documents-infrastructure` review branch. The operator
confirmed a fresh empty installation. These tests use only disposable identities,
a loopback TLS OIDC server and a private temporary PostgreSQL 18.6 cluster.

| Check | Result |
| --- | --- |
| Node 24.21.0 / npm 11.19.0 dependency installation | Passed |
| Production dependency audits, app and tools | Zero reported vulnerabilities |
| TypeScript / ESLint | Passed, zero lint warnings |
| Unit tests | 12 passed: API vocabulary/pagination/PDF, body bounds and redirect/cookie rejection |
| Native PostgreSQL/OIDC integration tests | 15 passed |
| Next 16.4.1 production compilation | Passed |
| Temporary standalone server | Liveness 200, unconfigured readiness 503, private API/probe 401, PDF worker 200; process stopped |
| App/tools image builds and readonly container checks | Prepared in GitHub Actions; pending actual run |
| Real Authelia / cross-app SSO / browser journey | Pending server integration |
| Runtime rootless controls / network / disk / load acceptance | Pending for this app |
| Encrypted off-server backup and restore | Deferred by operator |
| Public activation / automatic delivery | Disabled |

Native tests prove distinct issuer+subject accounts, empty inboxes, signature /
issuer / audience / expiry / nonce / entitlement rejection, one-time callbacks,
refusal of email-only linking, direct-handler cookie-plus-bearer/Origin/CSRF checks,
consent serialization, all 18 documents / 21 files, idempotent imports, SQL/API
owner isolation and restricted metadata writes. They also exercise read state,
retained downloads after disconnect, both policy attachments in both languages,
role separation, checksum migration replay/drift, refusal of populated init,
dependency-aware readiness, backup write barriers, complete RLS-row backup,
empty different-target restore and session invalidation, corrupt-bundle rejection,
owner-only reset, immediate local disable/expiry and narrow deployment probes.

The source-map-js lock entry was updated to its patched 1.2.2 release during
dependency preparation; see [upstream release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).
Production audits were rerun afterward. Earlier Supabase browser results in
`docs/VERIFICATION.md` are historical; they do not prove the new login journey.
SQL under `supabase/` was preserved as reference and is never run by the adapter.

No live account, real document, existing database, paid API or source workstation
secrets were used. Source contract acceptance flags remain false because local
fixtures do not establish server acceptance, actual images or complete shared SSO.

## Session continuity correction — 15 October 2026

The live implementation exposed a 60-second app-session expiry as a full-page
Authelia redirect on every API 401, including insurer consent submission. The
corrected client renews with `prompt=none` in a hidden frame, retries a denied
request once with fresh CSRF headers, and preserves the mounted consent dialog.
A bounded failure leaves selections in place with an explicit same-account
renewal action; it never navigates the main page automatically.

The encrypted HttpOnly renewal binding expires after one hour and never grants
API access. Renewed identity must match the original issuer, subject and profile;
access checks remain bounded to 60 seconds, disabled profiles are rejected, and
no OAuth tokens are stored. Background renewal never extends the one-hour
binding. Removed entitlement, changed SSO identity, tampered/expired binding and
callback replay are rejected. No database migration is needed.

12 unit tests, 18 disposable PostgreSQL/TLS OIDC integration tests, typecheck
and lint passed. A real Chromium fixture rendered the production Dashboard,
consent modal, API client and renewal components. It verified expiry during
consent, preserved checked consent after denial, rejected forged completion,
explicit popup recovery, and one connect/one sync after silent renewal with fresh
CSRF. Its API/IdP callback transport is synthetic; live Authelia/browser acceptance
still requires the server update. An anonymous real Authelia `prompt=none`
request returned `login_required` directly to the app callback without login UI.

Digital's first-party confidential Authelia client must use implicit identity
consent so background authentication does not require a new IdP consent screen.
This does not change sandbox entitlement policy, PKCE, signed claims, or the
insurer consent recorded by the application. Cyber's client stays unchanged.

Expired sessions also resume only the three explicit client-rendered page shells
(`/`, `/connections`, `/account`), so navigation after tab suspension stays in
the app. Private APIs remain denied until renewal succeeds. The encrypted
identity-context cookie remains for up to one day solely to bind an explicit
popup sign-in to the original person after the one-hour renewal window expires;
background renewal cannot extend that window. Explicit recovery requests fresh
login and issues a new binding only after validated same-person OIDC completion.
