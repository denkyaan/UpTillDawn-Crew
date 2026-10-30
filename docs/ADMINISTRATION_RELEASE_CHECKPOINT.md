# Full staging acceptance checkpoint

Date: 2026-10-30 (Europe/Brussels)

- Application implementation commit: b7c921723bfa6a7e9065d22af26a7de3e9619826.
- Generated schema types: 9291376dbbd856a4266f840bfe82461a0ea2c648.
- Fast validation, fresh schema replay/type generation, staging Worker build, deployment and HTTP smoke succeeded.
- Local Node suite: 756 passed. Production dependency audit: zero vulnerabilities.
- Seven authenticated staging RPC workflow checks passed. Rolled-back SQL validated payroll seconds, staff denial and deadline deduplication.
- This file deliberately requests the complete application CI and browser acceptance once for this candidate.

Full application completion remains blocked on external banking/Peppol/accounting/signing/OCR/promotion-verification integrations and any failures found by full acceptance. This checkpoint is not a production-release certificate.

## Acceptance iteration 2

The first full run found an unindexed promotion-chat sender foreign key. The sender index is added, and staging legacy index parity is restored. The complete public foreign-key index check now passes on staging. Expected migration: 20261030161753.

All eight authenticated HTTP/form workflow checks passed, including four-locale page rendering.
