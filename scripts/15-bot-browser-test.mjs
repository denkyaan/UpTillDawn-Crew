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

const roleSmokeRoutes = {
  admin: ['/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat', '/operations'],
  responsible: ['/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat'],
  staff: ['/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat'],
}

async function assertProtectedRoute(context, route, bot) {
  const response = await context.request.get(`${baseUrl}${route}`, {
    maxRedirects: 0,
    timeout: 45000,
  })
  const location = response.headers().location || ''
  if (response.status() >= 300 && response.status() < 400) {
    const path = location ? new URL(location, baseUrl).pathname : ''
    // Role/shift gating may intentionally send operational pages back to the
    // authenticated events screen. A login redirect means the session failed.
    if (path.startsWith('/login')) {
      throw new Error(`${bot} lost authentication on ${route}: HTTP ${response.status()} -> ${location}`)
    }
    return
  }
  if (!response.ok()) {
    throw new Error(`${bot} ${route} HTTP ${response.status()}`)
  }
}
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

      // Smoke the real protected workflow surfaces with the same authenticated
      // browser context. The SQL full-event suite separately performs the
      // transactional 15-actor event/workplace/shift/availability simulation.
      for (const route of roleSmokeRoutes[role]) {
        // bot03 owns the strict briefing lifecycle fixture below. Do not visit
        // /briefings in the generic smoke pass first: assertProtectedRoute uses
        // a separate page/context surface and can exercise form semantics before
        // the explicit acknowledgement proof runs.
        if (index === 2 && route === '/briefings') continue
        await assertProtectedRoute(context, route, bot)
      }

      // One staff bot performs a real browser mutation against the isolated
      // event fixture. This proves a hydrated server-action form can change
      // event availability through the production UI contract.
      if (index === 2) {
        await page.goto(`${baseUrl}/events?event=00000000-0000-4000-8000-00000000e2e1`, {
          waitUntil: 'networkidle',
          timeout: 45000,
        })
        const form = page.locator('form').filter({ has: page.locator('input[name="response"][value="can"]') }).first()
        if (await form.count() !== 1) throw new Error('availability action form missing')
        await form.locator('input[name="response"][value="can"]').check()
        await form.locator('input[name="setup_available"][value="yes"]').check()
        await form.locator('input[name="breakdown_available"][value="yes"]').check()
        const [actionResponse] = await Promise.all([
          page.waitForResponse(
            response => response.request().method() === 'POST' && response.url().includes('/events'),
            { timeout: 30000 },
          ),
          form.locator('button').last().click(),
        ])
        if (!actionResponse.ok()) {
          throw new Error(`availability server action failed with HTTP ${actionResponse.status()}`)
        }
        await page.reload({ waitUntil: 'networkidle', timeout: 45000 })
        const persistedForm = page.locator('form').filter({ has: page.locator('input[name="response"][value="can"]') }).first()
        const persistedCan = await persistedForm.locator('input[name="response"][value="can"]').isChecked()
        const persistedSetup = await persistedForm.locator('input[name="setup_available"][value="yes"]').isChecked()
        const persistedBreakdown = await persistedForm.locator('input[name="breakdown_available"][value="yes"]').isChecked()
        if (!persistedCan || !persistedSetup || !persistedBreakdown) {
          throw new Error('availability server action did not persist all selected values')
        }

        await page.goto(`${baseUrl}/briefings?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`, {
          waitUntil: 'networkidle',
          timeout: 45000,
        })
        const briefingArticle = page.locator('article').filter({ hasText: 'E2E Entrance Briefing' }).first()
        if (await briefingArticle.count() !== 1) throw new Error('briefing acknowledgement fixture missing')
        const acknowledgeForm = briefingArticle.locator('form').filter({ has: briefingArticle.locator('input[name="id"][value="00000000-0000-4000-8000-00000000e2e3"]') })
        if (await acknowledgeForm.count() !== 1) {
          const bodyText = (await briefingArticle.textContent()) || ''
          throw new Error(`briefing acknowledgement control missing before bot03 action: ${bodyText.slice(0, 240)}`)
        }
        const acknowledgeButton = acknowledgeForm.locator('button').first()
        if (await acknowledgeButton.count() !== 1) throw new Error('briefing acknowledgement button missing')
        const [briefingResponse] = await Promise.all([
          page.waitForResponse(
            response => response.request().method() === 'POST' && response.url().includes('/briefings'),
            { timeout: 30000 },
          ),
          acknowledgeButton.click(),
        ])
        if (!briefingResponse.ok()) {
          throw new Error(`briefing acknowledgement server action failed with HTTP ${briefingResponse.status()}`)
        }
        await page.reload({ waitUntil: 'networkidle', timeout: 45000 })
        const persistedBriefing = page.locator('article').filter({ hasText: 'E2E Entrance Briefing' }).first()
        const persistedAckForm = persistedBriefing.locator('form').filter({ has: persistedBriefing.locator('input[name="id"][value="00000000-0000-4000-8000-00000000e2e3"]') })
        if (await persistedAckForm.count() !== 0) {
          const bodyText = (await persistedBriefing.textContent()) || ''
          throw new Error(`briefing acknowledgement UI readback missing after reload: ${bodyText.slice(0, 240)}`)
        }

        await page.goto(`${baseUrl}/guestlist?event=00000000-0000-4000-8000-00000000e2e1`, {
          waitUntil: 'networkidle',
          timeout: 45000,
        })
        const guest = page.locator('article').filter({ hasText: 'E2E Guest' }).first()
        if (await guest.count() !== 1) throw new Error('guestlist action fixture missing')
        const checkInButton = guest.locator('button[data-action="guestlist-check-in"]').first()
        if (await checkInButton.count() !== 1) throw new Error('guestlist check-in action missing')
        if (!(await checkInButton.isEnabled())) throw new Error('guestlist check-in action unexpectedly disabled')
        // A server-rendered button can be visible/enabled before React has attached
        // its onClick handler. Wait for hydration by proving a React-managed input responds.
        const guestSearch = page.locator('input[placeholder]').first()
        await guestSearch.fill('E2E Guest')
        await guest.getByText('E2E Guest', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
        const guestlistTrace = []
        const recordRequest = request => {
          if (request.method() === 'POST') guestlistTrace.push(`REQ ${request.method()} ${request.url()}`)
        }
        const recordResponse = response => {
          if (response.request().method() === 'POST') guestlistTrace.push(`RES ${response.status()} ${response.url()}`)
        }
        const recordConsole = message => guestlistTrace.push(`CONSOLE ${message.type()} ${message.text()}`)
        const recordPageError = error => guestlistTrace.push(`PAGEERROR ${error.message}`)
        page.on('request', recordRequest)
        page.on('response', recordResponse)
        page.on('console', recordConsole)
        page.on('pageerror', recordPageError)
        const guestlistRpc = page.waitForResponse(response =>
          response.request().method() === 'POST' &&
          response.url().includes('/rpc/upt_guestlist_checkin'),
          { timeout: 15000 },
        )
        await checkInButton.click()
        let guestlistResponse
        try {
          guestlistResponse = await guestlistRpc
        } catch (error) {
          const buttonState = await checkInButton.evaluate(button => ({
            disabled: button.disabled,
            action: button.getAttribute('data-action'),
            text: button.textContent,
          }))
          throw new Error(`guestlist RPC not observed after click; button=${JSON.stringify(buttonState)} trace=${guestlistTrace.slice(-20).join(' | ')} original=${error instanceof Error ? error.message : String(error)}`)
        } finally {
          page.off('request', recordRequest)
          page.off('response', recordResponse)
          page.off('console', recordConsole)
          page.off('pageerror', recordPageError)
        }
        const guestlistBody = await guestlistResponse.text()
        if (!guestlistResponse.ok()) {
          throw new Error(`guestlist RPC failed ${guestlistResponse.status()}: ${guestlistBody.slice(0, 500)}`)
        }
        try {
          await guest.getByText('1/2', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
        } catch {
          const guestText = (await guest.textContent()) || ''
          const pageText = (await page.locator('body').textContent()) || ''
          throw new Error(`guestlist RPC succeeded but UI did not reach 1/2; rpc=${guestlistBody.slice(0, 240)} guest=${guestText.slice(0, 240)} page=${pageText.slice(-400)}`)
        }
        await page.reload({ waitUntil: 'networkidle', timeout: 45000 })
        const persistedGuest = page.locator('article').filter({ hasText: 'E2E Guest' }).first()
        if (!(await persistedGuest.getByText('1/2', { exact: true }).isVisible())) {
          throw new Error('guestlist check-in did not persist after reload')
        }
      }

      console.log(`PASS ${bot} authenticated + workflow surfaces ${viewport.width}x${viewport.height}`)
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

console.log('PASS: 15 concurrent authenticated browser bots + protected event workflow surfaces across Admin/Responsible/Staff, NL/FR/EN/DE and mobile/tablet/desktop viewports')
