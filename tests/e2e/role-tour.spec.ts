import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
const roles = ['ADMIN', 'RESPONSIBLE', 'STAFF'] as const;

test.describe('UpTillDawn role-tour browser validation', () => {
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
      // Non-destructive route coverage: visit every same-origin, visible navigation destination.
      const routeChecks: Array<{ path: string; finalPath: string; status: number | null; visible: boolean }> = [];
      const uniquePaths = [...new Set(navigation.map(item => item.href).filter((href): href is string => Boolean(href && href.startsWith('/') && !href.startsWith('//'))))];
      for (const path of uniquePaths) {
        const target = new URL(path, baseURL!);
        const response = await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
        const finalPath = new URL(page.url()).pathname;
        const visible = await page.locator('body').isVisible().catch(() => false);
        routeChecks.push({ path, finalPath, status: response?.status() ?? null, visible });
        await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-route-${routeChecks.length}.png`), fullPage: true });
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
      // Role-specific training entrypoint: validate the actual chapters and start control.
      const trainingResponse = await page.goto(new URL('/help', baseURL!).toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await expect(page.locator('main')).toBeVisible();
      const trainingHeading = page.getByRole('heading', { name: /interactieve opleiding|interactive training|formation interactive|interaktives training/i });
      await expect(trainingHeading).toBeVisible({ timeout: 12000 });
      if (role === 'ADMIN') {
        const switchToAdmin = page.getByRole('button', { name: /admin-rondleiding openen|open admin tour|ouvrir la visite admin|admin-tour öffnen/i });
        if (await switchToAdmin.isVisible().catch(() => false)) {
          await switchToAdmin.click();
          await expect(switchToAdmin).toBeHidden({ timeout: 15000 });
        }
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

      const startTour = page.getByRole('button', { name: /rondleiding starten|start tour|commencer la visite|rundgang starten|hervatten|resume|reprendre|fortsetzen/i });
      await expect(startTour).toBeVisible();
      await testInfo.attach(`${role.toLowerCase()}-tour-chapters.json`, { body: JSON.stringify({ role, trainingStatus: trainingResponse?.status(), chapters: chapterNames }, null, 2), contentType: 'application/json' });
      console.log(`[${role}] Tour chapter inventory (${chapterNames.length}): ${JSON.stringify(chapterNames)}`);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-training-index.png`), fullPage: true });
      await startTour.click();
      await page.waitForTimeout(600);
      console.log(`[${role}] Tour start URL: ${page.url()}`);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-tour-start.png`), fullPage: true });
      await expect(page.locator('body')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-post-login.png`), fullPage: true });
      if (errors.length) console.error(`[${role}] Uncaught exceptions with stacks:\n${errors.join('\n---\n')}`);
      expect(errors, 'Uncaught browser exceptions').toEqual([]);
    });
  }
});
