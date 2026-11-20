# Administrative rosters: reviewed, executable and notified (main)

## What is live after the schema rollout

Administration and Admin can draft a proposed schedule for an event, select a
**future, unworked** shift of the same event, and submit it. A different Admin
may approve or reject; a separate explicit Admin command applies the approved
change to the selected shift. The original audit trail records all actions.

Previously, the roster application RPC checked `shifts.start_time is not null`
to determine whether work had started. That column is required by the schema
and stores a scheduled-time mirror, so the operation could never succeed for a
real shift. The corrected RPC rejects shifts that are already in progress,
cancelled, past, or have real work-session records, and delegates the change to
the **canonical** `upt_update_shift` method. Canonical update keeps
`scheduled_start`, `scheduled_end`, `start_time` and `end_time` in sync,
revalidates the event window and assignment overlap/capacity and resets crew
confirmation, audit and notifications. Any failure rolls the whole application
back.

## Role boundaries

- Administrative employees can see eligible shift schedule metadata through
  `upt_admin_roster_shift_options()`, but cannot query arbitrary personnel
  shifts or apply approved changes directly. The RPC checks
  `upt_can_manage_administration()`, returns no staff personal data and is
  capped to 1,000 future eligible shifts.
- The target selection RPC rejects an unrelated, cancelled, past or worked shift.
- A draft without a valid target cannot be submitted, including through a
  crafted API request. UI prevents this before submission with NL/FR/EN/DE
  guidance.
- Only an approved Admin may review, and only an approved Admin may apply an
  approved roster. A creator cannot review their own submission.
- The existing shift-change notification goes to the affected crew member.
  No second assigned-worker notification is generated here.

## Transactional user notifications

A database AFTER UPDATE trigger on the proposal performs exactly one phase
transition notification in the same transaction:

- Draft submitted: currently approved, nonblocked Admin profiles other than
  the author receive a request to review.
- Submitted approved/rejected: the author receives the decision.
- Approved applied: the author receives confirmation when another Admin
  applied it. The existing shift trigger independently notifies the worker.

Notifications link to `/portals/administration/rosters`. No notification
appears for a failed or rolled-back database operation. The trigger function is
not directly callable by regular application roles.

## Verification

- `tests/administration-roster-approval-delivery.test.mjs` verifies server
  and SQL source contracts.
- `tests/sql/administration_roster_approval_delivery.sql` checks installed
  functions, permission grants, and actual trigger registration.
- Manual authenticated E2E requires two distinct approved Admin users plus an
  eligible future event/shift and an Administration user. Test submit, review,
  reject, approve, apply, work-session rejections, notification visibility and
  repeated attempts using disposable main-test records.

Limits: source/SQL tests and CI do not constitute a full authenticated browser
E2E run. No real crew shift is created or reassigned by the migration itself.
No production database or CI/deploy is touched without explicit instruction.
