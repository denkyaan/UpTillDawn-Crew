import { chromium } from 'playwright'

const baseUrl = process.env.BOT_TEST_BASE_URL || 'http://127.0.0.1:3000'
const testPassword = process.env.BOT_TEST_PASSWORD
if (!testPassword) {
  console.error('BOT_TEST_PASSWORD is required')
  process.exit(1)
}

const roles = ['admin', 'responsible', ...Array(13).fill('staff')]
const locales = ['nl', 'fr', 'en', 'de']
const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]
const failures = []
const browser = await chromium.launch({ headless: true })

try {
  await Promise.all(roles.map(async (role, index) => {
    const locale = locales[index % locales.length]
    const viewport = viewports[index % viewports.length]
    const bot = `bot-${String(index + 1).padStart(2, '0')}-${role}-${locale}`
    const emailAddress = `${bot}@bots.uptilldawn.test`
    const expectedName = `E2E ${role.toUpperCase()} ${String(index + 1).padStart(2, '0')}`
    const context = await browser.newContext({ locale, viewport })
    const page = await context.newPage()

    try {
      const response = await page.goto(`${baseUrl}/login/${role}`, {
        waitUntil: 'networkidle',
        timeout: 45000,
      })
      if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`)

      const email = page.locator('input[name="email"]')
      const password = page.locator('input[name="password"]')
      if (await email.count() !== 1 || await password.count() !== 1) {
        throw new Error('login controls missing')
      }

      await email.fill(emailAddress)
      await password.fill(testPassword)

      if (role === 'admin') {
        // The admin login is a native POST route. Use the BrowserContext request
        // client so we can assert the exact 303 contract without depending on
        // the data-heavy /admin page finishing a concurrent browser navigation.
        // BrowserContext.request shares cookies with the browser context, so the
        // following protected-page check still proves the real issued session.
        const adminResponse = await context.request.post(`${baseUrl}/api/auth/admin-login`, {
          form: {
            email: emailAddress,
            password: testPassword,
          },
          maxRedirects: 0,
          timeout: 45000,
        })
        const location = adminResponse.headers().location || ''
        const locationPath = location ? new URL(location, baseUrl).pathname : ''
        if (adminResponse.status() !== 303 || locationPath !== '/admin') {
          throw new Error(`admin login rejected: HTTP ${adminResponse.status()} -> ${location || 'no location'}`)
        }

        // Session persistence is asserted below through BrowserContext.request.
        // Keeping the admin page idle avoids turning dashboard rendering into
        // an authentication signal.
      } else {
        // Wait for client hydration before submitting. Without this barrier a
        // client-handled staff/responsible form can fall back to a native GET.
        await page.waitForTimeout(750)
        await page.locator('button[type="submit"]').click({ timeout: 15000 })
        await page.waitForURL(url => url.pathname === '/', { timeout: 45000 })
        await page.waitForLoadState('networkidle')
      }

      const body = await page.locator('body').innerText()
      if (!body.trim()) throw new Error('empty authenticated UI')
      if (/profiel kon niet worden geladen|account nog niet goedgekeurd/i.test(body)) {
        throw new Error('authenticated profile gate failed')
      }
      if (role !== 'admin' && !body.includes(expectedName)) {
        throw new Error('seeded profile did not render')
      }

      // Verify the issued auth cookies against a protected route without a
      // second browser navigation. Under 15-way concurrency Playwright can
      // transiently abort a page.goto while Next.js is still settling client
      // navigation; the shared BrowserContext request client tests the same
      // session contract deterministically.
      const eventsResponse = await context.request.get(`${baseUrl}/events`, {
        maxRedirects: 0,
        timeout: 45000,
      })
      if (eventsResponse.status() >= 300 && eventsResponse.status() < 400) {
        throw new Error(`authenticated session redirected: HTTP ${eventsResponse.status()} -> ${eventsResponse.headers().location || 'no location'}`)
      }
      if (!eventsResponse.ok()) throw new Error(`events HTTP ${eventsResponse.status()}`)

      console.log(`PASS ${bot} authenticated ${viewport.width}x${viewport.height}`)
    } catch (error) {
      failures.push(`${bot}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await context.close()
    }
  }))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('PASS: 15 concurrent authenticated browser bots across Admin/Responsible/Staff, NL/FR/EN/DE and mobile/tablet/desktop viewports')
