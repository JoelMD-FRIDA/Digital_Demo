> Historical Supabase verification only. Current native PostgreSQL/OIDC evidence is in [deployment/VERIFICATION.md](../deployment/VERIFICATION.md).

# Verification — 10 September 2026

Implemented and verified against a dedicated local Supabase instance, with real Auth, Postgres, RLS, and Mailpit. No hosted Supabase project or Vercel deployment was created.

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Production Next.js build | Passed |
| Unit / contract / PDF / retry tests | 10 passed |
| Real local API and two-account isolation tests | 5 passed |
| Full browser customer journey and failure recovery | 2 passed |

The normal unit command skips the five local integration tests by design. They were run separately using `npm run test:integration` and all passed.

The customer browser journey exercised registration, required email confirmation, three insurer connections, 18 imported documents, cancellation, search and combined filters, unread state, both PDF attachments, real downloads, German/English switching, a 390px mobile viewport without horizontal overflow, synchronization, disconnection, retained file access, logout/login persistence, email-based password recovery and sandbox reset. The second scenario intentionally failed an import and a preview, then verified successful retries without duplicate documents or lost consent, and keyboard focus restoration after closing the dialog.

Real integration requests confirmed that another account cannot read or alter an owner's rows or download its files. Direct metadata/connection writes are denied. Reset leaves the authenticated account and other accounts' data intact.

## Screenshots

- [Desktop inbox](screenshots/inbox-desktop.png)
- [Empty inbox](screenshots/empty-desktop.png)
- [Rendered PDF preview](screenshots/document-preview.png)
- [Mobile inbox](screenshots/inbox-mobile.png)
- [Mobile insurer connections](screenshots/connections-mobile.png)

These are screenshots of the working application, not design mockups. Customer records used by the tests are fictional and test accounts were cleaned up afterward.

## Remaining external setup

Hosted operation requires its own Supabase project, SMTP sender, exact callback URLs and Vercel environment variables. Hosted email delivery and deployment have not been tested. Setup instructions are in the project README. The original Cyber Demo hosted URL had a certificate error, so visual matching used its local source and assets.

## Cyber visual alignment — 12 September 2026

Updated the customer shell to use Cyber's top navigation, prominent single-line branding, compact bold headings, neutral outlined surfaces and diagonal background motif. Authentication now uses a centered 420px white card on Cyber's dark teal gradient. The account and document flows are unchanged.

Rechecked ESLint, TypeScript and the production build successfully. Both browser scenarios passed after restarting an unresponsive local development server, including the complete customer journey, mobile overflow check, PDF downloads, consent and preview failure retries. The screenshots above have been refreshed for this design. The API integration results above remain from 10 September; this visual update did not alter the backend.
