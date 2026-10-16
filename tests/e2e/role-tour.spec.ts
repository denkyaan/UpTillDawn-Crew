import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
const roles = ['ADMIN', 'RESPONSIBLE', 'STAFF'] as const;

import { getTourChapters, tourBaseRoute, type TourRole, type TourLocale } from '../../lib/tour-training';

test.describe('Role-specific tour chapter matrix (all locales)', () => {
  const locales: TourLocale[] = ['nl', 'fr', 'en', 'de'];
  const roleCases: TourRole[] = ['admin', 'responsible_lead', 'employee'];
  for (const role of roleCases) {
    test(`${role}: every chapter has translated instructions and safe role-scoped routes`, () => {
      const chapters = getTourChapters(role, { mode: 'full', scope: 'general' });
      expect(chapters.length).toBeGreaterThanOrEqual(role === 'admin' ? 14 : 10);
      expect(new Set(chapters.map(chapter => chapter.key)).size).toBe(chapters.length);
      for (const chapter of chapters) {
        expect(chapter.roles).toContain(role);
        expect(tourBaseRoute(role, chapter).startsWith('/')).toBe(true);
        expect(tourBaseRoute(role, chapter).startsWith('//')).toBe(false);
        expect(chapter.mobileSelector.trim()).not.toBe('');
        expect(chapter.desktopSelector.trim()).not.toBe('');
        for (const locale of locales) {
          expect(chapter.title[locale]?.trim(), `${role}/${chapter.key}/${locale}: title`).not.toBe('');
          expect(chapter.description[locale]?.trim(), `${role}/${chapter.key}/${locale}: instructions`).not.toBe('');
        }
      }
      const keys = chapters.map(chapter => chapter.key);
      for (const key of ['overview', 'events', 'workplaces', 'briefings', 'operations', 'tasks', 'incidents', 'inventory', 'chat', 'settings']) {
        expect(keys, `${role}: missing essential workflow chapter ${key}`).toContain(key);
      }
      if (role === 'admin') {
        for (const key of ['sales', 'personnel', 'exports', 'platform']) expect(keys).toContain(key);
      } else {
        for (const key of ['sales', 'personnel', 'exports', 'platform']) expect(keys).not.toContain(key);
      }
    });
  }
});

// Separate per-locale cases ensure that one missing translation is reported
// against the exact role and locale instead of being hidden in a shared case.
// These are static chapter-contract checks, not substitutes for browser E2E.
test.describe('Complete chapter contracts by role and locale', () => {
  const locales: TourLocale[] = ['nl', 'fr', 'en', 'de'];
  const roleCases: TourRole[] = ['admin', 'responsible_lead', 'employee'];
  for (const role of roleCases) {
    for (const locale of locales) {
      test(`${role}/${locale}: every chapter has complete instructional content`, () => {
        const chapters = getTourChapters(role, { mode: 'full', scope: 'general' });
        expect(chapters.length).toBeGreaterThan(0);
        for (const [index, chapter] of chapters.entries()) {
          expect(chapter.title[locale]?.trim(), `${role}/${locale}/${chapter.key}: missing title`).toBeTruthy();
          expect(chapter.description[locale]?.trim(), `${role}/${locale}/${chapter.key}: missing guidance`).toBeTruthy();
          expect(chapter.desktopSelector.trim(), `${role}/${locale}/${chapter.key}: missing desktop target`).toBeTruthy();
          expect(chapter.mobileSelector.trim(), `${role}/${locale}/${chapter.key}: missing mobile target`).toBeTruthy();
          const route = tourBaseRoute(role, chapter);
          expect(route, `${role}/${locale}/${chapter.key}: invalid route`).toMatch(/^\/(?!\/)/);
          expect(chapter.roles, `${role}/${locale}/${chapter.key}: role leakage`).toContain(role);
          expect(chapters.findIndex(item => item.key === chapter.key), `${role}/${locale}/${chapter.key}: duplicate chapter`).toBe(index);
        }
      });
    }
  }
});

// Workplace-specific tours are separate from the general first-use tour.
// Verify their inclusion rules for every role; this is contract coverage,
// not a claim that the workplace exercises were performed in a browser.
test.describe('Workplace tour scope and new-chapter contracts', () => {
  const roleCases: TourRole[] = ['admin', 'responsible_lead', 'employee'];
  for (const role of roleCases) {
    test(`${role}: driver, entrance and new-mode chapter scope`, () => {
      const general = getTourChapters(role, { mode: 'full', scope: 'general' });
      const workplace = getTourChapters(role, { mode: 'full', scope: 'workplace', driver: true, entrance: true });
      const recent = getTourChapters(role, { mode: 'new', scope: 'workplace', driver: true, entrance: true });
      const generalKeys = new Set(general.map(chapter => chapter.key));
      const workplaceKeys = new Set(workplace.map(chapter => chapter.key));
      expect(workplaceKeys.size).toBe(workplace.length);
      for (const chapter of general) {
        expect(chapter.requires, `${role}/${chapter.key}: workplace-only chapter leaked into general tour`).toBeUndefined();
        expect(workplaceKeys.has(chapter.key), `${role}/${chapter.key}: general chapter missing from full workplace scope`).toBe(true);
      }
      for (const chapter of workplace) {
        expect(chapter.roles).toContain(role);
        expect(tourBaseRoute(role, chapter).startsWith('/')).toBe(true);
        expect(tourBaseRoute(role, chapter).startsWith('//')).toBe(false);
        if (chapter.requires) expect(generalKeys.has(chapter.key), `${role}/${chapter.key}: required chapter leaked into general scope`).toBe(false);
      }
      for (const chapter of recent) {
        expect(chapter.newSince, `${role}/${chapter.key}: old chapter included in new-only tour`).toBe(8);
        expect(workplaceKeys.has(chapter.key)).toBe(true);
      }
      const withoutAssignments = getTourChapters(role, { mode: 'full', scope: 'workplace' });
      expect(withoutAssignments.some(chapter => chapter.requires === 'driver')).toBe(false);
      expect(withoutAssignments.some(chapter => chapter.requires === 'entrance' && role !== 'admin')).toBe(false);
      if (role === 'admin') {
        expect(workplaceKeys.has('driver')).toBe(false);
      } else {
        expect(workplaceKeys.has('driver')).toBe(true);
      }
    });
  }
});

test.describe('UpTillDawn role-tour browser validation', () => {
  test.setTimeout(120_000);
  for (const role of roles) {
    test(role + ' authenticated tour inspection', async ({ page }, testInfo) => {
      test.skip(!baseURL, 'E2E_BASE_URL must target an isolated staging deployment');
      const email = process.env[`E2E_${role}_EMAIL`];
      const password = process.env[`E2E_${role}_PASSWORD`];
      test.skip(!email || !password, `Missing isolated ${role} test credentials`);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      page.on('console', message => { if (message.type() === 'error') console.log(`[${role}] console error: ${message.text()}`); });
      const serverFailures: Array<{ path: string; status: number; method: string }> = [];
      page.on('response', response => {
        if (response.status() < 500) return;
        const url = new URL(response.url());
        if (url.origin !== new URL(baseURL!).origin) return;
        serverFailures.push({ path: url.pathname, status: response.status(), method: response.request().method() });
      });
      page.on('requestfailed', request => console.log(`[${role}] failed request: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
      await page.goto(new URL('/login/' + role.toLowerCase(), baseURL!).toString(), { waitUntil: 'domcontentloaded' });
      console.log(`[${role}] Login URL: ${page.url()}`);
      const inlineScripts = await page.locator('script:not([src])').allTextContents();
      const helperPresent = inlineScripts.some(source => source.includes('globalThis.__name'));
      console.log('STAGING_THEME_HELPER_PRESENT=' + helperPresent);
      expect(helperPresent, 'Staging does not include the updated theme bootstrap; deploy test branch before running E2E').toBe(true);
      const suspectScripts = inlineScripts.filter(source => source.includes('__name'));
      for (const [index, source] of suspectScripts.entries()) {
        console.error(`[${role}] inline script using __name (${index + 1}/${suspectScripts.length}):\n${source.slice(0, 4500)}`);
      }
      if (suspectScripts.length) {
        await testInfo.attach(`${role.toLowerCase()}-inline-scripts.txt`, { body: suspectScripts.join('\n\n-----\n\n'), contentType: 'text/plain' });
      }
      await expect(page.locator('body')).toBeVisible();
      const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
      const passwordInput = page.locator('input[type="password"]');
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      // Wait for client hydration to settle before filling React-controlled inputs.
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await emailInput.fill(email!);
      await passwordInput.fill(password!);
      await expect(passwordInput).toHaveValue(password!);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-login.png`), fullPage: true });
      const submit = page.getByRole('button', { name: /inloggen|login|sign in|connexion|anmelden/i });
      await expect(submit).toBeVisible();
      // Capture only role diagnostics and HTTP error codes; never log tokens, profile IDs or PII.
      const roleRpcDiagnostics: Array<{ rpc: string; status: number; role?: string; errorCode?: string }> = [];
      page.on('response', async response => {
        const match = new URL(response.url()).pathname.match(/\/rest\/v1\/rpc\/(upt_current_profile|upt_current_effective_role|upt_current_is_owner)$/);
        if (!match) return;
        const item: { rpc: string; status: number; role?: string; errorCode?: string } = { rpc: match[1], status: response.status() };
        try {
          const payload = await response.json();
          if (response.status() >= 400) {
            item.errorCode = String(payload?.code ?? payload?.error_code ?? 'HTTP_ERROR').slice(0, 80);
          } else if (match[1] === 'upt_current_profile') {
            const raw = Array.isArray(payload) ? payload[0]?.role : payload?.role;
            if (['staff', 'responsible_lead', 'admin'].includes(raw)) item.role = raw;
          } else if (match[1] === 'upt_current_effective_role' && ['staff', 'employee', 'responsible_lead', 'admin'].includes(payload)) {
            item.role = payload;
          } else if (match[1] === 'upt_current_is_owner' && typeof payload === 'boolean') {
            item.role = payload ? 'owner' : 'not_owner';
          }
        } catch { if (response.status() >= 400) item.errorCode = 'UNREADABLE_RESPONSE'; }
        roleRpcDiagnostics.push(item);
      });
      const authResponses: Array<{ status: number; url: string; error?: string }> = [];
      const formPosts: Array<{ status: number; path: string; nextAction: boolean }> = [];
      page.on('response', async response => {
        const url = response.url();
        if (response.request().method() === 'POST' && new URL(url).origin === new URL(baseURL!).origin) {
          formPosts.push({ status: response.status(), path: new URL(url).pathname, nextAction: Boolean(response.request().headers()['next-action']) });
        }
        if (!/\/auth\/v1\/(token|user|verify|otp)|\/api\/auth\//i.test(url)) return;
        const record: { status: number; url: string; error?: string } = { status: response.status(), url: url.replace(/([?&](?:token|access_token|refresh_token|code|apikey)=)[^&]+/gi, '$1[REDACTED]') };
        if (response.status() >= 400) {
          try {
            const data = await response.json();
            record.error = String(data?.error_code || data?.code || data?.error || data?.msg || 'HTTP error').slice(0, 180);
          } catch { record.error = 'HTTP error (non-JSON response)'; }
        }
        authResponses.push(record);
      });
      // React hydration can replace controlled inputs after an early fill; assert again immediately before submission.
      await expect(emailInput).toHaveValue(email!);
      if (await passwordInput.inputValue() !== password!) {
        console.log(`[${role}] Password input was reset before submit; refilling after hydration`);
        await passwordInput.fill(password!);
      }
      await expect(passwordInput).toHaveValue(password!);
      const formStateBeforeSubmit = await page.locator('form').first().evaluate(form => ({ actionPath: new URL((form as HTMLFormElement).action).pathname, method: (form as HTMLFormElement).method, hasSubmitHandler: true, emailPresent: Boolean((form as HTMLFormElement).querySelector('[name="email"]')), passwordPresent: Boolean((form as HTMLFormElement).querySelector('[name="password"]')) }));
      console.log(`[${role}] Form structure: ${JSON.stringify(formStateBeforeSubmit)}`);
      const loginSubmitState = await submit.evaluate(button => ({
        disabled: (button as HTMLButtonElement).disabled,
        formValid: (button as HTMLButtonElement).form?.checkValidity() ?? null,
        type: (button as HTMLButtonElement).type,
        html: button.outerHTML.slice(0, 500),
      }));
      console.log(`[${role}] Submit state: ${JSON.stringify(loginSubmitState)}`);
      await submit.click();
      // Some staging pages hydrate after the initial click. Retry the real submit once
      // only if there was no navigation and no same-origin POST at all.
      await page.waitForTimeout(1500);
      if (new URL(page.url()).pathname.startsWith('/login/') && formPosts.length === 0) {
        console.log(`[${role}] No form POST after initial click; retrying submit after hydration`);
        await expect(emailInput).toHaveValue(email!);
        await passwordInput.fill(password!);
        await page.locator('form').first().evaluate(form => (form as HTMLFormElement).requestSubmit());
      }
      // The login form can unmount immediately after a successful redirect.
      // Never await a locator on the old login page after submission.
      console.log(`[${role}] Post-click URL: ${page.url()}`);
      // The admin login uses a document navigation via /api/auth/admin-login.
      // Inspecting body before that navigation settles races the old document
      // being destroyed and causes a false timeout.
      await page.waitForURL(url => !url.pathname.startsWith('/api/auth/'), {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }).catch(() => {});
      await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('body')).not.toContainText(/invalid login credentials|ongeldige inloggegevens/i);
      try {
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).not.toMatch(/^\/login\//);
      } catch (error) {
        const visibleAlert = await page.locator('[role="alert"], [aria-live="assertive"], [data-sonner-toast]').allTextContents().catch(() => []);
        const inputState = await page.locator('input[type="email"], input[type="password"]').evaluateAll(inputs => inputs.map(input => ({ type: (input as HTMLInputElement).type, valid: (input as HTMLInputElement).validity.valid, validationMessage: (input as HTMLInputElement).validationMessage })));
        const diagnostic = { role, currentPath: new URL(page.url()).pathname, authResponses, formPosts, loginSubmitState, visibleAlert: visibleAlert.map(t => t.slice(0, 250)), inputState, serverFailures };
        console.error(`[${role}] Login diagnostic: ${JSON.stringify(diagnostic)}`);
        await testInfo.attach(`${role.toLowerCase()}-login-diagnostic.json`, { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' });
        await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-login-failure.png`), fullPage: true });
        throw error;
      }
      const authenticatedPath = new URL(page.url()).pathname;
      console.log(`[${role}] Authenticated landing path: ${authenticatedPath}`);
      // Wait for the client-side role navigation to hydrate before taking inventory.
      await expect.poll(async () => page.locator('nav a[href], [role="navigation"] a[href], aside a[href]').count(), { timeout: 15000 }).toBeGreaterThan(0);
      const navigation = await page.locator('nav a, [role="navigation"] a, aside a').evaluateAll(links => links.map(link => ({ text: (link.textContent || '').trim().slice(0, 100), href: (link as HTMLAnchorElement).getAttribute('href') })).filter(link => link.text || link.href));
      console.log(`[${role}] Navigation inventory: ${JSON.stringify(navigation)}`);
      await testInfo.attach(`${role.toLowerCase()}-navigation.json`, { body: JSON.stringify({ role, authenticatedPath, navigation }, null, 2), contentType: 'application/json' });
      await expect(page.locator('body')).toBeVisible();
      // Navigation links can be absent on the Admin landing page because
      // functional tabs are rendered by the role UI rather than as nav anchors.
      // Record this limitation instead of asserting a fabricated link exists.
      const functionalLinks = navigation.filter(item => {
        if (!item.href?.startsWith('/') || item.href.startsWith('//')) return false;
        const pathname = new URL(item.href, baseURL!).pathname;
        return pathname !== '/' && pathname !== authenticatedPath &&
          !['login', 'logout', 'signup', 'auth'].includes(pathname.split('/')[1]);
      });
      const linkAudit = { role, authenticatedPath, functionalLinks, linkNavigationCovered: functionalLinks.length > 0 };
      await testInfo.attach(`${role.toLowerCase()}-functional-navigation-coverage.json`, {
        body: JSON.stringify(linkAudit, null, 2), contentType: 'application/json',
      });
      console.log(`[${role}] Functional anchor navigation coverage: ${JSON.stringify(linkAudit)}`);
      if (functionalLinks.length > 0) {
        const clickTarget = functionalLinks[0];
        const targetPath = new URL(clickTarget.href!, baseURL!).pathname;
        const actualLink = page.locator('nav a[href], [role="navigation"] a[href], aside a[href]')
          .filter({ visible: true }).filter({ hasText: clickTarget.text }).first();
        await expect(actualLink, `${role}: visible functional navigation link missing`).toBeVisible({ timeout: 10000 });
        await actualLink.click({ timeout: 10000 });
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(targetPath);
      }
      // Role-specific training entrypoint: validate the actual chapters and start control.
      // A client-side redirect or outstanding prefetch may abort a navigation even
      // when the destination loads correctly. Recover once on a fresh page.
      let trainingResponse: Awaited<ReturnType<typeof page.goto>> = null;
      try {
        trainingResponse = await page.goto(new URL('/help', baseURL!).toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (error) {
        if (!String(error).includes('ERR_ABORTED')) throw error;
        console.log(`[${role}] /help navigation aborted; retrying in a fresh page`);
        const retryPage = await page.context().newPage();
        try {
          const retryResponse = await retryPage.goto(new URL('/help', baseURL!).toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
          await expect(retryPage.locator('main')).toBeVisible();
          await page.goto(new URL('/help', baseURL!).toString(), { waitUntil: 'commit', timeout: 20000 }).catch(() => null);
          trainingResponse = retryResponse;
        } finally {
          await retryPage.close();
        }
      }
      await expect(page.locator('main')).toBeVisible();
      const trainingHeading = page.getByRole('heading', { name: /interactieve opleiding|interactive training|formation interactive|interaktives training/i });
      try {
        await expect(trainingHeading).toBeVisible({ timeout: 20000 });
      } catch (error) {
        const diagnostic = { role, path: new URL(page.url()).pathname, headings: await page.getByRole('heading').allTextContents().catch(() => []), mainVisible: await page.locator('main').isVisible().catch(() => false), rpc: roleRpcDiagnostics };
        console.error(`[${role}] Training render diagnostic: ${JSON.stringify(diagnostic)}`);
        await testInfo.attach(`${role.toLowerCase()}-training-render.json`, { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' });
        throw error;
      }
      if (role === 'ADMIN') {
        const switchToAdmin = page.getByRole('button', { name: /admin-rondleiding openen|open admin tour|ouvrir la visite admin|admin-tour öffnen/i });
        if (await switchToAdmin.isVisible().catch(() => false)) {
          await switchToAdmin.click();
          await expect(switchToAdmin).toBeHidden({ timeout: 15000 });
        }
      }
      // Record the effective role and whether the staging deployment exposes
      // the admin-role switch. This distinguishes a stale deployment from a
      // test account that is genuinely in staff/responsible preview mode.
      const roleHeading = await page.locator('main section').first().locator('h2').first().textContent().catch(() => null);
      const adminSwitchVisible = await page.getByRole('button', { name: /admin-rondleiding openen|open admin tour|ouvrir la visite admin|admin-tour öffnen/i }).isVisible().catch(() => false);
      console.log(`[${role}] Training role heading: ${JSON.stringify(roleHeading)}; admin switch visible: ${adminSwitchVisible}`);
      console.log(`[${role}] Safe Supabase role RPC diagnostic: ${JSON.stringify(roleRpcDiagnostics)}`);
      await testInfo.attach(`${role.toLowerCase()}-role-rpc-diagnostic.json`, { body: JSON.stringify({ expectedRole: role, rpc: roleRpcDiagnostics }, null, 2), contentType: 'application/json' });
      if (role === 'RESPONSIBLE' && !/verantwoordelijke|responsible|responsable|verantwortlich/i.test(roleHeading || '')) {
        throw new Error(`Responsible credentials are rendering ${JSON.stringify(roleHeading)} training on staging. Verify the account's effective role and staging deployment.`);
      }
      if (role === 'ADMIN' && !/admin/i.test(roleHeading || '')) {
        throw new Error(`Admin credentials are rendering ${JSON.stringify(roleHeading)} training on staging; admin switch visible=${adminSwitchVisible}. Verify staging deployment and effective role before checking chapters.`);
      }
      const chapters = page.locator('main section').filter({ has: page.getByRole('heading', { name: /hoofdstukken|chapters|chapitres|kapitel/i }) }).locator('button');
      const chapterNames = await chapters.allTextContents();
      expect(chapterNames.length, `${role}: role-specific training has no chapters`).toBeGreaterThan(0);
      // A successful render is not sufficient: admin must receive admin-only chapters,
      // while staff and responsible must not see privileged training chapters.
      const chapterText = chapterNames.join(' ').toLowerCase();
      if (role === 'ADMIN') {
        expect(chapterText, 'Admin tour missing Sales chapter').toMatch(/sales|ventes|verkauf/);
        expect(chapterText, 'Admin tour missing Approvals chapter').toMatch(/goedkeuringen|approvals|approbations|genehmigungen/);
        expect(chapterText, 'Admin tour missing Platform chapter').toMatch(/platformbeheer|platform management|gestion de la plateforme|plattformverwaltung/);
      } else {
        expect(chapterText, `${role} must not receive Sales training`).not.toMatch(/sales|ventes|verkauf/);
        expect(chapterText, `${role} must not receive Approvals training`).not.toMatch(/goedkeuringen|approvals|approbations|genehmigungen/);
      }

      console.log(`[${role}] Tour chapter inventory (${chapterNames.length}): ${JSON.stringify(chapterNames)}`);
      await testInfo.attach(`${role.toLowerCase()}-tour-chapters.json`, { body: JSON.stringify({ role, trainingStatus: trainingResponse?.status(), chapters: chapterNames }, null, 2), contentType: 'application/json' });
      // Onboarding may mount after the tour index becomes visible. Handle any
      // first-login modal both before the click and if it arrives during actionability.
      const acknowledgeWelcome = async () => {
        const welcome = page.locator('[role="dialog"][aria-modal="true"], [role="alertdialog"]').filter({ hasText: /je profiel is opgeslagen|your profile has been saved|votre profil a été enregistré|dein profil wurde gespeichert/i }).first();
        if (!(await welcome.isVisible().catch(() => false))) return false;
        const dialogText = (await welcome.innerText().catch(() => '')).slice(0, 500);
        const buttons = await welcome.getByRole('button').allTextContents();
        console.log(`[${role}] Welcome dialog: ${JSON.stringify({ text: dialogText, buttons })}`);
        await testInfo.attach(`${role.toLowerCase()}-onboarding-dialog.json`, { body: JSON.stringify({ role, text: dialogText, buttons }, null, 2), contentType: 'application/json' });
        const proceed = welcome.getByRole('button', { name: /start rondleiding|start tour|commencer la visite|rundgang starten/i }).first();
        const beginTraining = page.getByRole('dialog').getByRole('button', { name: /start training|commencer la formation|training starten/i }).first();
        if (await proceed.isVisible().catch(() => false)) {
          await proceed.click({ timeout: 8000, noWaitAfter: true });
        } else {
          console.log(`[${role}] Welcome already at START TRAINING stage`);
        }
        await expect(beginTraining).toBeVisible({ timeout: 10000 });
        await beginTraining.click({ timeout: 8000, noWaitAfter: true });
        await expect(beginTraining).toBeHidden({ timeout: 10000 });
        console.log(`[${role}] Dialogs after welcome: ${JSON.stringify((await page.locator('[role="dialog"]').allInnerTexts()).map(t => t.slice(0, 300)))}`);
        return true;
      };
      const trainingStartedByWelcome = await acknowledgeWelcome();
      const startTour = page.getByRole('button', { name: /rondleiding starten|start tour|commencer la visite|rundgang starten|hervatten|resume|reprendre|fortsetzen/i });
      if (!trainingStartedByWelcome) await expect(startTour).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-training-index.png`), fullPage: true });
      // A visible button can still be disabled or covered. Capture actionability before a bounded click.
      const startState = trainingStartedByWelcome ? { alreadyStarted: true } : await startTour.evaluate(button => {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(centerX, centerY);
        return { disabled: (button as HTMLButtonElement).disabled, ariaDisabled: button.getAttribute('aria-disabled'), text: (button.textContent || '').trim().slice(0, 160), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, centerHitTag: hit?.tagName ?? null, centerHitText: (hit?.textContent || '').trim().slice(0, 160), covered: Boolean(hit && !button.contains(hit) && hit !== button) };
      });
      console.log(`[${role}] Tour start actionability: ${JSON.stringify(startState)}`);
      await testInfo.attach(`${role.toLowerCase()}-start-actionability.json`, { body: JSON.stringify(startState, null, 2), contentType: 'application/json' });
      if (!trainingStartedByWelcome) try {
        // Next.js navigation can keep Playwright's click navigation wait pending even
        // after the browser dispatched the click. Separate dispatch from outcome.
        // A late-mounted welcome dialog can intercept the pointer after our
        // first hit test. Retry only when a real onboarding dialog is observed.
        try {
          await startTour.click({ timeout: 3500, noWaitAfter: true });
        } catch (firstError) {
          const handled = await acknowledgeWelcome();
          if (!handled) throw firstError;
          if (!handled && await startTour.isVisible().catch(() => false)) {
            await startTour.click({ timeout: 8000, noWaitAfter: true });
          }
        }
      } catch (error) {
        console.error(`[${role}] Tour start click failed: ${String(error).slice(0, 1200)}`);
        await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-start-click-failure.png`), fullPage: false, timeout: 5000 }).catch(() => {});
        throw error;
      }
      // The index START TOUR may open a first-login welcome dialog asynchronously.
      // Complete the real two-stage onboarding flow instead of waiting for a
      // controller while two modal dialogs still block the app.
      if (!(await page.locator('[data-tour-panel]').isVisible().catch(() => false))) {
        const welcomeDialogs = page.locator('[role="dialog"][aria-modal="true"], [role="alertdialog"]').filter({
          hasText: /je profiel is opgeslagen|your profile has been saved|votre profil a été enregistré|dein profil wurde gespeichert/i,
        });
        if (await welcomeDialogs.count()) {
          console.log(`[${role}] Completing delayed first-login welcome after index start`);
          await acknowledgeWelcome();
        }
      }
      await page.waitForTimeout(600);
      const afterStart = {
        path: new URL(page.url()).pathname,
        heading: await page.getByRole('heading').allTextContents().catch(() => []),
        startVisible: await startTour.isVisible().catch(() => false),
        bodyText: (await page.locator('main').innerText().catch(() => '')).slice(0, 1200)
      };
      console.log(`[${role}] Tour start outcome: ${JSON.stringify(afterStart)}`);
      await testInfo.attach(`${role.toLowerCase()}-start-outcome.json`, { body: JSON.stringify(afterStart, null, 2), contentType: 'application/json' });
      // Verify that starting the tour actually mounted the interactive controller,
      // not merely that the help-page button disappeared.
      const tourPanel = page.locator('[data-tour-panel]');
      try {
        await expect(tourPanel, `${role}: active interactive tour controller missing`).toBeVisible({ timeout: 15000 });
      } catch (error) {
        // A route transition can unmount RoleAppTour after the start click.
        // Capture the session state before testing the existing restore path.
        const diagnostic = await page.evaluate(() => ({
          path: location.pathname,
          activeSession: sessionStorage.getItem('uptilldawn-tour-active-v8'),
          previewRoute: sessionStorage.getItem('uptilldawn-tour-preview-route'),
          dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(node => (node.textContent || '').slice(0, 200)),
          tourPanelCount: document.querySelectorAll('[data-tour-panel]').length,
        }));
        console.error(`[${role}] Missing tour panel diagnostic: ${JSON.stringify(diagnostic)}`);
        await testInfo.attach(`${role.toLowerCase()}-tour-activation-failure.json`, {
          body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json',
        });
        await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-missing-tour-panel.png`), fullPage: true }).catch(() => {});
        if (!diagnostic.activeSession) throw error;
        // Restore an already active training session after the app route changes;
        // do not invent session state or falsely mark a tour as started.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(tourPanel, `${role}: persisted tour session did not restore after reload`).toBeVisible({ timeout: 15000 });
      }
      const progressLabel = (await tourPanel.innerText()).trim();
      expect(progressLabel, `${role}: tour progress counter missing`).toMatch(/\b1\/\d+\b/);
      console.log(`[${role}] Active tour progress: ${progressLabel}`);
      await testInfo.attach(`${role.toLowerCase()}-active-tour.json`, {
        body: JSON.stringify({ role, progressLabel, path: new URL(page.url()).pathname }, null, 2),
        contentType: 'application/json',
      });
      // Assert the actual first chapter target is present and visibly highlighted.
      // This checks the rendered UI instead of simulating a tour-completion event.
      const firstChapter = getTourChapters(
        role === 'ADMIN' ? 'admin' : role === 'RESPONSIBLE' ? 'responsible_lead' : 'employee',
        { mode: 'full', scope: 'general' }
      )[0];
      const targetSelector = testInfo.project.use.viewport?.width && testInfo.project.use.viewport.width < 1024
        ? firstChapter.mobileSelector : firstChapter.desktopSelector;
      const tourTarget = page.locator(targetSelector).first();
      await expect(tourTarget, `${role}: first training chapter target missing`).toBeVisible({ timeout: 10000 });
      const targetBounds = await tourTarget.boundingBox();
      expect(targetBounds, `${role}: first training target has no visible bounds`).not.toBeNull();
      expect(targetBounds!.width).toBeGreaterThan(0);
      expect(targetBounds!.height).toBeGreaterThan(0);
      const highlight = page.locator('div[aria-hidden="true"].fixed.border-violet-400');
      await expect(highlight, `${role}: purple target highlight missing`).toBeVisible({ timeout: 10000 });
      const highlightBounds = await highlight.boundingBox();
      expect(highlightBounds, `${role}: highlight has no bounds`).not.toBeNull();
      expect(highlightBounds!.width).toBeGreaterThan(0);
      expect(highlightBounds!.height).toBeGreaterThan(0);
      await testInfo.attach(`${role.toLowerCase()}-target-highlight.json`, {
        body: JSON.stringify({ role, chapter: firstChapter.key, targetSelector, targetBounds, highlightBounds }, null, 2),
        contentType: 'application/json',
      });
      // Execute the actual sandbox overview CTA for crew roles and require a
      // real chapter transition. Do not dispatch synthetic training events.
      if (role !== 'ADMIN') {
        const overviewAction = page.getByRole('button', {
          name: /view the demo event|bekijk het demo.event|voir l'événement démo|demo.event ansehen/i,
        }).first();
        await expect(overviewAction, `${role}: overview demo action missing`).toBeVisible({ timeout: 10000 });
        const blockingDialog = page.locator('[role="dialog"][aria-modal="true"]:visible');
        const dialogState = await blockingDialog.allTextContents();
        const firstActionBefore = await page.evaluate(() => ({
          path: location.pathname,
          workflow: sessionStorage.getItem('uptilldawn-training-workflow-v3'),
          activeSession: sessionStorage.getItem('uptilldawn-tour-active-v8'),
        }));
        if (dialogState.length) {
          await testInfo.attach(`${role.toLowerCase()}-blocking-dialog.json`, {
            body: JSON.stringify({ role, dialogState, firstActionBefore }, null, 2),
            contentType: 'application/json',
          });
          // The first-login welcome can mount *after* the tour panel appears.
          // Finish that real two-step onboarding UI before interacting with the
          // sandbox. Never bypass an unknown dialog or force a covered click.
          const knownWelcome = dialogState.every(text =>
            /je profiel is opgeslagen|your profile has been saved|votre profil a été enregistré|dein profil wurde gespeichert/i.test(text)
          );
          if (!knownWelcome || !(await acknowledgeWelcome())) {
            throw new Error(`${role}: unexpected blocking dialog before first action; see blocking-dialog artifact`);
          }
          await expect(blockingDialog, `${role}: welcome dialog did not close`).toHaveCount(0, { timeout: 10000 });
          await expect(tourPanel, `${role}: tour controller missing after welcome`).toBeVisible({ timeout: 15000 });
        }
        // Observe genuine application events only; do not emit or fabricate them.
        await page.evaluate(() => {
          const win = window as typeof window & { __tourActionEvents?: Array<{ type: string; detail: unknown; path: string }> };
          win.__tourActionEvents = [];
          for (const type of ['uptilldawn-training-nav-target', 'uptilldawn-training-completed']) {
            window.addEventListener(type, (event) => {
              win.__tourActionEvents?.push({
                type,
                detail: (event as CustomEvent).detail ?? null,
                path: location.pathname,
              });
            });
          }
        });
        await overviewAction.click({ timeout: 10000 });
        try {
          // Staging intentionally requires manual navigation after completing an
          // exercise. Clicking the CTA alone must not advance the chapter.
          await expect.poll(async () => page.evaluate(() => {
            try { return JSON.parse(sessionStorage.getItem('uptilldawn-training-workflow-v3') || '{}').navTarget; }
            catch { return null; }
          }), { timeout: 10000 }).toBe('events');
          await expect(tourPanel, `${role}: chapter advanced without manual navigation`).toContainText('1/11');
          const manualHint = page.getByRole('status').filter({
            hasText: /open (zelf )?de gemarkeerde navigatietab|open the highlighted navigation tab|ouvrez vous-même l.onglet|öffne selbst den hervorgehobenen/i,
          });
          await expect(manualHint, `${role}: manual navigation instruction missing`).toBeVisible({ timeout: 10000 });
          const eventsLink = page.locator('a[href]').filter({
            hasText: /evenementen|events|événements|veranstaltungen/i,
          }).filter({ visible: true }).first();
          await expect(eventsLink, `${role}: events navigation link missing`).toBeVisible({ timeout: 10000 });
          await eventsLink.click({ timeout: 10000 });
          await expect(tourPanel, `${role}: manually opening Events did not advance tour`).toContainText('2/11', { timeout: 15000 });
        } catch (error) {
          const after = await page.evaluate(() => ({
            path: location.pathname,
            workflow: sessionStorage.getItem('uptilldawn-training-workflow-v3'),
            activeSession: sessionStorage.getItem('uptilldawn-tour-active-v8'),
            progress: Object.entries(localStorage).filter(([key]) => key.startsWith('uptilldawn-tour-progress:')),
            dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(node => (node.textContent || '').slice(0, 500)),
            tourActionEvents: (window as typeof window & { __tourActionEvents?: unknown[] }).__tourActionEvents ?? [],
            tourController: {
              panelCount: document.querySelectorAll('[data-tour-panel]').length,
              currentText: document.querySelector('[data-tour-panel]')?.textContent?.trim() ?? null,
              activeSession: sessionStorage.getItem('uptilldawn-tour-active-v8'),
            },
            demoButtons: Array.from(document.querySelectorAll('[data-tour-demo="primary-action"]')).map(node => ({ text: node.textContent?.trim(), html: node.outerHTML.slice(0, 500) })),
          }));
          await testInfo.attach(`${role.toLowerCase()}-first-action-failure.json`, {
            body: JSON.stringify({ role, before: firstActionBefore, after }, null, 2),
            contentType: 'application/json',
          });
          console.error(`[${role}] FIRST_ACTION_FAILURE ${JSON.stringify({ before: firstActionBefore, after })}`);
          console.error(`[${role}] STAGING_CONTROLLER_CHECK: real event emitted=${after.tourActionEvents.some((event: { type: string }) => event.type === 'uptilldawn-training-nav-target')}; active chapter=${after.tourController.currentText}; persisted progress=${JSON.stringify(after.progress)}. A test-branch merge does not deploy application code to E2E_BASE_URL.`);
          throw error;
        }
        await testInfo.attach(`${role.toLowerCase()}-first-action-transition.json`, {
          body: JSON.stringify({ role, action: 'overview demo event', progress: (await tourPanel.innerText()).trim(), path: new URL(page.url()).pathname }, null, 2),
          contentType: 'application/json',
        });
      }
      // Exercise a real interactive tour control rather than only inspecting its presence.
      // Pausing is non-destructive and must clear the active session for every role.
      const pauseButton = tourPanel.getByRole('button', { name: /pauzeer|pause|pausieren/i });
      await expect(pauseButton, `${role}: pause control missing`).toBeVisible();
      await pauseButton.click({ timeout: 8000 });
      await expect(tourPanel, `${role}: tour panel remained active after pause`).toBeHidden({ timeout: 10000 });
      const pausedSession = await page.evaluate(() => sessionStorage.getItem('uptilldawn-tour-active-v8'));
      expect(pausedSession, `${role}: paused tour left active session behind`).toBeNull();
      // Validate persistence through an actual page reload. No synthetic tour
      // events, fabricated progress or mutations to application state.
      const savedProgressBeforeReload = await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('uptilldawn-tour-progress:'))
          .map(([key, value]) => ({ key, value: JSON.parse(value) as { paused?: boolean; activeKey?: string; completed?: string[] } }))
      );
      const pausedRecords = savedProgressBeforeReload.filter(record => record.value.paused === true);
      expect(pausedRecords.length, `${role}: no persisted paused tour progress`).toBeGreaterThan(0);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await expect(tourPanel, `${role}: paused tour unexpectedly restarted after reload`).toBeHidden({ timeout: 10000 });
      const savedProgressAfterReload = await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('uptilldawn-tour-progress:'))
          .map(([key, value]) => ({ key, value: JSON.parse(value) as { paused?: boolean; activeKey?: string; completed?: string[] } }))
      );
      for (const record of pausedRecords) {
        const restored = savedProgressAfterReload.find(item => item.key === record.key);
        expect(restored, `${role}: paused tour progress lost on reload`).toBeDefined();
        expect(restored!.value.paused).toBe(true);
        expect(restored!.value.activeKey).toBe(record.value.activeKey);
        expect(restored!.value.completed).toEqual(record.value.completed);
      }
      await testInfo.attach(`${role.toLowerCase()}-pause-reload-persistence.json`, {
        body: JSON.stringify({ role, pausedRecords, restoredRecords: savedProgressAfterReload }, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach(`${role.toLowerCase()}-pause-validation.json`, {
        body: JSON.stringify({ role, progressBeforePause: progressLabel, panelHidden: true, activeSession: pausedSession }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Tour start URL: ${page.url()}`);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-tour-start.png`), fullPage: true });
      await expect(page.locator('body')).toBeVisible();
      // Non-destructive route coverage: visit every same-origin, visible navigation destination.
      console.log(`[${role}] Route audit started with ${navigation.length} navigation links`);
      const routeChecks: Array<{ path: string; finalPath: string; status: number | null; visible: boolean; navigationError: string | null; documentStatus: number | null }> = [];
      const uniquePaths = [...new Set(navigation.map(item => item.href).filter((href): href is string => Boolean(href && href.startsWith('/') && !href.startsWith('//'))))];
      for (const path of uniquePaths) {
        console.log(`[${role}] Route audit visiting ${path}`);
        const target = new URL(path, baseURL!);
        let navigationError: string | null = null;
        const response = await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((error: unknown) => {
          navigationError = String(error);
          return null;
        });
        const finalPath = new URL(page.url()).pathname;
        const visible = await page.locator('body').isVisible().catch(() => false);
        // A Next.js client-side route may not yield a document response.
        // Preserve the real failure reason and independently probe HTTP without
        // treating a rendered body as proof of a successful server response.
        const documentStatus = response ? response.status() : await page.request.get(target.toString(), { timeout: 15000, maxRedirects: 0 }).then(result => result.status()).catch((error: unknown) => {
          console.error(`[${role}] Route audit HTTP probe failed ${path}: ${String(error)}`);
          return null;
        });
        routeChecks.push({ path, finalPath, status: response?.status() ?? null, visible, navigationError, documentStatus });
        console.log(`[${role}] Route audit result ${path}: status=${response?.status() ?? 'null'} httpProbe=${documentStatus ?? 'null'} final=${finalPath} navigationError=${navigationError ?? 'none'}`);
        if (routeChecks.length <= 2) await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-route-${routeChecks.length}.png`), fullPage: false, timeout: 5000 }).catch(error => console.log(`[${role}] optional route screenshot skipped: ${String(error)}`));
      }
      // Inventory the actual visible, enabled and disabled controls on every
      // authenticated route. This is an auditable coverage baseline, not a
      // substitute for exercising each action. Never click destructive actions.
      const controlInventory: Array<{ path: string; controls: Array<{ kind: string; label: string; disabled: boolean; accessibleName: string; actionable: boolean }>; error?: string }> = [];
      for (const path of uniquePaths) {
        const target = new URL(path, baseURL!).toString();
        const inventoryPage = await page.context().newPage();
        try {
          // An isolated page avoids races with the active tour controller and
          // makes each route independent. A failed route is recorded, never
          // silently counted as covered.
          await inventoryPage.goto(target, { waitUntil: 'commit', timeout: 20000 });
          await expect(inventoryPage.locator('main').first()).toBeVisible({ timeout: 10000 });
          const controls = await inventoryPage.locator('main button, main input, main select, main textarea, main [role="button"], main summary').evaluateAll(nodes =>
            nodes.filter(node => {
              const element = node as HTMLElement;
              const style = getComputedStyle(element);
              return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
            }).map(node => {
              const element = node as HTMLElement;
              const input = node as HTMLInputElement;
              return {
                kind: node.tagName.toLowerCase(),
                label: (element.getAttribute('aria-label') || element.getAttribute('title') || (input.type === 'password' ? '[password field]' : element.textContent) || element.getAttribute('name') || '').trim().slice(0, 120),
                disabled: Boolean(input.disabled || element.getAttribute('aria-disabled') === 'true'),
              accessibleName: (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title') || (element as HTMLButtonElement).innerText || element.getAttribute('placeholder') || element.getAttribute('name') || '').trim().slice(0, 120),
              actionable: !Boolean(input.disabled || element.getAttribute('aria-disabled') === 'true'),
              };
            })
          );
          controlInventory.push({ path, controls });
        } catch (error) {
          controlInventory.push({ path, controls: [], error: String(error).slice(0, 500) });
        } finally {
          await inventoryPage.close();
        }
      }
      await testInfo.attach(`${role.toLowerCase()}-visible-controls.json`, {
        body: JSON.stringify({ role, controlInventory }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Visible control inventory: ${JSON.stringify(controlInventory.map(item => ({ path: item.path, count: item.controls.length, error: item.error ?? null })))}`);
      const unnamedActions = controlInventory.flatMap(item => item.controls
        .filter(control => control.actionable && (control.kind === 'button' || control.kind === 'summary') && !control.accessibleName)
        .map(control => ({ path: item.path, kind: control.kind, label: control.label })));
      await testInfo.attach(`${role.toLowerCase()}-unnamed-actions.json`, {
        body: JSON.stringify({ role, unnamedActions }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Accessible control naming audit: ${unnamedActions.length} unnamed interactive controls`);
      const inventoryErrors = controlInventory.filter(item => item.error);
      expect(inventoryErrors, `${role}: routes could not be inventoried: ${JSON.stringify(inventoryErrors.map(item => ({ path: item.path, error: item.error })))}`).toHaveLength(0);
      console.log(`[${role}] Navigation route audit: ${JSON.stringify(routeChecks)}`);
      console.log(`[${role}] Server failures (HTTP 5xx): ${JSON.stringify(serverFailures.slice(-40))}`);
      await testInfo.attach(`${role.toLowerCase()}-server-failures.json`, { body: JSON.stringify(serverFailures, null, 2), contentType: 'application/json' });
      await testInfo.attach(`${role.toLowerCase()}-route-audit.json`, { body: JSON.stringify(routeChecks, null, 2), contentType: 'application/json' });
      expect(routeChecks.length, 'No navigable routes found for authenticated role').toBeGreaterThan(0);
      for (const check of routeChecks) {
        expect(check.documentStatus, `${role} ${check.path}: no document or independent HTTP response (navigation error: ${check.navigationError ?? 'none'})`).not.toBeNull();
        expect(check.documentStatus!, `${role} ${check.path}: HTTP error (navigation error: ${check.navigationError ?? 'none'})`).toBeLessThan(400);
        expect(check.visible, `${role} ${check.path}: body not visible`).toBe(true);
        expect(check.finalPath, `${role} ${check.path}: unexpected login redirect`).not.toMatch(/^\/login\//);
      }
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-post-login.png`), fullPage: true });
      if (errors.length) console.error(`[${role}] Uncaught exceptions with stacks:\n${errors.join('\n---\n')}`);
      expect(errors, 'Uncaught browser exceptions').toEqual([]);
    });
  }
});
