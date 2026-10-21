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
  // Role inspection now includes route visits, control inventories and real
  // reversible interactions. Keep the full audit intact instead of allowing
  // the old 120s tour-only budget to terminate the browser mid-inventory.
  test.setTimeout(360_000);
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
      // Record real main-frame redirects without logging cookies or tokens.
      const loginNavigationEvents: Array<{ kind: string; path: string; status?: number; redirectedFrom?: string }> = [];
      page.on('request', request => {
        if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
        const url = new URL(request.url());
        if (url.origin === new URL(baseURL!).origin) loginNavigationEvents.push({ kind: 'request', path: url.pathname });
      });
      page.on('response', response => {
        const request = response.request();
        if (!request.isNavigationRequest()) return;
        const url = new URL(response.url());
        if (url.origin !== new URL(baseURL!).origin) return;
        const from = request.redirectedFrom();
        loginNavigationEvents.push({ kind: 'response', path: url.pathname, status: response.status(), redirectedFrom: from ? new URL(from.url()).pathname : undefined });
      });
      page.on('framenavigated', frame => {
        if (frame !== page.mainFrame()) return;
        const url = new URL(frame.url());
        if (url.origin === new URL(baseURL!).origin) loginNavigationEvents.push({ kind: 'committed', path: url.pathname });
      });
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
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(error => console.log(`[${role}] DOMContentLoaded delayed: ${String(error).slice(0, 250)}`));
      try {
        await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
      } catch (error) {
        const diagnostic = { role, url: page.url(), loginNavigationEvents, authResponses, formPosts, serverFailures };
        console.error(`[${role}] Login document navigation diagnostic: ${JSON.stringify(diagnostic)}`);
        await testInfo.attach(`${role.toLowerCase()}-login-document-navigation.json`, {
          body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json',
        });
        throw error;
      }
      await expect(page.locator('body')).not.toContainText(/invalid login credentials|ongeldige inloggegevens/i);
      try {
        // Staging may finish Supabase auth and role resolution after the
        // initial form submission. Wait for the real redirect; never infer
        // authentication from a button click or a successful HTTP response.
        await expect.poll(() => new URL(page.url()).pathname, {
          timeout: 30000, intervals: [250, 500, 1000, 2000],
          message: `${role}: login did not redirect after submit`,
        }).not.toMatch(/^\/login\//);
      } catch (error) {
        const visibleAlert = await page.locator('[role="alert"], [aria-live="assertive"], [data-sonner-toast]').allTextContents().catch(() => []);
        const inputState = await page.locator('input[type="email"], input[type="password"]').evaluateAll(inputs => inputs.map(input => ({ type: (input as HTMLInputElement).type, valid: (input as HTMLInputElement).validity.valid, validationMessage: (input as HTMLInputElement).validationMessage })));
        const diagnostic = {
          role, currentPath: new URL(page.url()).pathname,
          documentReadyState: await page.evaluate(() => document.readyState).catch(() => null),
          loginNavigationEvents, authResponses, formPosts, loginSubmitState,
          roleRpcDiagnostics,
          visibleAlert: visibleAlert.map(t => t.slice(0, 250)), inputState, serverFailures,
          visibleBodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 1200),
        };
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
      // The staging role accounts are reused across CI runs. Reset only
      // browser-local tour state for this isolated test account, so the
      // first-chapter assertions cannot inherit a previous run's 5/11.
      // Never alter profiles, events, server records or other user data.
      const clearedTourKeys = await page.evaluate(() => {
        const cleared: string[] = [];
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('uptilldawn-tour-progress:')) {
            localStorage.removeItem(key);
            cleared.push(key);
          }
        }
        for (const key of ['uptilldawn-tour-active-v8', 'uptilldawn-tour-preview-route']) {
          if (sessionStorage.getItem(key) !== null) {
            sessionStorage.removeItem(key);
            cleared.push(key);
          }
        }
        return cleared;
      });
      await testInfo.attach(`${role.toLowerCase()}-tour-test-state-reset.json`, {
        body: JSON.stringify({ role, clearedTourKeys }, null, 2),
        contentType: 'application/json',
      });
      if (clearedTourKeys.length > 0) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
      }
      const trainingStartedByWelcome = await acknowledgeWelcome();
      // Exercise navigation in an isolated authenticated page only after the
      // actual first-login onboarding dialog has been completed. The original
      // page must stay on /help for the training start assertions.
      if (functionalLinks.length > 0) {
        const navigationPage = await page.context().newPage();
        try {
          await navigationPage.goto(new URL(authenticatedPath, baseURL!).toString(), {
            waitUntil: 'domcontentloaded', timeout: 20000,
          });
          const blockingDialog = navigationPage.locator('[role="dialog"][aria-modal="true"]:visible');
          // Onboarding may appear only after client hydration, including after
          // the first actionability check. Complete the actual dialog controls.
          const finishNavigationWelcome = async () => {
            const visibleDialogs = await blockingDialog.allInnerTexts();
            if (!visibleDialogs.length) return false;
            const knownWelcome = visibleDialogs.every(text =>
              /je profiel is opgeslagen|your profile has been saved|votre profil a été enregistré|dein profil wurde gespeichert|start tour|start rondleiding|commencer la visite|rundgang starten|start training|commencer la formation|training starten/i.test(text)
            );
            expect(knownWelcome, `${role}: unexpected dialog blocks functional navigation: ${JSON.stringify(visibleDialogs)}`).toBe(true);
            const welcome = blockingDialog.first();
            const proceed = welcome.getByRole('button', { name: /start rondleiding|start tour|commencer la visite|rundgang starten/i }).first();
            if (await proceed.isVisible().catch(() => false)) {
              await proceed.click({ timeout: 8000, noWaitAfter: true });
            }
            const training = navigationPage.getByRole('dialog').getByRole('button', {
              name: /start training|commencer la formation|training starten/i,
            }).first();
            if (await training.isVisible().catch(() => false)) {
              await training.click({ timeout: 8000, noWaitAfter: true });
            }
            await expect(blockingDialog, `${role}: onboarding dialog still blocks navigation`).toHaveCount(0, { timeout: 10000 });
            return true;
          };
          await finishNavigationWelcome();
          // The landing page's earlier link text can become stale after
          // onboarding or role hydration. Re-read the actual visible anchors
          // on this page and click by exact href, not translated label.
          // Wait for client-side role navigation to render rather than taking
          // an immediate snapshot after DOMContentLoaded.
          const roleNavigationLinks = navigationPage.locator('nav a[href]:visible, [role="navigation"] a[href]:visible, aside a[href]:visible');
          // A visible brand/home link is not evidence that role navigation has hydrated.
          // Poll for a usable feature destination; preserve a hard failure if none renders.
          await expect.poll(async () => {
            const links = await roleNavigationLinks.evaluateAll(nodes => nodes.map(node =>
              (node as HTMLAnchorElement).getAttribute('href')
            ));
            return links.filter(href => {
              if (!href?.startsWith('/') || href.startsWith('//')) return false;
              const pathname = new URL(href, baseURL!).pathname;
              return pathname !== '/' && pathname !== authenticatedPath &&
                !['login', 'logout', 'signup', 'auth'].includes(pathname.split('/')[1]);
            }).length;
          }, { message: `${role}: no hydrated functional navigation destination`, timeout: 20000 }).toBeGreaterThan(0);
          const currentLinks = await navigationPage.locator('nav a[href], [role="navigation"] a[href], aside a[href]')
            .evaluateAll(links => links.filter(link => {
              const element = link as HTMLAnchorElement;
              const style = getComputedStyle(element);
              return style.display !== 'none' && style.visibility !== 'hidden' &&
                element.getClientRects().length > 0;
            }).map(link => ({
              href: (link as HTMLAnchorElement).getAttribute('href'),
              label: (link.textContent || '').trim().slice(0, 100),
            })));
          const availableFunctionalLinks = currentLinks.filter(link => {
            if (!link.href?.startsWith('/') || link.href.startsWith('//')) return false;
            const pathname = new URL(link.href, baseURL!).pathname;
            return pathname !== '/' && pathname !== authenticatedPath &&
              !['login', 'logout', 'signup', 'auth'].includes(pathname.split('/')[1]);
          });
          await testInfo.attach(`${role.toLowerCase()}-current-navigation-links.json`, {
            body: JSON.stringify({ role, authenticatedPath, currentLinks, availableFunctionalLinks }, null, 2),
            contentType: 'application/json',
          });
          if (availableFunctionalLinks.length === 0) {
            await testInfo.attach(`${role.toLowerCase()}-navigation-session-diagnostics.json`, {
              body: JSON.stringify({
                role, expectedAuthenticatedPath: authenticatedPath,
                actualUrl: navigationPage.url(),
                title: await navigationPage.title().catch(() => null),
                readyState: await navigationPage.evaluate(() => document.readyState).catch(() => null),
                bodyText: (await navigationPage.locator('body').innerText().catch(() => '')).slice(0, 3000),
                allAnchors: await navigationPage.locator('a[href]').evaluateAll(nodes =>
                  nodes.map(node => ({
                    href: node.getAttribute('href'),
                    label: (node.textContent || '').trim().slice(0, 80),
                    visible: (node as HTMLElement).getClientRects().length > 0,
                  })).slice(0, 80)
                ).catch(() => []),
                visibleDialogs: await navigationPage.locator('[role="dialog"]:visible').allInnerTexts().catch(() => []),
              }, null, 2),
              contentType: 'application/json',
            });
          }
          expect(availableFunctionalLinks.length,
            `${role}: no visible functional links after onboarding; compare current-navigation-links.json`).toBeGreaterThan(0);
          // Hydration can replace navigation between discovery and click.
          // Re-read candidates for each attempt; never retry a stale locator.
          const clickAttempts: Array<{ attempt: number; candidates: string[]; chosen: string | null; error: string | null; finalPath: string }> = [];
          let targetPath = '';
          let navigationClicked = false;
          for (let attempt = 1; attempt <= 2 && !navigationClicked; attempt++) {
            await finishNavigationWelcome();
            const liveCandidates = await navigationPage.locator('nav a[href]:visible, [role="navigation"] a[href]:visible, aside a[href]:visible')
              .evaluateAll(nodes => nodes.map(node => (node as HTMLAnchorElement).getAttribute('href'))
                .filter((href): href is string => Boolean(href && href.startsWith('/') && !href.startsWith('//') && href !== '/')));
            const candidates = [...new Set(liveCandidates)].filter(href =>
              !['login', 'logout', 'signup', 'auth'].includes(new URL(href, baseURL!).pathname.split('/')[1]));
            const chosen = candidates[0] ?? null;
            let error: string | null = null;
            if (chosen) {
              targetPath = new URL(chosen, baseURL!).pathname;
              try {
                const liveLink = navigationPage.locator('nav a[href]:visible, [role="navigation"] a[href]:visible, aside a[href]:visible')
                  .and(navigationPage.locator(`a[href=${JSON.stringify(chosen)}]`)).first();
                await liveLink.click({ timeout: 7000, noWaitAfter: true });
                await expect.poll(() => new URL(navigationPage.url()).pathname, { timeout: 12000 }).toBe(targetPath);
                navigationClicked = true;
              } catch (caught) {
                error = String(caught).slice(0, 500);
              }
            } else {
              error = 'No visible feature destination after onboarding';
            }
            clickAttempts.push({ attempt, candidates, chosen, error, finalPath: new URL(navigationPage.url()).pathname });
          }
          await testInfo.attach(`${role.toLowerCase()}-navigation-attempts.json`, {
            body: JSON.stringify({ role, clickAttempts }, null, 2),
            contentType: 'application/json',
          });
          expect(navigationClicked, `${role}: no successful feature navigation: ${JSON.stringify(clickAttempts)}`).toBe(true);
          await testInfo.attach(`${role.toLowerCase()}-real-navigation-click.json`, {
            body: JSON.stringify({ role, targetPath, finalPath: new URL(navigationPage.url()).pathname }, null, 2),
            contentType: 'application/json',
          });
        } finally {
          await navigationPage.close();
        }
      }
      const startTour = page.locator('#app-scroll').getByRole('button', { name: /rondleiding starten|start tour|commencer la visite|rundgang starten|hervatten|resume|reprendre|fortsetzen/i }).first();
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
      // A resumed 5/11 is a real state discrepancy, not a missing counter.
      // Capture the precise client-side state without mutating user records or
      // weakening the first-chapter assertion. Never attach auth tokens.
      const progressState = await page.evaluate(() => ({
        path: location.pathname,
        progressKeys: Object.keys(localStorage).filter(key => key.startsWith('uptilldawn-tour-progress:'))
          .map(key => ({ key, value: localStorage.getItem(key)?.slice(0, 2000) })),
        activeSession: sessionStorage.getItem('uptilldawn-tour-active-v8')?.slice(0, 2000) ?? null,
        trainingWorkflow: sessionStorage.getItem('uptilldawn-training-workflow-v3')?.slice(0, 2000) ?? null,
        previewRoute: sessionStorage.getItem('uptilldawn-tour-preview-route'),
        panelText: document.querySelector('[data-tour-panel]')?.textContent?.slice(0, 500) ?? null,
      }));
      await testInfo.attach(`${role.toLowerCase()}-tour-progress-source.json`, {
        body: JSON.stringify({ role, progressLabel, progressState }, null, 2),
        contentType: 'application/json',
      });
      expect(progressLabel, `${role}: expected fresh tour at 1/N, received ${progressLabel}; inspect tour-progress-source artifact`).toMatch(/\b1\/\d+\b/);
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
      try {
        await expect(tourTarget, `${role}: first training chapter target missing`).toBeVisible({ timeout: 15000 });
      } catch (error) {
        const diagnostic = await page.evaluate((selector) => ({
          path: location.pathname,
          expectedSelector: selector,
          matchingElements: document.querySelectorAll(selector).length,
          demoScreens: Array.from(document.querySelectorAll('[data-tour-demo]')).map(el => ({
            type: el.getAttribute('data-tour-demo'), visible: el.getClientRects().length > 0,
          })),
          panel: document.querySelector('[data-tour-panel]')?.textContent?.slice(0, 500) ?? null,
          session: sessionStorage.getItem('uptilldawn-tour-active-v8'),
        }), targetSelector);
        console.error(`[${role}] Missing chapter target diagnostic: ${JSON.stringify(diagnostic)}`);
        await testInfo.attach(`${role.toLowerCase()}-missing-first-target.json`, {
          body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json',
        });
        throw error;
      }
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
      // Re-discover navigation after onboarding: login-time links may be a stale shell.
      const discoveryPage = await page.context().newPage();
      let hydratedLinks: Array<{ href: string | null; label: string }> = [];
      try {
        await discoveryPage.goto(new URL('/', baseURL!).toString(), { waitUntil: 'commit', timeout: 20000 });
        await expect(discoveryPage.locator('body')).toBeVisible({ timeout: 15000 });
        // A single logo link is only the loading shell, not hydrated role navigation.
        // Observe a stable non-home destination before treating discovery as complete.
        const hydrationSamples: Array<{ path: string; navHrefs: string[]; mainVisible: boolean }> = [];
        try {
          await expect.poll(async () => {
            const navHrefs = await discoveryPage.locator('nav a[href]:visible, [role="navigation"] a[href]:visible, aside a[href]:visible').evaluateAll(nodes =>
              nodes.map(node => node.getAttribute('href')).filter((href): href is string => Boolean(href))
            );
            hydrationSamples.push({
              path: new URL(discoveryPage.url()).pathname,
              navHrefs,
              mainVisible: await discoveryPage.locator('main:visible').count() > 0,
            });
            return navHrefs.filter(href => href.startsWith('/') && href !== '/' && !/^\/(login|logout|signup|auth)(\/|$)/.test(href)).length;
          }, { timeout: 20000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0);
        } catch (error) {
          console.log(`[${role}] Discovery hydration incomplete: ${String(error)}`);
        }
        await testInfo.attach(`${role.toLowerCase()}-discovery-hydration.json`, {
          body: JSON.stringify({ role, samples: hydrationSamples.slice(-25) }, null, 2),
          contentType: 'application/json',
        });
        // A fresh authenticated page can display first-login onboarding again.
        // Capture the overlay and all navigation semantics before interpreting
        // a single visible home link as complete role navigation.
        const discoverySurface = await discoveryPage.evaluate(() => {
          const visible = (node: Element) => {
            const element = node as HTMLElement;
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
          };
          const snapshot = (selector: string) => [...document.querySelectorAll(selector)].filter(visible).map(node => ({
            tag: node.tagName.toLowerCase(),
            text: ((node as HTMLElement).innerText || node.getAttribute('aria-label') || '').trim().slice(0, 100),
            href: node.getAttribute('href'),
            role: node.getAttribute('role'),
          }));
          return {
            path: location.pathname,
            dialogs: snapshot('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'),
            navAnchors: snapshot('nav a, aside a, [role="navigation"] a'),
            navButtons: snapshot('nav button, aside button, [role="navigation"] button'),
            mainHeadings: snapshot('main h1, main h2'),
          };
        });
        await testInfo.attach(`${role.toLowerCase()}-discovery-surface.json`, {
          body: JSON.stringify({ role, discoverySurface }, null, 2),
          contentType: 'application/json',
        });
        console.log(`[${role}] Discovery surface: ${JSON.stringify({ dialogs: discoverySurface.dialogs.length, navAnchors: discoverySurface.navAnchors.length, navButtons: discoverySurface.navButtons.length, mainHeadings: discoverySurface.mainHeadings.length })}`);
        // A client-side redirect may destroy the discovery document during evaluateAll.
        // The authenticated landing page was already inventoried above, so preserve
        // that evidence instead of treating a transient discovery failure as zero routes.
        hydratedLinks = await discoveryPage.locator('nav a[href], [role="navigation"] a[href], aside a[href]').evaluateAll(nodes =>
          nodes.map(node => ({ href: node.getAttribute('href'), label: (node.textContent || '').trim().slice(0, 100) }))
        ).catch(error => {
          console.log(`[${role}] Discovery document changed while reading links: ${String(error).slice(0, 250)}`);
          return [];
        });
      } finally {
        await discoveryPage.close();
      }
      // Admin navigation may use in-page tabs rather than URL anchors.
      // Record the actual visible tab/button structure without triggering writes.
      const adminSurface = role === 'ADMIN' ? await page.evaluate(() => {
        const visible = (node: Element) => {
          const element = node as HTMLElement;
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        };
        const inspect = (selector: string) => [...document.querySelectorAll(selector)].filter(visible).map(node => ({
          tag: node.tagName.toLowerCase(),
          label: ((node as HTMLElement).innerText || node.getAttribute('aria-label') || '').trim().slice(0, 100),
          role: node.getAttribute('role'),
          href: node.getAttribute('href'),
          ariaControls: node.getAttribute('aria-controls'),
          ariaSelected: node.getAttribute('aria-selected'),
          dataState: node.getAttribute('data-state'),
        }));
        return {
          urlPath: location.pathname,
          tabs: inspect('[role="tab"], [role="tablist"] button, [aria-controls][role="button"]'),
          navigationButtons: inspect('nav button, aside button, [role="navigation"] button'),
          mainHeadings: inspect('main h1, main h2, main h3'),
          mainButtons: inspect('main button').slice(0, 80),
        };
      }) : null;
      if (adminSurface) {
        await testInfo.attach('admin-functional-surface.json', {
          body: JSON.stringify({ role, adminSurface }, null, 2),
          contentType: 'application/json',
        });
        console.log(`[ADMIN] Functional surface: ${JSON.stringify({ tabs: adminSurface.tabs.length, navigationButtons: adminSurface.navigationButtons.length, mainButtons: adminSurface.mainButtons.length, headings: adminSurface.mainHeadings.length })}`);
      }
      // Compare the actual post-onboarding page with the fresh discovery page.
      // Do not record cookies, tokens, localStorage values or personal data.
      const compareNavigationContext = async (candidate: typeof page) => candidate.evaluate(() => {
        const links = [...document.querySelectorAll('nav a[href], aside a[href], [role="navigation"] a[href]')]
          .filter(node => (node as HTMLElement).getClientRects().length > 0)
          .map(node => node.getAttribute('href'))
          .filter((href): href is string => Boolean(href));
        return {
          path: location.pathname,
          readyState: document.readyState,
          visibleFeatureHrefs: [...new Set(links.filter(href => href.startsWith('/') && href !== '/'))],
          visibleNavLinkCount: links.length,
          mainVisible: [...document.querySelectorAll('main')].some(node => (node as HTMLElement).getClientRects().length > 0),
          dialogCount: [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(node => (node as HTMLElement).getClientRects().length > 0).length,
        };
      });
      const originalContext = await compareNavigationContext(page);
      // The discovery page was closed after its snapshot, so compare the
      // persisted hydrated links against the live original page.
      const navigationComparison = {
        role,
        originalContext,
        discoveryFeatureHrefs: hydratedLinks.map(item => item.href).filter(href => href && href !== '/'),
        loginFeatureHrefs: navigation.map(item => item.href).filter(href => href && href !== '/'),
      };
      await testInfo.attach(`${role.toLowerCase()}-navigation-context-comparison.json`, {
        body: JSON.stringify(navigationComparison, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Navigation context comparison: ${JSON.stringify({ original: originalContext.visibleFeatureHrefs.length, discovery: navigationComparison.discoveryFeatureHrefs.length, login: navigationComparison.loginFeatureHrefs.length, originalPath: originalContext.path })}`);
      // Keep the role's authenticated landing route in the audit even if the
      // discovery tab redirects or an onboarding overlay obscures visible links.
      // All additional routes must still come from actual observed anchors.
      const uniquePaths = [...new Set([authenticatedPath, ...hydratedLinks.map(item => item.href), ...navigation.map(item => item.href)]
        .filter((href): href is string => Boolean(href && href.startsWith('/') && !href.startsWith('//'))))];
      await testInfo.attach(`${role.toLowerCase()}-route-discovery.json`, {
        body: JSON.stringify({ role, initialCount: navigation.length, hydratedLinks, uniquePaths }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Role route discovery: ${JSON.stringify({ initial: navigation.length, hydrated: hydratedLinks.length, unique: uniquePaths.length })}`);
      const discoveredFeaturePaths = uniquePaths.filter(path => path !== '/' && !/^\/(login|logout|signup|auth)(\/|$)/.test(path));
      await testInfo.attach(`${role.toLowerCase()}-feature-route-coverage.json`, {
        body: JSON.stringify({ role, discoveredFeaturePaths, complete: discoveredFeaturePaths.length > 0 }, null, 2),
        contentType: 'application/json',
      });
      expect(discoveredFeaturePaths.length, `${role}: only the landing shell was discovered; functional role navigation is not covered`).toBeGreaterThan(0);

      for (const path of uniquePaths) {
        console.log(`[${role}] Route audit visiting ${path}`);
        const target = new URL(path, baseURL!);
        let navigationError: string | null = null;
        // Probe in a fresh page: a previous timed-out navigation must not
        // contaminate the next route or the active tour session.
        const routePage = await page.context().newPage();
        let status: number | null = null;
        let finalPath = '';
        let visible = false;
        let documentStatus: number | null = null;
        try {
          const response = await routePage.goto(target.toString(), { waitUntil: 'commit', timeout: 20000 }).catch((error: unknown) => {
            navigationError = String(error);
            return null;
          });
          status = response?.status() ?? null;
          documentStatus = status;
          finalPath = new URL(routePage.url()).pathname;
          visible = await routePage.locator('body').waitFor({ state: 'visible', timeout: 12000 })
            .then(() => true).catch(() => false);
          if (!visible) {
            await testInfo.attach(`${role.toLowerCase()}-route-render-failure-${routeChecks.length}.json`, {
              body: JSON.stringify({
                role, path, url: routePage.url(), status, navigationError,
                readyState: await routePage.evaluate(() => document.readyState).catch(() => null),
                bodyCount: await routePage.locator('body').count().catch(() => -1),
                mainCount: await routePage.locator('main').count().catch(() => -1),
                title: await routePage.title().catch(() => null),
              }, null, 2),
              contentType: 'application/json',
            });
          }
          if (documentStatus === null) {
            documentStatus = await page.request.get(target.toString(), { timeout: 15000, maxRedirects: 0 })
              .then(result => result.status()).catch((error: unknown) => {
                console.error(`[${role}] Route audit HTTP probe failed ${path}: ${String(error)}`);
                return null;
              });
          }
        } finally {
          await routePage.close();
        }
        routeChecks.push({ path, finalPath, status, visible, navigationError, documentStatus });
        console.log(`[${role}] Route audit result ${path}: status=${status ?? 'null'} httpProbe=${documentStatus ?? 'null'} final=${finalPath} navigationError=${navigationError ?? 'none'}`);
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
          try {
            await expect(inventoryPage.locator('main').first()).toBeVisible({ timeout: 15000 });
          } catch (renderError) {
            await testInfo.attach(`${role.toLowerCase()}-inventory-render-failure-${uniquePaths.indexOf(path)}.json`, {
              body: JSON.stringify({
                role, path, url: inventoryPage.url(), error: String(renderError),
                readyState: await inventoryPage.evaluate(() => document.readyState).catch(() => null),
                bodyCount: await inventoryPage.locator('body').count().catch(() => -1),
                mainCount: await inventoryPage.locator('main').count().catch(() => -1),
                title: await inventoryPage.title().catch(() => null),
              }, null, 2),
              contentType: 'application/json',
            });
            throw renderError;
          }
          // A visible shell is not proof that React finished hydrating.
          // Inventory interactive elements across the rendered document,
          // including role portals and dialogs mounted outside <main>.
          await inventoryPage.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
          await inventoryPage.locator('button, input, select, textarea, [role="button"], [role="tab"], summary, a[href]')
            .first().waitFor({ state: 'attached', timeout: 12000 });
          const controls = await inventoryPage.locator('button, input, select, textarea, [role="button"], [role="tab"], summary, a[href]').evaluateAll(nodes =>
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
      // Real, non-destructive interactions: exercise native disclosure controls
      // and accessible tabs on each discovered route. Never click unknown
      // buttons (which could save, delete or send real user data).
      const interactionAudit: Array<{ path: string; kind: string; label: string; result: string; error?: string }> = [];
      for (const path of uniquePaths) {
        const interactionPage = await page.context().newPage();
        try {
          const interactionUrl = new URL(path, baseURL!).toString();
          const navigationAttempts: Array<{ attempt: number; error: string | null; finalUrl: string; readyState: string | null; mainVisible: boolean }> = [];
          let interactionReady = false;
          for (let attempt = 1; attempt <= 2 && !interactionReady; attempt++) {
            let navigationError: string | null = null;
            try {
              // 'commit' confirms a real document response without waiting for
              // slow third-party scripts or a delayed DOMContentLoaded event.
              await interactionPage.goto(interactionUrl, { waitUntil: 'commit', timeout: 15000 });
              await expect(interactionPage.locator('main').first()).toBeVisible({ timeout: 12000 });
              interactionReady = true;
            } catch (error) {
              navigationError = String(error).slice(0, 600);
            }
            const readyState = await interactionPage.evaluate(() => document.readyState).catch(() => null);
            const mainVisible = await interactionPage.locator('main').first().isVisible().catch(() => false);
            navigationAttempts.push({ attempt, error: navigationError, finalUrl: interactionPage.url(), readyState, mainVisible });
            if (!interactionReady && attempt === 1) {
              // Recreate the page after a stalled navigation; never mark a
              // timed-out attempt as success based on a stale body.
              await interactionPage.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
            }
          }
          await testInfo.attach(`${role.toLowerCase()}-interaction-navigation-${uniquePaths.indexOf(path)}.json`, {
            body: JSON.stringify({ role, path, navigationAttempts }, null, 2),
            contentType: 'application/json',
          });
          expect(interactionReady, `${role} ${path}: navigation did not render usable main: ${JSON.stringify(navigationAttempts)}`).toBe(true);
          // Exercise a real, non-mutating navigation action from this route.
          // A route visit alone is not a click; only credit the interaction
          // after the browser URL changes to the observed link destination.
          const routeNavigation = interactionPage.locator('nav a[href]:visible, [role="navigation"] a[href]:visible, aside a[href]:visible');
          const routeNavigationCount = await routeNavigation.count();
          // Prefer a real feature route over the brand/logo home link.
          // The latter exercises navigation but does not cover a feature.
          const navigationCandidates: Array<{ index: number; destination: string; label: string }> = [];
          for (let linkIndex = 0; linkIndex < routeNavigationCount; linkIndex++) {
            const link = routeNavigation.nth(linkIndex);
            const href = await link.getAttribute('href');
            if (!href?.startsWith('/') || href.startsWith('//')) continue;
            const destination = new URL(href, baseURL!).pathname;
            if (destination === new URL(interactionPage.url()).pathname ||
                /^\/(login|logout|signup|auth)(\/|$)/.test(destination)) continue;
            navigationCandidates.push({
              index: linkIndex, destination,
              label: (await link.innerText().catch(() => '')).trim().slice(0, 100),
            });
          }
          navigationCandidates.sort((a, b) => Number(a.destination === '/') - Number(b.destination === '/'));
          // Inspect up to three distinct feature destinations without invoking
          // destructive buttons or modifying staging records. A home/logo click
          // alone must not be reported as feature navigation coverage.
          const distinctFeatureCandidates = navigationCandidates
            .filter(candidate => candidate.destination !== '/')
            .filter((candidate, index, all) => all.findIndex(item => item.destination === candidate.destination) === index)
            .slice(0, 3);
          const featureNavigationResults: Array<{ destination: string; status: string; finalPath: string }> = [];
          for (const candidate of distinctFeatureCandidates) {
            const featurePage = await page.context().newPage();
            try {
              const featureNavigationAttempts: Array<{ attempt: number; error: string | null; url: string; readyState: string | null }> = [];
              let featureOriginReady = false;
              for (let attempt = 1; attempt <= 2 && !featureOriginReady; attempt++) {
                let error: string | null = null;
                try {
                  await featurePage.goto(interactionUrl, { waitUntil: 'commit', timeout: 20000 });
                  await expect(featurePage.locator('main').first()).toBeVisible({ timeout: 12000 });
                  featureOriginReady = true;
                } catch (caught) {
                  error = String(caught).slice(0, 500);
                }
                featureNavigationAttempts.push({
                  attempt, error, url: featurePage.url(),
                  readyState: await featurePage.evaluate(() => document.readyState).catch(() => null),
                });
                if (!featureOriginReady && attempt === 1) {
                  await featurePage.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
                }
              }
              await testInfo.attach(`${role.toLowerCase()}-feature-origin-${uniquePaths.indexOf(path)}-${candidate.index}.json`, {
                body: JSON.stringify({ role, path, destination: candidate.destination, featureNavigationAttempts }, null, 2),
                contentType: 'application/json',
              });
              expect(featureOriginReady, `${role} ${path}: feature origin did not render: ${JSON.stringify(featureNavigationAttempts)}`).toBe(true);
              const featureLink = featurePage.locator('nav a[href], [role="navigation"] a[href], aside a[href]')
                .and(featurePage.locator(`a[href=${JSON.stringify(candidate.destination)}]`)).first();
              await expect(featureLink).toBeVisible({ timeout: 15000 });
              await featureLink.click({ timeout: 10000, noWaitAfter: true });
              await expect.poll(() => new URL(featurePage.url()).pathname, { timeout: 15000 }).toBe(candidate.destination);
              await expect(featurePage.locator('main').first()).toBeVisible({ timeout: 15000 });
              featureNavigationResults.push({ destination: candidate.destination, status: 'clicked-and-rendered', finalPath: new URL(featurePage.url()).pathname });
              interactionAudit.push({ path, kind: 'feature-navigation', label: candidate.label || candidate.destination, result: `clicked:${candidate.destination}` });
            } finally {
              await featurePage.close();
            }
          }
          await testInfo.attach(`${role.toLowerCase()}-feature-navigation-${uniquePaths.indexOf(path)}.json`, {
            body: JSON.stringify({ role, path, candidateCount: distinctFeatureCandidates.length, featureNavigationResults }, null, 2),
            contentType: 'application/json',
          });
          let navigationExercised = false;
          for (const candidate of navigationCandidates) {
            const link = routeNavigation.nth(candidate.index);
            await link.click({ timeout: 8000, noWaitAfter: true });
            await expect.poll(() => new URL(interactionPage.url()).pathname, { timeout: 15000 }).toBe(candidate.destination);
            interactionAudit.push({ path, kind: 'navigation', label: candidate.label || candidate.destination, result: `clicked:${candidate.destination}` });
            navigationExercised = true;
            break;
          }
          if (!navigationExercised) {
            interactionAudit.push({ path, kind: 'navigation-unavailable', label: '', result: 'no-visible-safe-destination' });
          }
          // Return to the original route before exercising disclosures/tabs.
          if (navigationExercised) {
            const returnAttempts: Array<{ attempt: number; error: string | null; url: string }> = [];
            let returned = false;
            for (let attempt = 1; attempt <= 2 && !returned; attempt++) {
              let error: string | null = null;
              try {
                await interactionPage.goto(interactionUrl, { waitUntil: 'commit', timeout: 20000 });
                await expect(interactionPage.locator('main').first()).toBeVisible({ timeout: 12000 });
                returned = true;
              } catch (caught) {
                error = String(caught).slice(0, 600);
              }
              returnAttempts.push({ attempt, error, url: interactionPage.url() });
              if (!returned && attempt === 1) {
                await interactionPage.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
              }
            }
            await testInfo.attach(`${role.toLowerCase()}-interaction-return-${uniquePaths.indexOf(path)}.json`, {
              body: JSON.stringify({ role, path, returnAttempts }, null, 2),
              contentType: 'application/json',
            });
            expect(returned, `${role} ${path}: return navigation failed: ${JSON.stringify(returnAttempts)}`).toBe(true);
          }
          const summaries = interactionPage.locator('main details > summary:visible');
          const summaryCount = await summaries.count();
          for (let index = 0; index < summaryCount; index++) {
            const summary = summaries.nth(index);
            const label = (await summary.innerText()).trim().slice(0, 100);
            const details = summary.locator('xpath=..');
            const initiallyOpen = await details.evaluate(node => (node as HTMLDetailsElement).open);
            await summary.click({ timeout: 8000 });
            await expect.poll(() => details.evaluate(node => (node as HTMLDetailsElement).open)).toBe(!initiallyOpen);
            await summary.click({ timeout: 8000 });
            await expect.poll(() => details.evaluate(node => (node as HTMLDetailsElement).open)).toBe(initiallyOpen);
            interactionAudit.push({ path, kind: 'disclosure', label, result: 'opened-and-restored' });
          }
          const tabs = interactionPage.locator('main [role="tab"]:visible');
          const tabCount = await tabs.count();
          if (tabCount > 1) {
            const targetTab = tabs.filter({ 'aria-selected': 'false' }).first();
            if (await targetTab.count()) {
              const label = (await targetTab.innerText()).trim().slice(0, 100);
              await targetTab.click({ timeout: 8000 });
              await expect(targetTab, `${role} ${path}: tab click did not activate selected tab`).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
              interactionAudit.push({ path, kind: 'tab', label, result: 'clicked-and-selected' });
            }
          }
        } catch (error) {
          interactionAudit.push({ path, kind: 'interaction-error', label: '', result: 'failed', error: String(error).slice(0, 600) });
        } finally {
          await interactionPage.close();
        }
      }
      await testInfo.attach(`${role.toLowerCase()}-real-safe-interactions.json`, {
        body: JSON.stringify({ role, interactionAudit }, null, 2), contentType: 'application/json',
      });
      console.log(`[${role}] Real safe interactions: ${JSON.stringify(interactionAudit)}`);
      // Coverage is only credited for observed UI interactions, not for
      // discovering a button or for loading its route. Surface remaining
      // actions explicitly so the release gate cannot mistake green tests
      // for comprehensive E2E coverage.
      const actionCoverage = controlInventory.map(route => {
        const attempted = interactionAudit.filter(action => action.path === route.path && !action.error && ['navigation', 'disclosure', 'tab'].includes(action.kind));
        const actionable = route.controls.filter(control => control.actionable && !['a'].includes(control.kind));
        const unexercised = actionable.filter(control =>
          !attempted.some(action =>
            (control.kind === 'summary' && action.kind === 'disclosure' && action.label === control.accessibleName) ||
            (action.kind === 'tab' && action.label === control.accessibleName)
          )
        );
        return {
          path: route.path,
          actionableCount: actionable.length,
          observedInteractionCount: attempted.length,
          unexercisedCount: unexercised.length,
          unexercised: unexercised.map(control => ({
            kind: control.kind, label: control.accessibleName || control.label || '[unnamed]',
          })),
        };
      });
      const actionTotals = {
        routes: actionCoverage.length,
        actionable: actionCoverage.reduce((sum, route) => sum + route.actionableCount, 0),
        observedInteractions: actionCoverage.reduce((sum, route) => sum + route.observedInteractionCount, 0),
        unexercised: actionCoverage.reduce((sum, route) => sum + route.unexercisedCount, 0),
      };
      await testInfo.attach(`${role.toLowerCase()}-e2e-action-coverage-gaps.json`, {
        body: JSON.stringify({ role, actionTotals, actionCoverage, releaseReady: actionTotals.actionable > 0 && actionTotals.unexercised === 0 }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] E2E action coverage gaps: ${JSON.stringify(actionTotals)} (not a release approval)`);
      expect(actionTotals.actionable, `${role}: inventory returned zero actionable controls; coverage is invalid, not complete`).toBeGreaterThan(0);
      const interactionErrors = interactionAudit.filter(item => item.error);
      expect(interactionErrors, `${role}: real UI interaction failures`).toHaveLength(0);
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
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-post-login.png`), fullPage: false, timeout: 5000, animations: "disabled" }).catch(error => console.log(`[${role}] Optional final screenshot skipped after bounded timeout: ${String(error)}`));
      if (errors.length) console.error(`[${role}] Uncaught exceptions with stacks:\n${errors.join('\n---\n')}`);
      expect(errors, 'Uncaught browser exceptions').toEqual([]);
    });
  }
});
