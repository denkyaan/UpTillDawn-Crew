# Contract PDF generation and signing integration

## Implemented
- Approved artist/staff contract payloads and print-ready HTML.
- Pluggable server-only PDF rendering pipeline with a genuine PDF byte check.
- Immutable content-addressed private archive names for PDFs and JSON evidence.
- Separate SHA-256 hashes for source payload and rendered PDF.
- Upload and immediate read-back verification; later independent verification.
- Authorized session access for the existing DJ archive download route.

## Required before enabling production contract generation
1. Select and deploy a reliable HTML-to-PDF renderer supporting Unicode,
   A4 pagination, embedded fonts, and Cloudflare Workers compatibility.
   Wire it into `generateAndArchiveContract`; do not use HTML renamed as PDF.
2. Implement narrowly scoped write authorization and storage RLS for approved
   contract versions. The current archive bucket intentionally denies writes
   to ordinary authenticated sessions.
3. Persist the archive PDF and evidence paths against an immutable approved
   version in an auditable database transaction/state machine.
4. Provision a Documenso signing service and validate its actual documented
   API and webhook signatures before enabling dispatch.
5. Implement explicit dispatch approval, recipient verification, idempotency,
   replay-resistant webhooks, signed-PDF archival, and error recovery.
6. Cover staff-specific approval and contract access separately.

## Safety
The generation pipeline does not send contracts or create signing requests.
It requires a caller-provided trusted renderer and storage client. No
service-role key is used in application runtime. A successful source-code
commit does not mean Supabase migrations have been applied.
