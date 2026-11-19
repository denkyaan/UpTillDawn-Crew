# Strict 1:1 migration contract — UpTillDawn Main

## Non-negotiable scope
The purpose of the local-first / Vite / Hono migration is to reduce server load,
network requests and resource usage **without changing the application's design,
interaction patterns, behavior, routes or authorization**. The existing deployed
Next/OpenNext Main app is the source of truth; the separate modern Worker is a
development candidate, NOT an approved replacement or redesign.

### Preserve exactly
- Branding, logos, themes (including light/dark), colors, typography, spacing,
  cards, animations, icons, responsive breakpoints, navigation and screen layout.
- Desktop sidebar; mobile bottom bar, tabs and subtabs; header, badges, notifications,
  persistent portal choice, Maker/normal-app chooser, floating chat and AI controls.
- Role-specific visibility and two-role logic for Maker, head admin, left/right hand,
  responsible, staff, promotion and administration.
- All existing pages, forms, dialogs, interactive states, error/empty/loading states,
  validations, complete workflows, translations (NL/FR/EN/DE), accessibility,
  mobile keyboard behavior, offline/PWA and integrations.
- No extra duplicate buttons, pages, shortcuts or a new navigation hierarchy.
- All database RLS protections, audit trails and other authorization checks.

### Login and registration are also pixel- and behavior-locked
- The existing `app/(auth)/login/page.tsx` portal chooser, all five specific
  `/login/{staff,responsible,promotion,admin,administration}` pages and the
  shared `components/auth/login-form.tsx` are the authoritative baseline.
- Preserve the exact Up Till Dawn logo/image, black background, card dimensions,
  typography, colors, spacing, portal icons, hamburger portal menu, language
  selector, email/password fields, show/hide password, forgot-password link,
  register link, submit button, disabled/loading and error states.
- Preserve five portal identities, account approval, role denial, Maker/owner
  switcher, safe `next` return handling, session rehydration, audit/auth flows,
  rate limiting, error classifications, email verification, password recovery,
  registration and all localized messages. Do not silently replace the original
  role-specific login endpoint with bare `signInWithPassword`.
- Compare real browser screenshots against original Main login at desktop and
  mobile widths in all four languages, including open menu, focused inputs,
  password visible, loading, error and validation states.
- The separate modern app currently lacks this exact login screen and complete
  authentication behavior. Treat it as incomplete. Do not assert login parity
  or redirect the existing Main login to the new candidate yet.

### Implementation rule
**Reuse/extract the existing presentation and behavior as the migration source**.
Do not implement an unrelated lookalike UI in new components. Replace runtime,
network transport or backend mechanics behind the same user interface and public
contract, one verified module at a time. A static heading, placeholder, read-only
panel or a fallback link is never functional parity.

### Release acceptance (all mandatory, fail closed)
1. Obtain baseline screenshots and interaction traces from the existing Main app,
   using isolated QA identities and deterministic data. Compare the new candidate
   in matching viewport sizes and light/dark mode, each relevant role and four
   languages. Require matching layout, content, visual states and navigation;
   investigate every mismatch before marking it accepted.
2. Test every existing page, button, form and dialog with both successful and
   denied/error scenarios. Route and action coverage must be exhaustive, not a
   representative subset.
3. Check persistence, reloads, session switching, role permission isolation,
   tab/subtab navigation, offline replay, PWA, notifications, chat, timekeeping,
   inventory, finance, scanning and all configured-provider workflows end-to-end.
4. Compare live role-based network effects (including authorization and RLS)
   against the legacy app without making actual payment/provider calls in tests.
5. Validate 30 independent sessions and Cloudflare Free resource outcomes; no
   exceeded CPU/memory errors, no performance regressions.
6. Confirm rollback and preserve database/production separation. After full parity
   evidence, make the existing Main address use the new engine without changing
   the user-facing URL, visual design or functionality. Production needs separate
   explicit authorization.

### Current truth
The candidate in `modern/` has its own simplified styling, navigation and
screens. It is **NOT 1:1**, and its inventory intentionally reports zero
verified route/action parity. The isolated modern URL remains a QA surface, and
its successful smoke/auth/browser tests do not grant release readiness.

The original Main dashboard must not present the modern candidate as a new
application choice. A separate UX redesign has not been authorized.
