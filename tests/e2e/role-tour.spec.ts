import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
const roles = ['ADMIN', 'RESPONSIBLE', 'STAFF'] as const;

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
      await expect(page.locator('body')).not.toContainText(/invalid login credentials|ongeldige inloggegevens/i);
      try {
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).not.toMatch(/^\/login\//);
      } catch (error) {
        const visibleAlert = await page.locator('[role="alert"], [aria-live="assertive"], [data-sonner-toast]').allTextContents().catch(() => []);
        const inputState = await page.locator('input[type="email"], input[type="password"]').evaluateAll(inputs => inputs.map(input => ({ type: (input as HTMLInputElement).type, valid: (input as HTMLInputElement).validity.valid, validationMessage: (input as HTMLInputElement).validationMessage })));
        const diagnostic = { role, currentPath: new URL(page.url()).pathname, authResponses, formPosts, visibleAlert: visibleAlert.map(t => t.slice(0, 250)), inputState };
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
        await expect(proceed).toBeVisible({ timeout: 5000 });
        await proceed.click({ timeout: 8000, noWaitAfter: true });
        // The first welcome intentionally transitions to a second START TRAINING dialog.
        const beginTraining = page.getByRole('dialog').getByRole('button', { name: /start training|commencer la formation|training starten/i }).first();
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
          await startTour.click({ timeout: 8000, noWaitAfter: true });
        }
      } catch (error) {
        console.error(`[${role}] Tour start click failed: ${String(error).slice(0, 1200)}`);
        await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-start-click-failure.png`), fullPage: false, timeout: 5000 }).catch(() => {});
        throw error;
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
      await expect(tourPanel, `${role}: active interactive tour controller missing`).toBeVisible({ timeout: 15000 });
      const progressLabel = (await tourPanel.innerText()).trim();
      expect(progressLabel, `${role}: tour progress counter missing`).toMatch(/\b1\/\d+\b/);
      console.log(`[${role}] Active tour progress: ${progressLabel}`);
      await testInfo.attach(`${role.toLowerCase()}-active-tour.json`, {
        body: JSON.stringify({ role, progressLabel, path: new URL(page.url()).pathname }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[${role}] Tour start URL: ${page.url()}`);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-tour-start.png`), fullPage: true });
      await expect(page.locator('body')).toBeVisible();
      // Non-destructive route coverage: visit every same-origin, visible navigation destination.
      console.log(`[${role}] Route audit started with ${navigation.length} navigation links`);
      const routeChecks: Array<{ path: string; finalPath: string; status: number | null; visible: boolean }> = [];
      const uniquePaths = [...new Set(navigation.map(item => item.href).filter((href): href is string => Boolean(href && href.startsWith('/') && !href.startsWith('//'))))];
      for (const path of uniquePaths) {
        console.log(`[${role}] Route audit visiting ${path}`);
        const target = new URL(path, baseURL!);
        const response = await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
        const finalPath = new URL(page.url()).pathname;
        const visible = await page.locator('body').isVisible().catch(() => false);
        routeChecks.push({ path, finalPath, status: response?.status() ?? null, visible });
        console.log(`[${role}] Route audit result ${path}: status=${response?.status() ?? 'null'} final=${finalPath}`);
        if (routeChecks.length <= 2) await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-route-${routeChecks.length}.png`), fullPage: false, timeout: 5000 }).catch(error => console.log(`[${role}] optional route screenshot skipped: ${String(error)}`));
      }
      console.log(`[${role}] Navigation route audit: ${JSON.stringify(routeChecks)}`);
      await testInfo.attach(`${role.toLowerCase()}-route-audit.json`, { body: JSON.stringify(routeChecks, null, 2), contentType: 'application/json' });
      expect(routeChecks.length, 'No navigable routes found for authenticated role').toBeGreaterThan(0);
      for (const check of routeChecks) {
        expect(check.status, `${role} ${check.path}: HTTP error`).not.toBeNull();
        expect(check.status!, `${role} ${check.path}: HTTP error`).toBeLessThan(400);
        expect(check.visible, `${role} ${check.path}: body not visible`).toBe(true);
        expect(check.finalPath, `${role} ${check.path}: unexpected login redirect`).not.toMatch(/^\/login\//);
      }
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-post-login.png`), fullPage: true });
      if (errors.length) console.error(`[${role}] Uncaught exceptions with stacks:\n${errors.join('\n---\n')}`);
      expect(errors, 'Uncaught browser exceptions').toEqual([]);
    });
  }
});
