# Operational navigation and retired tour cleanup — main

The current grouped role navigation is the only active mobile bottom navigation.
The unreachable legacy tour/sandbox branch, tour query augmentation, training
session overrides and former compact fallback have been removed. No training
preview can override role visibility: features still require the configured role
and the active role UI visibility rules. This does not remove the operational
event preparation checklist or required briefing acknowledgements.

The mobile menu retains six contextual role categories and ranks permitted links inside each subtab group using assigned-event/active-shift context for Staff and Responsible. It preserves four locales, badge
counts, accessible subtab links, Escape-to-close, pathname-scoped collapse and
the navigation-expanded event that suppresses overlapping floating chat/AI
controls. Home on mobile and desktop now uses Next client routing to the
appropriate Staff or Admin dashboard; no document reload is required.

Verification: `tests/mobile-navigation-retired-tour-cleanup.test.mjs` and the
existing role, collapse, keyboard, AI overlay, label and route regression tests.
The responsive bottom bar retains a 56px minimum height as required by the existing mobile shell contract. All server-side role and event authorization remains unchanged.

Production deployment is intentionally out of scope.

## Complete guided-tour removal — 10 November 2026

The legacy Promotion/Administration guided tour was removed previously. The final workplace-specific guided-tour button is now removed from the shift planner along with its unused component, completing the requested retirement of optional step-by-step tours.

The planner continues to display and execute real shift confirmation, change requests, briefing and assigned-workplace workflows. Mandatory event preparation remains distinct from a guided tour and is preserved.

The repository-scanning regression `tests/retired-tour-code-cleanup.test.mjs` rejects reintroduced references to either retired tour and asserts that operational shift confirmation and shift-change controls still exist. No user, event, chat, payroll, inventory or other data was deleted.

Production deployment remains separately controlled.
