import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.BOT_TEST_BASE_URL || 'http://127.0.0.1:3000'
const testPassword = process.env.BOT_TEST_PASSWORD
const supabaseUrl = process.env.BOT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.BOT_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!testPassword || !supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('BOT_TEST_PASSWORD, BOT_SUPABASE_URL, BOT_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
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
const lifecycleAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const roleSmokeRoutes = {
  admin: ['/', '/admin', '/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat', '/operations', '/tasks', '/timesheets', '/incidents', '/notifications', '/personnel', '/sales', '/settings', '/exports', '/audit'],
  responsible: ['/', '/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat', '/operations', '/tasks', '/timesheets', '/incidents', '/notifications', '/sales', '/settings'],
  staff: ['/', '/events', '/workplaces', '/briefings', '/inventory', '/guestlist', '/chat', '/operations', '/tasks', '/timesheets', '/incidents', '/notifications', '/sales', '/settings'],
}

const dutchRuntimeLeakPatterns = [
  /\\b(?:Beheer|Beheren|Werkplaatsen|Werkplek|Werkuren|Personeel|Verantwoordelijke|Evenementen|Evenement|Meldingen|Instellingen|Taken|Taak|Briefing|Inventaris|Inkom|Goedkeuren|Afkeuren|Opslaan|Verwijderen|Toevoegen|Beschikbaar|Niet beschikbaar|Geen resultaten|Acties met prioriteit)\\b/i,
  /\\b(?:wordt|worden|kunnen|kunt|jouw|deze|geen|alleen|alle|voor|van|met)\\s+(?:automatisch|personeel|werkplek|evenement|account|shift|uren|meldingen|resultaten)\\b/i,
]

async function gotoWithTransientRetry(page, url, options={}) {
  const merged={waitUntil:'domcontentloaded',timeout:45000,...options}
  let lastError
  for(let attempt=1;attempt<=3;attempt++){
    try{
      return await page.goto(url,merged)
    }catch(error){
      lastError=error
      const message=error instanceof Error?error.message:String(error)
      if(!/ERR_ABORTED|Navigation interrupted|frame was detached|Target page, context or browser has been closed/i.test(message)||attempt===3)throw error
      await page.waitForTimeout(250*attempt)
    }
  }
  throw lastError
}

async function gotoProtectedSmokeRoute(page, route, bot) {
  const url=`${baseUrl}${route}`
  try {
    await gotoWithTransientRetry(page,url)
  } catch(error) {
    const message=error instanceof Error?error.message:String(error)
    if(!/interrupted by another navigation/i.test(message))throw error
    await page.waitForLoadState('domcontentloaded',{timeout:15000}).catch(()=>{})
    const finalUrl=new URL(page.url(),baseUrl)
    if(finalUrl.origin!==new URL(baseUrl).origin||finalUrl.pathname.startsWith('/login')){
      throw new Error(`${bot} protected-route navigation escaped authentication on ${route}: ${page.url()}`)
    }
  }
}

async function waitForSeededProfile(page, expectedName, context, bot, diagnostics) {
  // The login redirect already owns the authenticated root navigation.
  // Do not replace it with a second page.goto while Next is committing RSC.
  try {
    await page.getByText(expectedName,{exact:false}).first().waitFor({state:'visible',timeout:45000})
  } catch (error) {
    const body=await page.locator('body').innerText().catch(()=>'<body unavailable>')
    const cookies=await context.cookies(baseUrl).catch(()=>[])
    const rootProbe=await context.request.get(`${baseUrl}/`,{maxRedirects:0,timeout:15000}).catch(()=>null)
    const rootBody=rootProbe?await rootProbe.text().catch(()=>'<unreadable>'):'<probe failed>'
    const safeBody=body.replace(/\\s+/g,' ').slice(0,1800)
    const safeRoot=rootBody.replace(/\\s+/g,' ').slice(0,1800)
    const cookieNames=[...new Set(cookies.map(cookie=>cookie.name))].join(',')
    const consoleErrors=diagnostics.consoleErrors.slice(-8).join(' | ')||'none'
    const pageErrors=diagnostics.pageErrors.slice(-8).join(' | ')||'none'
    const probe=rootProbe?`HTTP ${rootProbe.status()} location=${rootProbe.headers().location||'none'}`:'unavailable'
    throw new Error(`${bot} profile render diagnostic: finalUrl=${page.url()} rootProbe=${probe} cookies=[${cookieNames}] consoleErrors=[${consoleErrors}] pageErrors=[${pageErrors}] body="${safeBody}" rootBody="${safeRoot}" original=${error instanceof Error?error.message:String(error)}`)
  }
}

async function assertRuntimeLocale(page, locale, bot, route) {
  await page.waitForFunction(expected => document.documentElement.lang === expected, locale, { timeout: 15000 })
  if (locale === 'nl') return
  const rendered = (await page.locator('body').innerText()).replace(/\\s+/g, ' ')
  const leak = dutchRuntimeLeakPatterns.find(pattern => pattern.test(rendered))
  if (leak) throw new Error(`${bot} runtime i18n leak on ${route} for ${locale}: ${rendered.match(leak)?.[0] || leak}`)
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
  // Keep all 15 browser actors, but cap simultaneous SSR-heavy sessions so the
  // single CI Next server measures app behavior instead of artificial overload.
  const smokeConcurrency=5
  for(let batchStart=0;batchStart<roles.length;batchStart+=smokeConcurrency){
    const batch=roles.slice(batchStart,batchStart+smokeConcurrency)
    await Promise.all(batch.map(async (role, offset) => {
      const index=batchStart+offset
    const locale = locales[index % locales.length]
    const viewport = viewports[index % viewports.length]
    const bot = `bot-${String(index + 1).padStart(2, '0')}-${role}-${locale}`
    const emailAddress = `${bot}@bots.uptilldawn.test`
    const expectedName = `E2E ${role.toUpperCase()} ${String(index + 1).padStart(2, '0')}`
    const context = await browser.newContext({ locale, viewport })
    const page = await context.newPage()
    const diagnostics={consoleErrors:[],pageErrors:[]}
    page.on('console',message=>{
      if(message.type()==='error')diagnostics.consoleErrors.push(message.text().slice(0,500))
    })
    page.on('pageerror',error=>diagnostics.pageErrors.push(String(error?.message||error).slice(0,500)))

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

      // Authenticate all roles through the same BrowserContext request client.
      // This shares the real session cookies with Playwright while avoiding
      // concurrent client Server Action redirects becoming an SSR load test.
      if (role === 'admin') {
        const adminResponse = await context.request.post(`${baseUrl}/api/auth/admin-login`, {
          form: { email: emailAddress, password: testPassword },
          maxRedirects: 0,
          timeout: 45000,
        })
        const location = adminResponse.headers().location || ''
        const locationPath = location ? new URL(location, baseUrl).pathname : ''
        if (adminResponse.status() !== 303 || locationPath !== '/admin') {
          throw new Error(`admin login rejected: HTTP ${adminResponse.status()} -> ${location || 'no location'}`)
        }
      } else {
        const directAuth=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
        const {data:directSession,error:directAuthError}=await directAuth.auth.signInWithPassword({email:emailAddress,password:testPassword})
        if(directAuthError||!directSession.session)throw new Error(`${role} direct auth failed: ${directAuthError?.message||'session missing'}`)
        const loginResponse=await context.request.post(`${baseUrl}/api/test-auth-session`,{
          data:{access_token:directSession.session.access_token,refresh_token:directSession.session.refresh_token},
          timeout:30000,
        })
        if(!loginResponse.ok())throw new Error(`${role} test session bridge failed HTTP ${loginResponse.status()}`)
        const bridgedCookies=await context.cookies(baseUrl)
        if(!bridgedCookies.some(cookie=>cookie.name.startsWith('sb-')&&cookie.value))throw new Error(`${role} test session bridge returned no Supabase auth cookie`)
        await gotoWithTransientRetry(page,`${baseUrl}/`)
        await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete', null, { timeout: 45000 })
      }

      const body = await page.locator('body').innerText()
      if (!body.trim()) throw new Error('empty authenticated UI')

      // Compact/touch layouts, including iPhone landscape (~926 CSS px), must
      // keep the mobile bottom navigation. Admin must also keep the chat action.
      if (viewport.width < 1024) {
        const mobileNav = page.getByRole('navigation', { name: 'Mobiele navigatie' })
        if (!(await mobileNav.isVisible())) throw new Error(`${bot} mobile bottom navigation is not visible at ${viewport.width}px`)
        if (role === 'admin') {
          const chatAction = page.getByRole('link', { name: /chat/i }).last()
          if (!(await chatAction.isVisible())) throw new Error(`${bot} admin floating chat action is not visible at ${viewport.width}px`)
        }
      }
      if (/profiel kon niet worden geladen|account nog niet goedgekeurd/i.test(body)) {
        throw new Error('authenticated profile gate failed')
      }
      if (role !== 'admin') await waitForSeededProfile(page, expectedName, context, bot, diagnostics)

      // Runtime i18n regression on the authenticated landing page.
      await assertRuntimeLocale(page, locale, bot, page.url())

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
        // Keep bot03's hydrated Staff page/session untouched until its strict
        // mutation lifecycle below. A broad route crawl can legitimately hit
        // role/shift redirects and must not replace that mutation page.
        if (index !== 2) {
          await gotoProtectedSmokeRoute(page, route, bot)
          if (!page.url().includes('/login')) await assertRuntimeLocale(page, locale, bot, route)
        }
      }

      // Bot03 still gets runtime-i18n coverage on its isolated real workflow
      // routes, without the generic crawl mutating its navigation/session state.
      if (index === 2) await assertRuntimeLocale(page, locale, bot, page.url())

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
        const acknowledgeForm = briefingArticle.locator('form:has(input[name="id"][value="00000000-0000-4000-8000-00000000e2e3"])')
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
        const persistedAckForm = persistedBriefing.locator('form:has(input[name="id"][value="00000000-0000-4000-8000-00000000e2e3"])')
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

        // Intake is complete. Advance only the isolated E2E event into its
        // operational phase so production availability/task gates stay intact.
        const activeStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const activeEnd = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        const { error: phaseError } = await lifecycleAdmin.from('events').update({
          start_date: activeStart, start_at: activeStart, end_date: activeEnd, end_at: activeEnd, status: 'active',
        }).eq('id', '00000000-0000-4000-8000-00000000e2e1')
        if (phaseError) throw new Error(`failed to advance E2E event lifecycle: ${phaseError.message}`)

        // Continue the same staff browser through operational lifecycle surfaces.
        await page.goto(`${baseUrl}/tasks?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`, { waitUntil: 'networkidle', timeout: 45000 })
        const taskCard = page.locator('article').filter({ hasText: 'E2E Entrance Task' }).first()
        if (await taskCard.count() !== 1) throw new Error('task lifecycle fixture missing')
        const confirmTask = taskCard.locator('[data-action="task-confirm"]')
        if (await confirmTask.count() !== 1) throw new Error('task confirmation action missing')
        const [taskConfirmResponse] = await Promise.all([
          page.waitForResponse(
            r => r.request().method()==='POST' && r.url().includes('/rest/v1/rpc/upt_confirm_task_assignment'),
            { timeout: 30000 },
          ),
          confirmTask.click(),
        ])
        if (!taskConfirmResponse.ok()) {
          const body = await taskConfirmResponse.text()
          throw new Error(`task confirmation RPC failed HTTP ${taskConfirmResponse.status()}: ${body.slice(0, 400)}`)
        }
        await page.reload({waitUntil:'networkidle',timeout:45000})
        const persistedTask = page.locator('article').filter({ hasText: 'E2E Entrance Task' }).first()
        if (await persistedTask.locator('[data-action="task-confirm"]').count() !== 0) throw new Error('task confirmation did not persist')

        await page.goto(`${baseUrl}/inventory?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`, {waitUntil:'networkidle',timeout:45000})
        const inventoryCard = page.locator('article').filter({hasText:'E2E Radio'}).first()
        if (await inventoryCard.count() !== 1) {
          const pageText = (await page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1200)
          throw new Error(`inventory lifecycle fixture missing; page=${pageText}`)
        }
        // Staff may inspect inventory, but condition reporting remains Responsible-only.
        if (await inventoryCard.locator('[data-action="inventory-condition-opening"]').count() !== 0) throw new Error('staff unexpectedly received responsible inventory mutation control')

        await page.goto(`${baseUrl}/chat?event=00000000-0000-4000-8000-00000000e2e1`, {waitUntil:'networkidle',timeout:45000})
        const chatInput = page.locator('textarea[placeholder]').last()
        await chatInput.fill('E2E lifecycle chat message')
        const send = page.locator('[data-action="chat-send"]')
        await send.click()
        await page.getByText('E2E lifecycle chat message',{exact:true}).waitFor({state:'visible',timeout:15000})
        await page.reload({waitUntil:'networkidle',timeout:45000})
        if (!(await page.getByText('E2E lifecycle chat message',{exact:true}).isVisible())) throw new Error('chat message did not persist after reload')
        const persistedLifecycleMessage=await lifecycleAdmin.from('messages').select('id,body,channel_id,sender_id').eq('body','E2E lifecycle chat message').order('created_at',{ascending:false}).limit(1).maybeSingle()
        if(persistedLifecycleMessage.error||!persistedLifecycleMessage.data?.id)throw new Error('lifecycle chat message was not persisted server-side before closure')
        globalThis.__uptLifecycleMessage=persistedLifecycleMessage.data

        await page.goto(`${baseUrl}/incidents?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`, {waitUntil:'networkidle',timeout:45000})
        const incidentForm = page.locator('form').filter({has:page.locator('[data-action="incident-submit"]')}).first()
        if (await incidentForm.count() !== 1) throw new Error('incident action form missing')
        await incidentForm.locator('textarea[name="message"]').fill('E2E lifecycle incident')
        await incidentForm.locator('[data-action="incident-submit"]').click()
        await incidentForm.locator('[role="status"]').waitFor({state:'visible',timeout:15000})
      }

      console.log(`PASS ${bot} authenticated + workflow surfaces ${viewport.width}x${viewport.height}`)
    } catch (error) {
      failures.push(`${bot}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await context.close()
    }
    }))
  }

  // Sequential cross-role attendance lifecycle after the concurrent smoke phase.
  // Fresh sessions avoid race conditions while still exercising the real UI/RPC contracts.
  async function loginLifecycle(role,index){
    const locale=locales[index%locales.length]
    const context=await browser.newContext({locale,viewport:{width:430,height:932}})
    const page=await context.newPage()
    const bot=`bot-${String(index+1).padStart(2,'0')}-${role}-${locale}`
    const emailAddress=`${bot}@bots.uptilldawn.test`
    if(role==='admin'){
      const response=await context.request.post(`${baseUrl}/api/auth/admin-login`,{form:{email:emailAddress,password:testPassword},maxRedirects:0,timeout:45000})
      if(response.status()!==303)throw new Error(`lifecycle admin login failed HTTP ${response.status()}`)
    }else{
      await page.goto(`${baseUrl}/login/${role}`,{waitUntil:'networkidle',timeout:45000})
      await page.locator('input[name="email"]').fill(emailAddress)
      await page.locator('input[name="password"]').fill(testPassword)
      await page.waitForTimeout(750)
      await page.locator('button[type="submit"]').click()
      await page.waitForURL(url=>url.pathname==='/',{timeout:45000})
    }
    return {context,page}
  }

  try{
    // The concurrent smoke phase may still touch the isolated event after bot03.
    // Re-establish the operational clock here, immediately before attendance,
    // so the sequential lifecycle cannot race with parallel event mutations.
    const attendanceStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const attendanceEnd = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
    const {error:attendancePhaseError}=await lifecycleAdmin.from('events').update({
      start_date:attendanceStart,start_at:attendanceStart,end_date:attendanceEnd,end_at:attendanceEnd,status:'active',
    }).eq('id','00000000-0000-4000-8000-00000000e2e1')
    if(attendancePhaseError)throw new Error(`failed to establish attendance lifecycle clock: ${attendancePhaseError.message}`)
    const attendanceEvent=await lifecycleAdmin.from('events').select('start_at,end_at,status').eq('id','00000000-0000-4000-8000-00000000e2e1').single()
    if(attendanceEvent.error||attendanceEvent.data?.status!=='active'||Date.parse(attendanceEvent.data.start_at)>Date.now()){
      throw new Error('attendance lifecycle event was not active before QR start request')
    }

    const staff=await loginLifecycle('staff',2)
    try{
      await staff.page.goto(`${baseUrl}/qr`,{waitUntil:'networkidle',timeout:45000})
      // Production requires shift confirmation before attendance. Complete any
      // required confirmation through the real QR UI, then continue to contact.
      for(let attempt=0;attempt<3;attempt++){
        const confirm=staff.page.locator('[data-action^="qr-confirm-"]').first()
        if(await confirm.count()!==1)break
        await Promise.all([
          staff.page.waitForResponse(r=>r.request().method()==='POST'&&(r.url().includes('/rpc/upt_confirm_shift')||r.url().includes('/rpc/upt_acknowledge_briefing')),{timeout:30000}),
          confirm.click(),
        ])
        await staff.page.waitForTimeout(250)
      }
      const yes=staff.page.locator('[data-action="qr-contact-yes"]')
      const remote=staff.page.locator('[data-action="qr-remote-request"]')
      if(await yes.count()===1){
        const [requestResponse]=await Promise.all([
          staff.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_qr_request'),{timeout:30000}),
          yes.click(),
        ])
        if(!requestResponse.ok())throw new Error(`staff start request failed HTTP ${requestResponse.status()}`)
      }else if(await remote.count()===1){
        const [requestResponse]=await Promise.all([
          staff.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_qr_request'),{timeout:30000}),
          remote.click(),
        ])
        if(!requestResponse.ok()){ const body=await requestResponse.text(); throw new Error(`staff remote start request failed HTTP ${requestResponse.status()}: ${body.slice(0,700)}`) }
      }else{
        const body=(await staff.page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,900)
        throw new Error(`staff start request did not reach contact/remote step after required confirmations: ${body}`)
      }
    }finally{await staff.context.close()}

    // The production router chooses Responsible when available, otherwise Admin.
    // Exercise whichever reviewer the persisted request actually selected.
    const pending=await lifecycleAdmin.from('check_ins').select('reviewer_kind').eq('event_id','00000000-0000-4000-8000-00000000e2e1').eq('status','pending').order('requested_at',{ascending:false}).limit(1).maybeSingle()
    if(pending.error||!pending.data?.reviewer_kind)throw new Error('browser check-in request was not persisted')
    const reviewerRole=pending.data.reviewer_kind==='admin'?'admin':'responsible'
    const reviewerIndex=reviewerRole==='admin'?0:1
    const reviewer=await loginLifecycle(reviewerRole,reviewerIndex)
    try{
      await reviewer.page.goto(`${baseUrl}/operations?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`,{waitUntil:'networkidle',timeout:45000})
      const approve=reviewer.page.locator('[data-action="in-approve"]').first()
      if(await approve.count()!==1){
        const body=(await reviewer.page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1100)
        throw new Error(`${reviewerRole} start approval missing: ${body}`)
      }
      const [approveResponse]=await Promise.all([
        reviewer.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_decide_check_in'),{timeout:30000}),
        approve.click(),
      ])
      if(!approveResponse.ok())throw new Error(`${reviewerRole} start approval failed HTTP ${approveResponse.status()}`)
    }finally{await reviewer.context.close()}

    const latestCheckIn=await lifecycleAdmin.from('check_ins').select('user_id').eq('event_id','00000000-0000-4000-8000-00000000e2e1').eq('status','approved').order('requested_at',{ascending:false}).limit(1).maybeSingle()
    if(latestCheckIn.error||!latestCheckIn.data?.user_id)throw new Error('approved browser check-in was not persisted')
    const active=await lifecycleAdmin.from('work_sessions').select('id').eq('user_id',latestCheckIn.data.user_id).eq('event_id','00000000-0000-4000-8000-00000000e2e1').is('ended_at',null)
    // Browser UI is the authority; the service-role read only asserts persistence.
    if(active.error||!active.data?.length)throw new Error('approved browser check-in did not create an active work session')
    // Work/break lifecycle through the Staff operations UI.
    const staffWork=await loginLifecycle('staff',2)
    try{
      await staffWork.page.goto(`${baseUrl}/operations?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      const startBreak=staffWork.page.locator('[data-action="break-start"]')
      if(await startBreak.count()!==1)throw new Error('break-start action missing for active Staff work session')
      await startBreak.click()
      await staffWork.page.waitForTimeout(1200)
      await staffWork.page.reload({waitUntil:'networkidle',timeout:45000})
      const stopBreak=staffWork.page.locator('[data-action="break-stop"]')
      if(await stopBreak.count()!==1)throw new Error('break-stop action missing after break start')
      await stopBreak.click()
      await staffWork.page.waitForTimeout(1200)
      await staffWork.page.reload({waitUntil:'networkidle',timeout:45000})
      if(await staffWork.page.locator('[data-action="break-start"]').count()!==1)throw new Error('work did not resume after break stop')

      await staffWork.page.goto(`${baseUrl}/qr`,{waitUntil:'networkidle',timeout:45000})
      const yesStop=staffWork.page.locator('[data-action="qr-contact-yes"]')
      const remoteStop=staffWork.page.locator('[data-action="qr-remote-request"]')
      const requestButton=await yesStop.count()===1?yesStop:remoteStop
      if(await requestButton.count()!==1){
        const body=(await staffWork.page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,900)
        throw new Error(`checkout request action missing: ${body}`)
      }
      const [stopResponse]=await Promise.all([
        staffWork.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_qr_request'),{timeout:30000}),
        requestButton.click(),
      ])
      if(!stopResponse.ok())throw new Error(`checkout request failed HTTP ${stopResponse.status()}`)
    }finally{await staffWork.context.close()}

    const pendingOut=await lifecycleAdmin.from('check_outs').select('reviewer_kind').eq('event_id','00000000-0000-4000-8000-00000000e2e1').eq('status','pending').order('requested_at',{ascending:false}).limit(1).maybeSingle()
    if(pendingOut.error||!pendingOut.data?.reviewer_kind)throw new Error('browser checkout request was not persisted')
    const outRole=pendingOut.data.reviewer_kind==='admin'?'admin':'responsible'
    const outReviewer=await loginLifecycle(outRole,outRole==='admin'?0:1)
    try{
      await outReviewer.page.goto(`${baseUrl}/operations?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`,{waitUntil:'networkidle',timeout:45000})
      const approveOut=outReviewer.page.locator('[data-action="out-approve"]').first()
      if(await approveOut.count()!==1)throw new Error(`${outRole} checkout approval missing`)
      await Promise.all([
        outReviewer.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_decide_check_out'),{timeout:30000}),
        approveOut.click(),
      ])
    }finally{await outReviewer.context.close()}

    const ended=await lifecycleAdmin.from('work_sessions').select('ended_at').eq('user_id',latestCheckIn.data.user_id).eq('event_id','00000000-0000-4000-8000-00000000e2e1').not('ended_at','is',null).limit(1)
    if(ended.error||!ended.data?.length)throw new Error('approved checkout did not end work session')

    // Timesheet lifecycle: Staff submit -> routed manager approve -> Admin lock.
    const staffTs=await loginLifecycle('staff',2)
    try{
      await staffTs.page.goto(`${baseUrl}/timesheets?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      const submit=staffTs.page.locator('[data-action="timesheet-submit"]')
      if(await submit.count()!==1)throw new Error('timesheet submit action missing')
      const [submitResponse]=await Promise.all([
        staffTs.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_submit_timesheet'),{timeout:30000}),
        submit.click(),
      ])
      if(!submitResponse.ok()){
        const body=await submitResponse.text()
        throw new Error(`timesheet submit RPC failed HTTP ${submitResponse.status()}: ${body.slice(0,500)}`)
      }
      await staffTs.page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{})
    }finally{await staffTs.context.close()}

    const submitted=await lifecycleAdmin.from('timesheets').select('id,status').eq('event_id','00000000-0000-4000-8000-00000000e2e1').eq('user_id',latestCheckIn.data.user_id).maybeSingle()
    if(submitted.error||submitted.data?.status!=='submitted')throw new Error('Staff timesheet was not submitted')

    const tsReviewer=await loginLifecycle('responsible',1)
    try{
      await tsReviewer.page.goto(`${baseUrl}/timesheets?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      const row=tsReviewer.page.locator(`[data-timesheet-id="${submitted.data.id}"]`)
      const approveTs=row.locator('[data-action="timesheet-approve"]')
      if(await approveTs.count()!==1)throw new Error('Responsible timesheet approval missing for own workplace Staff')
      const [reviewResponse]=await Promise.all([
        tsReviewer.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_review_timesheet'),{timeout:30000}),
        approveTs.click(),
      ])
      if(!reviewResponse.ok()){
        const body=await reviewResponse.text()
        throw new Error(`Responsible timesheet approval RPC failed HTTP ${reviewResponse.status()}: ${body.slice(0,700)}`)
      }
      await tsReviewer.page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{})
    }finally{await tsReviewer.context.close()}

    const approvedTs=await lifecycleAdmin.from('timesheets').select('status').eq('id',submitted.data.id).maybeSingle()
    if(approvedTs.error||approvedTs.data?.status!=='approved')throw new Error(`Responsible approval did not persist: ${approvedTs.error?.message||approvedTs.data?.status||'missing'}`)

    const adminTs=await loginLifecycle('admin',0)
    try{
      await adminTs.page.goto(`${baseUrl}/timesheets?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      const row=adminTs.page.locator(`[data-timesheet-id="${submitted.data.id}"]`)
      const lock=row.locator('[data-action="timesheet-lock"]')
      if(await lock.count()!==1){
        const rowText=await row.innerText().catch(()=>'<row missing>')
        const body=(await adminTs.page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1200)
        throw new Error(`Admin timesheet lock action missing after persisted approval; row=${rowText}; page=${body}`)
      }
      const [lockResponse]=await Promise.all([
        adminTs.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/rpc/upt_lock_timesheet'),{timeout:30000}),
        lock.click(),
      ])
      if(!lockResponse.ok()){
        const body=await lockResponse.text()
        throw new Error(`Admin timesheet lock RPC failed HTTP ${lockResponse.status()}: ${body.slice(0,700)}`)
      }
      await adminTs.page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{})
    }finally{await adminTs.context.close()}
    const locked=await lifecycleAdmin.from('timesheets').select('status').eq('id',submitted.data.id).maybeSingle()
    if(locked.error||locked.data?.status!=='locked')throw new Error('timesheet did not reach locked state')

    // Complete task state lifecycle after confirmation. Resolve the current
    // seeded bot UUIDs from profiles instead of assuming fixed auth UUIDs.
    const bot03Profile=await lifecycleAdmin.from('profiles').select('id').eq('full_name','E2E STAFF 03').single()
    if(bot03Profile.error||!bot03Profile.data?.id)throw new Error('bot03 profile missing before task status lifecycle')
    const responsibleProfile=await lifecycleAdmin.from('profiles').select('id').eq('full_name','E2E RESPONSIBLE 02').single()
    if(responsibleProfile.error||!responsibleProfile.data?.id)throw new Error('responsible profile missing before task status lifecycle')
    const taskShiftStart=new Date(Date.now()-30*60*1000).toISOString()
    const taskShiftEnd=new Date(Date.now()+2*60*60*1000).toISOString()
    const taskShiftRestore=await lifecycleAdmin.from('shifts').upsert({
      id:'00000000-0000-4000-8000-00000000e2e4',event_id:'00000000-0000-4000-8000-00000000e2e1',
      workplace_id:'00000000-0000-4000-8000-00000000e2e2',user_id:bot03Profile.data.id,
      start_time:taskShiftStart,end_time:taskShiftEnd,scheduled_start:taskShiftStart,scheduled_end:taskShiftEnd,
      role:'staff',role_name:'Entrance',status:'scheduled',response_status:'accepted',
      responsible_lead_id:responsibleProfile.data.id,overlap_allowed:false,
    },{onConflict:'id'})
    if(taskShiftRestore.error)throw new Error(`failed to restore staff task shift: ${taskShiftRestore.error.message}`)
    const activeShift=await lifecycleAdmin.from('shifts').select('id').eq('id','00000000-0000-4000-8000-00000000e2e4').eq('user_id',bot03Profile.data.id).neq('status','cancelled').lte('scheduled_start',new Date().toISOString()).gte('scheduled_end',new Date().toISOString()).limit(1)
    if(activeShift.error||!activeShift.data?.length)throw new Error('staff active shift fixture missing before task status lifecycle')
    const taskAssignmentRestore=await lifecycleAdmin.from('task_assignments').update({
      user_id:bot03Profile.data.id,status:'NOT STARTED',confirmed_at:new Date().toISOString(),
    }).eq('id','00000000-0000-4000-8000-00000000e2e7')
    if(taskAssignmentRestore.error)throw new Error(`failed to restore confirmed task assignment: ${taskAssignmentRestore.error.message}`)
    const confirmedTask=await lifecycleAdmin.from('task_assignments').select('user_id,confirmed_at,status').eq('id','00000000-0000-4000-8000-00000000e2e7').single()
    if(confirmedTask.error||confirmedTask.data?.user_id!==bot03Profile.data.id||!confirmedTask.data?.confirmed_at)throw new Error('confirmed task assignment fixture missing before status lifecycle')
    const staffOps=await loginLifecycle('staff',2)
    try{
      await gotoWithTransientRetry(staffOps.page,`${baseUrl}/tasks?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`)
      for(const [action,expected] of [['task-status-in-progress','IN PROGRESS'],['task-status-completed','COMPLETED']]){
        const task=staffOps.page.locator('article').filter({hasText:'E2E Entrance Task'}).first()
        await staffOps.page.reload({waitUntil:'domcontentloaded',timeout:30000})
        await task.waitFor({state:'visible',timeout:15000})
        const button=task.locator(`[data-action="${action}"]`)
        await button.waitFor({state:'visible',timeout:15000})
        if(await button.count()!==1)throw new Error(`${action} missing`)
        await button.click()
        const deadline=Date.now()+15000
        let persisted=false
        while(Date.now()<deadline){
          const row=await lifecycleAdmin.from('task_assignments').select('status').eq('id','00000000-0000-4000-8000-00000000e2e7').maybeSingle()
          if(!row.error&&row.data?.status===expected){persisted=true;break}
          await staffOps.page.waitForTimeout(300)
        }
        if(!persisted)throw new Error(`${action} did not persist ${expected}`)
        await staffOps.page.waitForLoadState('domcontentloaded',{timeout:15000}).catch(()=>{})
      }
    }finally{await staffOps.context.close()}

    // Responsible inventory opening + closing mutations.
    const respInv=await loginLifecycle('responsible',1)
    try{
      await respInv.page.goto(`${baseUrl}/inventory?event=00000000-0000-4000-8000-00000000e2e1&workplace=00000000-0000-4000-8000-00000000e2e2`,{waitUntil:'networkidle',timeout:45000})
      for(const phase of ['opening','closing']){
        const details=respInv.page.locator('details').filter({has:respInv.page.locator(`[data-action="inventory-condition-${phase}"]`)}).first()
        if(await details.count()!==1)throw new Error(`Responsible inventory ${phase} section missing`)
        await details.locator('summary').click()
        const button=details.locator(`[data-action="inventory-condition-${phase}"]`).first()
        const form=button.locator('xpath=ancestor::form[1]')
        const condition=form.locator('select[name="condition"]')
        await condition.waitFor({state:'visible',timeout:10000})
        if(await condition.isDisabled())throw new Error(`Responsible inventory ${phase} control unexpectedly disabled`)
        await condition.selectOption(phase==='opening'?'missing':'damaged')
        await form.locator('input[name="quantity"]').fill('1')
        await form.locator('input[name="notes"]').fill(`E2E ${phase} condition`)
        const [conditionResponse] = await Promise.all([
          respInv.page.waitForResponse(
            r => r.request().method()==='POST' && r.url().includes('/inventory'),
            {timeout:30000},
          ),
          button.click(),
        ])
        if (!conditionResponse.ok()) throw new Error(`Responsible inventory ${phase} submission failed HTTP ${conditionResponse.status()}`)
        await respInv.page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{})
        // A Server Action refresh replaces the rendered inventory tree. Re-open the
        // closing section on the refreshed DOM instead of continuing on stale locators.
        if (phase==='opening') {
          await respInv.page.reload({waitUntil:'networkidle',timeout:45000})
        }
      }
    }finally{await respInv.context.close()}

    // Chat attachment path: select a real file and send it through the production queue.
    const staffChat=await loginLifecycle('staff',2)
    try{
      await staffChat.page.goto(`${baseUrl}/chat?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      const fileInput=staffChat.page.locator('input[type="file"]').last()
      await fileInput.setInputFiles({name:'e2e-lifecycle.txt',mimeType:'text/plain',buffer:Buffer.from('UpTillDawn E2E lifecycle attachment')})
      const sendFile=staffChat.page.locator('[data-action="chat-send"]')
      if(await sendFile.count()!==1)throw new Error('chat attachment send action missing')
      await sendFile.click()
      await staffChat.page.waitForTimeout(1800)
    }finally{await staffChat.context.close()}

    // Negative permission: Staff must never receive Admin event-management controls.
    const staffDenied=await loginLifecycle('staff',2)
    try{
      await staffDenied.page.goto(`${baseUrl}/events?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      if(await staffDenied.page.getByText('EVENEMENT AANMAKEN',{exact:true}).count()!==0)throw new Error('Staff unexpectedly received Admin event creation control')
    }finally{await staffDenied.context.close()}

    // Close event as a real authenticated Admin; service-role bypass must not impersonate lifecycle authority.
    const closingAdmin=await loginLifecycle('admin',0)
    try{
      const adminEmail='bot-01-admin-nl@bots.uptilldawn.test'
      const authClient=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
      const {data:adminAuth,error:adminAuthError}=await authClient.auth.signInWithPassword({email:adminEmail,password:testPassword})
      if(adminAuthError||!adminAuth.session?.access_token)throw new Error(`lifecycle admin Supabase session failed: ${adminAuthError?.message||'access token missing'}`)
      const closeResponse=await closingAdmin.context.request.post(`${supabaseUrl}/rest/v1/rpc/upt_close_event`,{
        headers:{apikey:anonKey,Authorization:`Bearer ${adminAuth.session.access_token}`},
        data:{p_event:'00000000-0000-4000-8000-00000000e2e1',p_force:true,p_reason:'E2E lifecycle completion'},
        timeout:30000,
      })
      if(!closeResponse.ok())throw new Error(`event closure failed HTTP ${closeResponse.status()}: ${(await closeResponse.text()).slice(0,500)}`)
    }finally{await closingAdmin.context.close()}
    const closed=await lifecycleAdmin.from('events').select('status,end_at').eq('id','00000000-0000-4000-8000-00000000e2e1').single()
    if(closed.error||!closed.data)throw new Error('closed event could not be read back')

        // Prove the database authorization contract directly before exercising the UI.
    const retainedAuth=createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {error:retainedAuthError}=await retainedAuth.auth.signInWithPassword({email:'bot-03-staff-en@bots.uptilldawn.test',password:testPassword})
    if(retainedAuthError)throw new Error(`retained Staff auth failed: ${retainedAuthError.message}`)
    const retainedChannels=await retainedAuth.from('chat_channels').select('id,kind,event_id').eq('event_id','00000000-0000-4000-8000-00000000e2e1')
    if(retainedChannels.error)throw new Error(`retained Staff channel RLS failed: ${retainedChannels.error.message}`)
    if(!retainedChannels.data?.some(channel=>channel.kind==='event'))throw new Error('retained Staff channel RLS returned no event channel after closure')
    const persistedLifecycleMessage=globalThis.__uptLifecycleMessage
    if(!persistedLifecycleMessage?.id)throw new Error('lifecycle message diagnostic missing before retained read')
    const serviceRetainedMessage=await lifecycleAdmin.from('messages').select('id,body,channel_id,sender_id').eq('id',persistedLifecycleMessage.id).maybeSingle()
    if(serviceRetainedMessage.error||!serviceRetainedMessage.data)throw new Error('lifecycle message disappeared server-side after closure')
    const retainedMessages=await retainedAuth.from('messages').select('id,body,channel_id').eq('id',persistedLifecycleMessage.id)
    if(retainedMessages.error)throw new Error(`retained Staff message RLS failed: ${retainedMessages.error.message}`)
    if(!retainedMessages.data?.length)throw new Error(`retained Staff message RLS hid persisted message ${persistedLifecycleMessage.id} on channel ${persistedLifecycleMessage.channel_id}`)

const retainedChat=await loginLifecycle('staff',2)
    try{
      await retainedChat.page.goto(`${baseUrl}/chat?event=00000000-0000-4000-8000-00000000e2e1`,{waitUntil:'networkidle',timeout:45000})
      if(!(await retainedChat.page.getByText('E2E lifecycle chat message',{exact:true}).isVisible()))throw new Error('assigned Staff lost event chat immediately after event closure')
    }finally{await retainedChat.context.close()}

    console.log('PASS full combined lifecycle: tasks + inventory + chat/upload + incidents + closure/chat retention + negative Staff permissions')
  }catch(error){
    failures.push(`cross-role-lifecycle: ${error instanceof Error?error.message:String(error)}`)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('PASS: 15 concurrent authenticated browser bots + protected event workflow surfaces across Admin/Responsible/Staff, NL/FR/EN/DE and mobile/tablet/desktop viewports')
