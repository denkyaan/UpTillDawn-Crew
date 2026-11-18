# Provider login in UpTillDawn — final-user ownership

**Requirement:** The Maker/developer cannot log into the final organizer's external services, and must not request the organizer's passwords, API keys, merchant codes or private financial access. After one-time **UpTillDawn application registration**, the Head Admin or authorized Administration operator selects **Connect my account** inside the relevant workflow, logs in at the provider (never in an UpTillDawn password form), consents, and returns to UpTillDawn. Tokens are encrypted with AES-256-GCM, access-controlled by the organization's database functions, and are not returned to client code.

## Current implementation

| Service | User action inside UpTillDawn | Platform developer prerequisite | Scope / limitation |
|---|---|---|---|
| SumUp | Banking/Sales → Connect → provider login & consent | Register an UpTillDawn OAuth web client, fixed callback and server-only ID/secret | Read-only transactions and user identity. **Payments** require SumUp approval and separately tested flows |
| Billit / Peppol | Invoices → Connect → Billit login & consent | One UpTillDawn OAuth client for sandbox; a **different approved client** for Billit production | Tokens only permit authorized account access. E-invoice sending is independently disabled until provider acceptance |
| Weeztix | Ticketing → select UpTillDawn event → Connect → Weeztix login & consent | Register one UpTillDawn OAuth application and callback, install server-only credentials | A single selected active event is configured; provider admission/scan response still governs actual entry |
| Ponto / bank | Banking → bank statement import until official partner integration is ready | Ponto integration/partner approval and verified bank-consent flow | Never ask for bank password. A Ponto website link alone **does not** connect accounts |
| Documenso | Contracts stay local/read-only until verified integration | Documenso currently documents API tokens for third-party programmatic access; not a validated OAuth-consent API | Signing cannot safely activate solely from a Documenso website login |
| EventPay | Bar, Merch and Tokens use EventPay's own terminals/POS until officially supported | Provider contract and verified RFID/QR wallet/charge API | UpTillDawn must not invent balance or charge operations; an account website link is not a payment integration |

## One-time platform registration (NOT a final-user task)

All provider OAuth **client identifiers and secrets** belong to the UpTillDawn application. They are installed **once** in the server environment as secret bindings; never place any of them in the repository, local storage or browser:
- SumUp: `UPT_SUMUP_OAUTH_CLIENT_ID`, `UPT_SUMUP_OAUTH_CLIENT_SECRET`. Callback: `/api/administration/integrations/oauth/sumup/callback`.
- Billit: `UPT_BILLIT_OAUTH_CLIENT_ID`, `UPT_BILLIT_OAUTH_CLIENT_SECRET`; `UPT_BILLIT_OAUTH_ENV=sandbox` for test. Billit production requires separate provider-issued app credentials and explicit `UPT_BILLIT_OAUTH_ENV=production`. Callback: `/api/administration/integrations/oauth/peppol/callback`.
- Weeztix: `UPT_WEEZTIX_OAUTH_CLIENT_ID`, `UPT_WEEZTIX_OAUTH_CLIENT_SECRET`. Callback: `/api/administration/integrations/weeztix/callback`.
- Shared encrypted token storage uses a valid 256-bit `UPT_INTEGRATION_ENCRYPTION_KEY`, already required by the existing app.
- The exact HTTPS production app origin must be allowlisted in `UPT_PROVIDER_OAUTH_ORIGIN` for SumUp/Billit and `UPT_WEEZTIX_OAUTH_ORIGIN` for Weeztix. The Main OAuth callbacks have a pinned Main Worker hostname; do **not** register Main callbacks in the provider's production application.

If developer app registration or security secrets are absent, the user sees a neutral **"UpTillDawn application setup pending"** message, not a form asking for their key. No fake connected status. No customer data is required for preparing the software itself.

The provider redirects the browser back with an authorization code. Every callback checks a random 256-bit state bound to the signed-in operator, stored in a 10-minute Secure/HttpOnly/SameSite=Lax cookie. Only approved Administration roles may use the endpoints. All tokens remain server-side and encrypted. A callback code is single-use; rotating refresh tokens are used server-side on read-only health checks. If revoked, the user must authorize again.

## Acceptance still required

The implementation and unit tests do **not** demonstrate real third-party OAuth permission until UpTillDawn's developer OAuth application is registered and authorized by the vendor. Actual charges, Peppol invoice delivery, Documenso signing, bank consent and EventPay balance/checkout require independent, approved provider tests. No final-user credentials must be requested from the Maker for those tests. The last confirmed **full** Main seven-role/30-session/Worker runtime acceptance is run #44314081051; the current OAuth integration bundle requires its own successful fast Main CI/deploy and must not trigger Production.
