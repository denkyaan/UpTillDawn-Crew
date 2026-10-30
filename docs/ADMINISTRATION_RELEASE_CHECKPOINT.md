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

## Acceptance iteration 3

The SQL security-surface gate found delegated presence authorization without an explicit top-level caller guard. Presence now checks the authenticated approved caller directly. Scoped promotion suspensions also deny chat and directory access. The SQL security-surface suite and positive/negative suspension checks pass on staging. Expected migration: 20261030172206.

## Acceptance iteration 4

The 15-bot run found a language hydration error in the administration navigation. Its first render now uses the server-provided locale. A user also reproduced portal escape through shared personnel links. Administration retains its own routes for notifications, timesheets, profile and sales, including topbar and notification targets. Category detection no longer treats every subpage as the dashboard. Navigation is available on desktop as well as mobile. A focused authenticated click test runs before the 15-bot suite for both Admin and administrative employee.

Temporary staging QA fixtures were removed and their cleanup migration is recorded. Final review of operational cases remains Admin-only and also permits an Admin to review an Admin-created case. Contract and roster approval rules are unchanged. Latest staging migration: 20261030174239.

Mobile chat and Admin AI buttons are positioned above the expanded subtabs so they cannot cover navigation targets. The header identifies the selected portal for administrative staff.
