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

## Verified orphan cleanup — 10 November 2026

The retired Promotion/Administration guided-tour component is removed after the actual runtime import scan confirmed that it was not used. The workplace-specific tour button remains installed because `components/crew/workplace-shift-planner.tsx` actively imports and renders it. Removing it would break the working shift-planner UI.

The source-tree regression `tests/retired-tour-code-cleanup.test.mjs` rejects revived references to the orphaned portal tour, and positively verifies that active workplace guidance remains. Existing event preparation, briefing acknowledgements, operating procedures and help remain available.

No historical audit records, chat messages, notifications, credentials or real event data are deleted.
