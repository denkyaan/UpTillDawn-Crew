# Operational navigation and retired tour cleanup — main

The current grouped role navigation is the only active mobile bottom navigation.
The unreachable legacy tour/sandbox branch, tour query augmentation, training
session overrides and former compact fallback have been removed. No training
preview can override role visibility: features still require the configured role
and the active role UI visibility rules. This does not remove the operational
event preparation checklist or required briefing acknowledgements.

The mobile menu retains six contextual role categories, four locales, badge
counts, accessible subtab links, Escape-to-close, pathname-scoped collapse and
the navigation-expanded event that suppresses overlapping floating chat/AI
controls. Home on mobile and desktop now uses Next client routing to the
appropriate Staff or Admin dashboard; no document reload is required.

Verification: `tests/mobile-navigation-retired-tour-cleanup.test.mjs` and the
existing role, collapse, keyboard, AI overlay, label and route regression tests.
Production deployment is intentionally out of scope.
