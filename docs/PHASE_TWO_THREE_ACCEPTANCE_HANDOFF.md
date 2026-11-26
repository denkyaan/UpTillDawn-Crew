# Combined phase 2 and 3 acceptance / release handoff

Phase 1 passed Deploy #590 on Main SHA 922092388a4068634286d14313083b1234650ab1 (48 + 160 pixel-exact login cases, 56 role scenarios, 44 deep routes, 30 sessions; no post-deploy resource failures observed). This PR incorporates that exact Main revision and continues both remaining phases without enabling cutover or production. The prior phase-2/3 CI run was no longer accessible when work resumed. Local action evidence is separate from live acceptance.

## Acceptance (phase 2)

The existing explicit Main-only QA run performs login 48/160, seven roles across 56 browser scenarios, 44 deep routes, 30 simultaneous signed sessions, all 163 public write denials for two identities and owned-draft fixture transactions plus independent cleanup. The integrated evidence matrix requires exact registered action IDs, SHA/run/attempt and per-role evidence, and distinguishes public denial from positive persistence. Original and candidate Cloudflare post-deployment windows are measured separately.

The existing native fixture suite covers seven distinct positive action IDs; 156 remain unverified until real isolated transaction tests are implemented and run. A green static PR is not a claim that all functionality works. Complete missing positive original/candidate business transitions with uniquely owned disposable test data, actual persisted-state assertions, role denials and verified cleanup. Never run unbounded positive operations on a shared real account. Maker, provider callbacks, offline/PWA/GPS/chat/device journeys, all remaining screens and performance are explicit blockers rather than guessed successes.

## Cutover (phase 3)

No live cutover command is enabled by this PR. Existing standalone dry-run profiles and production-shaped build rehearsal run without production credentials on migration PRs. Before replacing the original Main Worker, require full phase 2 evidence, exact origin/database/runtime profile, no self-binding, current immutable SHA, verified prior Main Worker rollback version, restored client/offline behavior and operational smoke/rollback rehearsal. Production database schema/permissions, provider configuration and rollback are separate release evidence. Production CI remains explicit owner-authorized and never runs on ordinary Main pushes. No production secrets are used in the branch CI.

The integrated report is stored under test-results/modern-phase-two-three/readiness.json. An absent, stale, failed or duplicate action report is not evidence. The report never authorizes a release; `--enforce` exits nonzero until remaining evidence/authorization is implemented. The five approved workflow files and fast Main CI policy are preserved.

## Isolated PR database acceptance

A separate job in the same CI main PR run replays the actual migrations locally, checks generated types, seeds disposable role accounts including a separate Maker, runs financial and operational SQL/RLS/offline suites, and exercises positive native handler lifecycles against signed local Supabase sessions. Evidence records the exact IDs only after persisted-state assertions; this is local evidence, not live Main or original-vs-native parity. No real remote keys or deployment. The entire local stack is destroyed at job end.

CI #3100 reproduced inventory issuance with a successful mutation but no Head-visible issue row. The existing manager helper permits approved Admins independently of event feature gates, while the three older detail SELECT policies still gated that authority. The new migration aligns those SELECT policies only; non-Admin access remains unchanged. The signed local acceptance suite now verifies foreign-employee denial, issue movements and Head visibility and accumulates independent domain failures in the same run. Failed domains remain fatal; no missing positive action is counted as passed.

CI #3101 verified eight of nine independent domains and the inventory issue/return/foreign-employee denial fix. The remaining asset form used a direct table UPDATE revoked by the original inventory RPC-only policy. Both original and native handlers now share a narrow approved-Admin RPC that locks the row and invokes the existing audited metadata RPC while preserving hidden form fields. Release baseline and generated type metadata are synchronized. No remote migration or release is authorized by this PR.
