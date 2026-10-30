# Administration navigation hotfix

Opening Tasks or Notifications previously redirected to the personnel/event routes. The existing task and notification workspaces now render inside administration. Finance, banking, documents, reports, rosters and contacts also keep their administration module URLs instead of losing the selected subtab.

The navigation matches the dashboard exactly and retains the selected category on nested pages. Server-provided language prevents hydration errors. Administration uses its own desktop navigation, header and contextual links; floating controls leave room for mobile subtabs. Shared profile, timesheet, notification and sales views retain the administration shell.

Existing Admin task controls are preserved. Administrative employees see their permitted assigned tasks without receiving Admin permissions. Denied or unavailable portal access shows an administration notice instead of silently sending the user to personnel. Authentication and database permission checks remain in place. This hotfix adds no database migrations or permission grants.

Local validation: 683 Node tests, typecheck, lint (zero errors, one existing worker warning) and the production Next.js build pass. CI exercises authenticated Admin and administrative-employee tab clicks on mobile and desktop, verifies in-portal denial for staff without administration access, and runs the existing 15-bot lifecycle suite before production deployment.
