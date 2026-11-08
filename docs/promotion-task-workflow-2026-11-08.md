# General promotion task workflow

General promotion work can now be created without an event from Admin's central
promotion management and from the same management page in Administration. These
mutations require a real Admin or the application owner. Administrative employees
do not acquire approval or assignment rights by opening the page.

- Creation assigns one to one hundred distinct, approved, unblocked Promotion
  members with an active portal role. Task creation and all assignments commit
  together. The form request ID makes an exact retry return the existing task;
  a conflicting retry fails.
- Existing event tasks keep their event, workplace and feature restrictions.
  General promotion work stays outside operational task counts and offline queues.
- Starting a Promotion assignment confirms its instructions and starts it in one
  transaction. Only the assignee with current portal access can do this.
- Editing a general task requires its current `updated_at` value. A stale save
  fails. Saving unchanged instructions preserves that version and existing evidence.
  Changed instructions clear confirmations, and the Promotion page offers
  confirmation again before allowing a new image upload.
- Private image evidence records a submission, not proof of social publication.
  An Admin must review it. A verified review completes the assignment atomically;
  evidence predating the current instructions cannot complete it.
- Assignment and change notifications link to the Promotion portal. Management
  forms return to their current Admin or Administration management route.
- NL, FR, EN and DE copy is included for creation, editing and feedback.

## Verification

`tests/sql/promotion-task-management.sql` executes the real database functions and
RLS with synthetic users in a transaction, then rolls everything back. It covers
creation, atomic assignment, retry conflicts, start, stale edits, confirmation,
revoked roles, blocked access, private RPC privileges and verified completion.

`scripts/promotion-task-workflow-e2e.mjs`, invoked by the existing Administration
browser workflow, exercises the mobile forms from creation through image upload
and Admin review. It also checks all four creation locales and forbidden employee
API calls. The full CI remains the release gate for this browser evidence.

The main-test database includes the three migration files in this bundle. Production
must receive the required platform migrations before a release; its existing
read-only deployment check now also requires `tasks.promotion_only`.
