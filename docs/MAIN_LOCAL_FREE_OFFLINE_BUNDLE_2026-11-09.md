# UpTillDawn main — local, free and offline-first API reduction

## Scope and delivery policy

Only main changes. CI main validates the commit before Deploy main. Never dispatch CI production or Deploy production from a normal main push.

Local-first means no paid third-party AI API is required for routine briefing or invoice import. It does not mean the entire authenticated crew platform is usable indefinitely without internet. Supabase authentication, shared data, server-side authorization, real-time events and hosting remain needed for collaboration.

## Delivered

1. Crew briefing import is browser-local by default. TXT/CSV is decoded on-device. JPEG/PNG/PDF uses bundled local Tesseract.js and PDF.js; WebP is converted to PNG in the browser. DOCX/PPTX/XLSX are read as bounded ZIP containers using the browser standard DecompressionStream("deflate-raw"), supported on recent iPhone Safari. It extracts document text, shared strings, spreadsheet rows, slides and up to five permitted embedded Office images. No file is sent to a briefing API route, OpenAI or Cloudmersive. All results require human confirmation before publishing.
2. No default paid briefing AI. The legacy briefing-analyze endpoint is retained only for explicit compatibility; it returns an error unless an owner deliberately enables UPT_ENABLE_EXTERNAL_BRIEFING_AI=true. The normal interface does not invoke it. Authentication and role authorization remain.
3. Explicit offline OCR preparation on both Finance and Briefing import. Same-origin pinned OCR worker, PDF.js, Tesseract LSTM engines and the selected language are cached using existing uptilldawn-ocr-v1 Cache Storage. First preparation needs connectivity. Browser storage quota or eviction can still make offline OCR unavailable.
4. Manual event place/address and optional validated latitude/longitude are the default. Online Geoapify autocomplete is off until the operator checks an explicit consent control. Existing GPS attendance and route calculations are not misrepresented as local driving navigation.
5. Existing malware quarantine, role checks, bank/CSV imports, UBL preparation, official Weeztix scanning and payments stay intact. No production settings, tokens or data are touched.

## Services still necessary or not safely replaceable

- Malware: Supabase Edge Function still uses Cloudmersive. Removing it without a replacement scanner would compromise the fail-closed upload quarantine. A genuinely equivalent free alternative needs isolated ClamAV hosting, signature updates, authenticated service access and operational monitoring. Browser validation cannot replace it.
- Peppol: local XML preparation works, but compliant invoice transport and receipts require a provider/access point.
- Payments, banks and Weeztix: real transactions require provider authorization. Validated file imports avoid direct APIs for historical data, but are not real-time sync.
- Live chat translation and AI: browser translation is attempted first; the existing Cloudflare AI fallback remains when local translation is unsupported. No trustworthy full offline multilingual model is shipped for all iPhones.
- Login, remote push, server-side access controls and collaboration still use Cloudflare/Supabase and network access.
- Free means zero separate external OCR/briefing-AI call fees for the default flow, not zero infrastructure, AI model, storage or remaining malware-scanning costs.

## Safeguards and validation

- Office ZIP is bounded: max input 20 MiB; max XML entry 8 MiB; aggregate selected XML 24 MiB; compressed/uncompressed sizes checked; encrypted/unsupported ZIP entries rejected; no code, markup or macros executed. Embedded image attachments are capped and header-checked.
- PDF OCR is limited to 12 pages and bounded raster dimensions. Default Finance OCR remains limited to 5 MiB. Explicit Briefing import can accept up to 20 MiB.
- Draft title/text and extracted images require review before save/publish. Existing Supabase RLS/RPC and audit controls stay active.
- Regression: tests/offline-free-api-bundle.test.mjs, existing briefing/office/OCR/navigation/financial/malware suites, TypeScript, Cloudflare build, CI main and Deploy main.
- A real iPhone test (scanned PDF and Office import, then offline repeat after preloading) is still required. Automated tests cannot certify storage persistence or real-world OCR accuracy.

## Contextual address search and document intake (follow-up scope)

- The shared AddressAutocomplete defaults to manual offline-friendly entry. The user must opt into Geoapify queries. This control is reused for personal profiles and Driver destinations.
- Structured billing address fields are reused on canonical Customers/Suppliers, the Administration contacts entry, the Finance counterparty forms and the Peppol billing settings form. Address selection fills street, postal code, city and ISO country code; every field remains editable. Server-side validation remains authoritative.
- Driver trip creation defaults to a manually verified route duration and distance. The Admin may explicitly opt into Geoapify routing if configured. This is not an offline trip submission: saving to shared cloud data still needs connectivity. If online routing fails, it never invents travel estimates.
- The existing Administration > Documents module now exposes the existing event-scoped document library and the existing role-gated upload action, with per-event workpost scope and the current malware quarantine. Finance invoice attachments, guestlist document import, profile photos, incident media and event documents were already present and remain integrated rather than duplicated in new upload APIs.
- Administrative users without the underlying manager/event-document permissions are not silently elevated. Uploading or editing another user's records still requires the existing authorization.
- Document uploads are server-processed after connectivity is restored; do not promise offline uploads without a separately tested queue and conflict resolution. Offline-critical event document download behavior is unchanged.

### Additional validation

- Existing counterparty, role, financial upload, Peppol and event document tests.
- New local-first contextual address/documents regression tests.
- End-to-end real-device tests should verify address manual/online selection, document permissions, upload quarantine/release and resume behavior after offline operation.

## Event location completion — no unrequested geocoding

The existing event create/update server actions used to invoke Geoapify whenever a manually typed address had no coordinates. That was a hidden paid-API dependency and could prevent creating events if the API was unconfigured. Both event action implementations now accept manual venue/address values with null coordinates without performing any provider lookup. Verified latitude/longitude from a selected suggestion or deliberate manual entry are preserved; incomplete coordinate pairs remain invalid. The event form explicitly warns that GPS-radius check-in requires accurate coordinates and cannot function without them. The separately opted-in driver routing and address autocomplete APIs are unaffected. No GPS coordinates are fabricated.
