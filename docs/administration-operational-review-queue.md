# Operational cases and deadlines — Administration review queue

## Fixed workflows

Administrative employees and Admin can create and edit operational dossiers
for logistics, permits and general tasks with an event association or without
one. Dossiers can be submitted, independently reviewed by an Admin, approved,
rejected with a reason, and then completed.

Previously the database allowed an Admin to approve or reject **their own
submitted dossier** and the Administration module loaded only the first
100 dossiers, hiding later deadlines. The new migration makes a distinct Admin
reviewer mandatory for the submitted-to-approved/rejected transitions.
The UI removes self-review buttons and rechecks the author on the server,
while the database trigger is authoritative against crafted requests.

The task, permits and logistics modules now have stable keyset-equivalent
offset pagination using `due_at,id` ordering, an exact row count, 50 records
per page and an indexed kind/status/due-date access path. The status filters
(open, submitted, approved, rejected, completed and cancelled) preserve
the selected filter across pagination and are localized to NL/FR/EN/DE.
The three dedicated Next.js page wrappers forward URL query parameters to the
shared server module, rather than silently dropping `page` and `status`.

## Transactional notifications

An AFTER UPDATE trigger runs only for an actual status transition:
- Open/rejected → submitted: approved, nonblocked Admin reviewers **other
  than the author** are notified.
- Submitted → approved/rejected: the author receives a decision notification.
- Approved → completed: the author is notified when another user completed it.

Notifications link to the exact Administration module. They are committed
in the same database transaction as the dossier change, and cannot be faked
by a failed attempt. The private notification trigger is not callable by
anonymous or authenticated users.

## Verification and limitations

- Fast PR CI runs source contract regressions and general frontend checks.
- `tests/sql/administration_operational_approval_queue.sql` validates
  PostgreSQL enforcement and installed trigger/index after migration.
- Manual main-test E2E still requires two distinct approved Admin accounts,
  a dedicated Administration user and disposable cases: create, edit, submit,
  deny own approval, approve/reject as second Admin, complete, page beyond
  100 records, filter and verify notifications.
- No live provider setup, OCR, Peppol dispatch or production deployment is
  implied by this queue completion.
