import { test, expect } from '@playwright/test';

/**
 * Destructive staging acceptance: explicitly opt in, use dedicated credentials
 * and an isolated disposable database. Never execute against production.
 */
test.describe('Admin event creation acceptance (isolated staging only)', () => {
  test('creates a synthetic event through the real admin UI', async ({ page }, testInfo) => {
    const base = process.env.E2E_BASE_URL;
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(process.env.E2E_MUTATION_ISOLATED !== 'true', 'BLOCKED: disposable staging database not explicitly confirmed');
    test.skip(!base || !email || !password, 'BLOCKED: isolated staging URL/admin credentials missing');
    const origin = new URL(base!).origin;
    expect(new URL(base!).hostname).toBe('uptilldawn-crew-staging.uptilldawn.workers.dev');
    const name = `E2E-ADMIN-${testInfo.workerIndex}-${Date.now()}`;
    await page.goto(new URL('/login/admin', origin).toString());
    await page.locator('input[type="email"], input[name="email"]').first().fill(email!);
    await page.locator('input[type="password"]').first().fill(password!);
    await page.getByRole('button', { name: /inloggen|login|sign in|connexion|anmelden/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).not.toMatch(/^\/login\//);
    await page.goto(new URL('/events', origin).toString());
    const form = page.locator('form#event-aanmaken');
    await expect(form, 'Admin must have access to event creation').toBeVisible();
    await form.locator('input[name="name"]').fill(name);
    await form.getByRole('button', { name: /evenement aanmaken/i }).click();
    await expect(page.getByText(name, { exact: true }).first(), 'Event must be persisted and displayed after submission').toBeVisible({ timeout: 30000 });
    await testInfo.attach('synthetic-admin-event.json', {
      body: JSON.stringify({ name, path: new URL(page.url()).pathname, result: 'created-and-visible', cleanup: 'disposable-database-reset-required' }, null, 2),
      contentType: 'application/json',
    });
  });
});
