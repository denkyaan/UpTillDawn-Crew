# Contract PDF rendering service

This is an **isolated** HTML-to-PDF service. It does not access Supabase, approve contracts, dispatch signatures, or archive documents. It is intentionally separate from the Cloudflare Workers app.

## Deployment

Build the Dockerfile in this directory and deploy it behind an HTTPS endpoint with TLS termination. Set `CONTRACT_PDF_RENDER_TOKEN` to a randomly generated secret of at least 32 bytes, and configure the **same secret** as `CONTRACT_PDF_RENDER_TOKEN` in the Next.js application. Configure `CONTRACT_PDF_RENDER_URL` in the application to the public HTTPS URL of this service, ending in `/`.

The service listens on `PORT` (default 8080). Restrict ingress to the application infrastructure where possible. Do not expose the token in client-side variables. Do not log submitted HTML or generated PDFs. Set resource limits and an appropriate request concurrency limit in the hosting platform.

The application already has `createContractPdfRenderer()` and `renderAndArchiveApprovedContract()`. **Do not call the latter until approval is verified server-side and the storage RLS and immutable-version persistence requirements in `docs/administration-contract-pdf-pipeline.md` are implemented and tested.** Merely configuring this service does not authorize archiving.

## Security boundaries

- POST / with bearer authorization and `Content-Type: text/html`.
- JavaScript disabled; all external network requests blocked.
- Maximum HTML body 512 KB; maximum generated PDF 15 MB.
- Real PDF header verified; no caching.
- PDF generation does not imply signature validity, legal acceptance, or successful Supabase archiving.

## Verification

After deployment, exercise authorized and unauthorized requests, Unicode text, long multi-page agreements, page breaks, and concurrent rendering. Validate returned bytes with a PDF parser and compare all approved clauses against the source document. Confirm failure handling before enabling real contract processing.
