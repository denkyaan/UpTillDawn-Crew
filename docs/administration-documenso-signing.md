# UpTillDawn Crew — self-hosted Documenso signing

Status: **integration foundation only**. No documents are currently sent or signed by UpTillDawn Crew.

## Architecture

- UpTillDawn Crew remains on Cloudflare Workers, with Supabase for its administration records.
- Run Documenso on a separate HTTPS host supporting Docker, PostgreSQL, persistent storage and SMTP.
- Do not deploy Documenso inside the Cloudflare Worker.
- Keep the API token in a server-side secret; never prefix it with NEXT_PUBLIC_.
- Use separate development and production instances and credentials.

## Required application secrets

- `DOCUMENSO_BASE_URL`: public HTTPS origin of your own Documenso instance, for example `https://sign.example.com`.
- `DOCUMENSO_API_KEY`: API key issued by that instance.

Do not commit real secrets. Both values must be present for the connection to be considered configured.

## Production checklist

1. Provision a separate host, PostgreSQL, persistent document storage, SMTP and TLS.
2. Deploy a **pinned** Documenso release, not `latest`.
3. Supply a password-protected signing certificate, stored outside the container.
4. Disable public registration and restrict administrator access.
5. Restrict outbound egress, including access to private network addresses and cloud metadata.
6. Configure encrypted backups, restore testing, monitoring and access logging.
7. Verify `/api/health` and `/api/certificate-status` return healthy results.
8. Configure the two UpTillDawn server-side secrets.
9. Add an explicitly authorized contract-send operation and verified, replay-safe webhooks.
10. Store the final signed PDF and audit evidence with role-based access; implement retention/deletion rules.
11. Review contract jurisdiction and electronic signature assurance levels for international artists and staff.

**Important:** a self-hosted PDF signing certificate does not itself create an eIDAS qualified electronic signature (QES). For QES, integrate a qualified trust service separately when required.

Documenso docs:
- https://docs.documenso.com/docs/self-hosting
- https://docs.documenso.com/docs/developers/api

The integration must not send live documents until deployment, credentials, approval checks and webhook verification are all complete.
