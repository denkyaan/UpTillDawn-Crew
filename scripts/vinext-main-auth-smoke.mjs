// Isolated local vinext compatibility proof. No deployments or app-data writes.
// Uses the same existing seven QA identities, on localhost only.
// Actual Workers Free CPU / end-to-end production parity still need separate proof.
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:8788'
const password = process.env.MAIN_QA_BOT_PASSWORD
if (process.env.VINEXT_AUTH_POC_BASE_URL !== BASE || !password || password.length < 24) {
  throw Error('Local-only vinext authentication QA requires localhost URL and configured 24+ character secret')
}

const roles = [
  { key: 'head_admin', email: 'e2e-head-admin@uptilldawn.test', portal: 'admin', allowed: '/admin' },
  { key: 'left_hand', email: 'e2e-admin@uptilldawn.test', portal: 'administration', allowed: '/portals/administration' },
  { key: 'right_hand', email: 'e2e-right-hand@uptilldawn.test', portal: 'administration', allowed: '/portals/administration' },
  { key: 'administration', email: 'e2e-administration@uptilldawn.test', portal: 'administration', allowed: '/portals/administration' },
  { key: 'promotion', email: 'e2e-promotion@uptilldawn.test', portal: 'promotion', allowed: '/portals/promotion' },
  { key: 'responsible', email: 'e2e-responsible@uptilldawn.test', portal: 'responsible', allowed: '/events' },
  { key: 'staff', email: 'e2e-staff@uptilldawn.test', portal: 'staff', allowed: '/events' },
]

let passed = 0
const failures = []
const browser = await chromium.launch({ headless: true })

async function assertRole(role, index) {
  const context = await browser.newContext({
    locale: ['nl-BE', 'fr-BE', 'en-GB', 'de-DE'][index % 4],
    viewport: index % 2 ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(25000)
    const login = await page.goto(BASE + '/login/' + role.portal, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (login?.status() !== 200) throw Error('Login shell HTTP ' + (login?.status() ?? 'none'))
    const form = page.locator('form[data-login-hydrated="true"]')
    await form.waitFor({ timeout: 25000 })
    await form.locator('[name=email]').fill(role.email)
    await form.locator('[name=password]').fill(password)
    await form.locator('button[type=submit]').click()
    try {
      await page.waitForURL(target => !target.pathname.startsWith('/login'), { waitUntil: 'commit', timeout: 25000 })
    } catch {
      const code = await page.locator('[data-login-error-code]').first().getAttribute('data-login-error-code').catch(() => null)
      throw Error('Login did not reach a protected route' + (code ? '; code=' + code : ''))
    }
    const cookieNames = (await context.cookies(BASE)).map(cookie => cookie.name)
    if (!cookieNames.some(name => /^sb-[a-z0-9]+-auth-token(?:\\.\\d+)?$/i.test(name))) {
      throw Error('Supabase authenticated session cookie missing')
    }
    const response = await page.goto(BASE + role.allowed, { waitUntil: 'commit', timeout: 30000 })
    if ((response?.status() ?? 503) >= 500) throw Error('Protected page HTTP ' + response.status())
    const actual = new URL(page.url()).pathname
    if (!actual.startsWith(role.allowed)) {
      throw Error('Authenticated role route rejected; redirected to ' + actual)
    }
    if (role.key === 'promotion' || role.key === 'staff') {
      const forbidden = await page.goto(BASE + '/god-mode', { waitUntil: 'commit', timeout: 30000 })
      if ((forbidden?.status() ?? 503) >= 500) throw Error('Forbidden route returned HTTP ' + forbidden.status())
      const deniedPath = new URL(page.url()).pathname
      if (deniedPath === '/god-mode') throw Error('Non-owner reached Maker route')
    }
    passed++
    console.log('PASS vinext local role ' + role.key + ' login, session, route and access checks')
  } catch (error) {
    const safe = String(error?.message ?? error).split(password).join('[redacted]').slice(0, 250)
    failures.push({ role: role.key, error: safe })
    console.error('FAIL vinext local role ' + role.key + ': ' + safe)
  } finally {
    await context.close()
  }
}

try {
  for (const [index, role] of roles.entries()) await assertRole(role, index)
} finally {
  await browser.close()
}
console.log('VINEXT_AUTH_PARITY: passed=' + passed + ' failed=' + failures.length + ' of=' + roles.length)
if (failures.length) process.exitCode = 1
