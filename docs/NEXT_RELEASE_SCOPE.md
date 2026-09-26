# Next operations release scope

This release builds on the validated production baseline and targets the remaining operational improvements:

1. Supabase Realtime-driven refresh for operational state.
2. Admin command center for live event operations.
3. Automated operational alerts using the existing notification/push pipeline.
4. Shift planning conflict detection.
5. Event templates / duplication.
6. Staff availability integration in planning.
7. Time-bound QR attendance tokens.
8. God Mode audit/recovery hardening.
9. Backup/restore and migration replay verification documentation.
10. Supabase leaked-password protection deployment requirement.
11. Low-volume observability/health dashboard.
12. Critical workflow E2E/release-gate coverage.

Implementation rule: preserve RLS/RPC authorization as authoritative; Realtime and UI checks are convenience layers only.
