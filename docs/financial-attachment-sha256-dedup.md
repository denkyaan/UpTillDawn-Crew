# Financial attachment SHA-256 verification and deduplication — main

This bundle adds **exact-content fingerprinting** and database-enforced
per-invoice duplicate prevention to the existing private attachment upload
workflow. It does not introduce OCR, Peppol network delivery, malware
screening, a third-party document ingestion provider, or automatic
inventory/accounting posting.

## Working flow

1. An approved Administration user selects a PDF/JPEG/PNG/WebP attachment for
   a draft or in-review financial document.
2. Existing MIME, signature and 20 MB limits run first.
3. The trusted server action reads all bytes once, checks byte length and
   computes SHA-256 from **the same bytes passed to private Storage**.
4. If the selected invoice already has that SHA-256, the request is handled
   as a duplicate without another upload. An identical filename with different
   bytes is **not** considered a duplicate.
5. If two requests race, a unique partial PostgreSQL index on
   `(document_id,sha256)` rejects the losing metadata insert. The server
   removes the losing uploaded object and indicates the duplicate.
6. The UI shows the short fingerprint. The full 64-hex fingerprint is available
   as the element title. The original filename, uploader, timestamp and
   private attachment remain intact.

The server records the hash and storage path in the same metadata INSERT, but
there is no distributed transaction across Supabase Storage and PostgreSQL.
On metadata failure, an explicit private-object cleanup is attempted; any
failed cleanup is logged for operator attention.

## Backward compatibility and trust limits

- Pre-existing attachment rows are **not assigned fictitious checksums**.
  The new nullable `sha256` field remains NULL for legacy records until their
  original private bytes are retrieved and reverified by a controlled migration.
- Unique duplicate enforcement applies only to non-NULL SHA-256 rows. It is
  not a universal deduplication guarantee for legacy records or direct SQL/API
  writes that omit the hash. Those paths should not be advertised as verified.
- All existing attachment authorization/RLS, private bucket settings and
  no-update/no-delete policies remain unchanged.
- SHA-256 proves byte identity but does **not** detect malicious software,
  establish legal provenance, classify invoice content, or prove approval.
  The separate malware scanner requires working vendor credentials. Do not
  present a checksum as an antivirus result.

## Test contract

- `tests/financial-attachment-sha256-dedup.test.mjs`: real byte hashing,
  last-byte changes, empty/overlarge files, server upload identity,
  localized duplicate feedback and persistence contract.
- `tests/sql/financial_attachment_sha256_dedup.sql`: installed CHECK,
  partial unique index, and denied authenticated UPDATE/DELETE.
- Manual main-test acceptance after deployment: upload one invoice attachment,
  repeat with an identical file, verify exactly one record, repeat with
  different file bytes, check both records' fingerprints, and confirm all
  links require Administration permission.

The migration is additive and non-destructive. Production is deliberately
unchanged until the user expressly authorizes a production release.
