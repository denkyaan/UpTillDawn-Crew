# Combined phase 2 and 3 acceptance / release handoff

This branch prepares both phases in one PR, without deploying or superseding the phase 1 Main run. Do not merge until phase 1 is resolved and review the base SHA again.

## Acceptance (phase 2)

The existing explicit Main-only QA run performs login 48/160, seven roles across 56 browser scenarios, 44 deep routes, 30 simultaneous signed sessions, all 163 public write denials for two identities and owned-draft fixture transactions plus independent cleanup. The integrated evidence matrix requires exact registered action IDs, SHA/run/attempt and per-role evidence, and distinguishes public denial from positive persistence. Original and candidate Cloudflare post-deployment windows are measured separately.

The existing native fixture suite covers seven distinct positive action IDs; 156 remain unverified until real isolated transaction tests are implemented and run. A green static PR is not a claim that all functionality works. Complete missing positive original/candidate business transitions with uniquely owned disposable test data, actual persisted-state assertions, role denials and verified cleanup. Never run unbounded positive operations on a shared real account. Maker, provider callbacks, offline/PWA/GPS/chat/device journeys, all remaining screens and performance are explicit blockers rather than guessed successes.

## Cutover (phase 3)

No live cutover command is enabled by this PR. Existing standalone dry-run profiles and production-shaped build rehearsal run without production credentials on migration PRs. Before replacing the original Main Worker, require full phase 2 evidence, exact origin/database/runtime profile, no self-binding, current immutable SHA, verified prior Main Worker rollback version, restored client/offline behavior and operational smoke/rollback rehearsal. Production database schema/permissions, provider configuration and rollback are separate release evidence. Production CI remains explicit owner-authorized and never runs on ordinary Main pushes. No production secrets are used in the branch CI.

The integrated report is stored under test-results/modern-phase-two-three/readiness.json. An absent, stale, failed or duplicate action report is not evidence. The report never authorizes a release; `--enforce` exits nonzero until remaining evidence/authorization is implemented. The five approved workflow files and fast Main CI policy are preserved.
