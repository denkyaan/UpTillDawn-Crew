# Administration new-shift proposal workflow (main-test)

The same two-person approval workflow now supports both **new crew shifts** and
**changes to existing shifts**. Administration does not directly create shifts.

## Workflow

1. Administration selects an event, proposed start/end in Belgium time, title
   and rationale. Existing DST gap/overlap validation applies.
2. In the draft choose either:
   - An eligible future, unworked shift to modify; or
   - A new shift's approved event crew member, active workplace, position,
     shift type (event / setup / breakdown), and optional overlap permission.
3. The server stores the draft with `plan_kind=update|create` and mutually
   exclusive target/planned data. Switching mode clears abandoned payload.
4. Submit: validates matching event membership, active workplace, approved
   and unblocked staff, future schedule, assignment overlap and capacity.
5. A **different Admin** approves or rejects with a reason. Existing SQL and
   transactional notifications remain authoritative.
6. An explicit Admin **Apply** action invokes the existing checked
   `upt_create_shift` or `upt_update_shift` RPC. Both enforce the latest
   event hours, overlaps, capacity and permissions. The new shift ID is
   stored in the proposal audit record; a repeated application is rejected.
7. The canonical shift trigger notifies the assigned worker; roster workflow
   trigger informs Admin reviewers and the proposal author.

## Access and safety

Administrative employees obtain only event-scoped names and IDs of approved
crew and active workplaces from two bounded SECURITY DEFINER RPCs.
They do not receive sensitive financial, legal identity, or banking fields.
Every RPC checks the current authenticated account's Administration
authorization; neither function is executable by anon. Other global portal
RLS rules are unchanged.

No SQL migration directly creates a real shift. Any actual creation requires
a reviewed proposal and a separate Admin application. Existing proposals
remain update-mode records by default. Source and SQL checks, and an isolated
rollback-only transactional main-test fixture, validate the flow.

## Remaining external work

Automated roster optimization and labor/legal rest-rule engines are outside
this bundle; the app provides explicit human scheduling and conflict checks.
Real staff mobile/browser E2E still requires seeded disposable role accounts
and credentials. External accounting, Peppol, payments, signature service and
malware-scanning credentials are separate dependencies.

Production CI/deploy and production database are unchanged.
