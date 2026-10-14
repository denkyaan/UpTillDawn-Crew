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
      await emailInput.fill(email!);
      await passwordInput.fill(password!);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-login.png`), fullPage: true });
      const submit = page.getByRole('button', { name: /inloggen|login|sign in|connexion|anmelden/i });
      await expect(submit).toBeVisible();
      await submit.click();
      await expect(page.locator('body')).not.toContainText(/invalid login credentials|ongeldige inloggegevens/i);
      await page.screenshot({ path: testInfo.outputPath(`${role.toLowerCase()}-post-login.png`), fullPage: true });
      if (errors.length) console.error(`[${role}] Uncaught exceptions with stacks:\n${errors.join('\n---\n')}`);
      expect(errors, 'Uncaught browser exceptions').toEqual([]);
    });
  }
});
