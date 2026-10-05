# First production use

This checklist is the canonical start path for the first real UpTillDawn Crew event.

## Clean starting state

- Training and guided tours use sandbox/session data and do not create production events, shifts, work hours or crew activity.
- Production starts without a real event. The admin dashboard shows the first-use checklist until the first event exists.
- New crew accounts require email verification and Admin approval.
- New approved personnel complete their required profile before the first role tour.
- The PWA install prompt is queued after registration and respects the device/browser install flow.

## First event

1. Open **Events** and create the first real event.
2. Confirm name, venue/address, start/end, registration deadline, capacity and GPS radius.
3. Event creation automatically prepares the standard workplace catalog:
   - Inkom & Guestlist
   - Merch
   - Bar/Toog
   - Tokens
   - Backstage Management
   - Driver
   - Allrounder
   - Opbouw
   - Afbouw
4. Open **Workplaces & Shifts** and assign the Responsible lead, crew, role and hours.
5. Complete briefing, operational checklist, inventory, price lists, guest list and event documents.
6. Approve real crew registrations and verify each person's role and workplace assignment.
7. Let crew complete profile onboarding and the role tour before live operation.
8. Run the event through check-in, work/break/Driver flows, tasks, incidents, inventory, guest list and chat.
9. After the event, review/lock timesheets, export hours, close the event and archive when ready.

## Release baseline before real use

The release gate must remain green for:

- dependency audit, lint and TypeScript;
- Node regression suite;
- Next.js and Cloudflare Worker builds;
- isolated Supabase replay from zero;
- all SQL regression suites;
- generated database type parity;
- 15 authenticated browser bots;
- Cloudflare deployment and public smoke checks.

## External infrastructure gates

These do not block the in-app first-use workflow but remain explicit infrastructure tasks:

1. Enable Supabase Auth leaked-password protection.
2. Complete a physical backup -> Restore to a New Project disaster-recovery proof. Do not restore over production for the test.
