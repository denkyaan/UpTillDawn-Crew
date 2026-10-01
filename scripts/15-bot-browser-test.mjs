import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.BOT_TEST_BASE_URL || 'http://127.0.0.1:3000'
const testPassword = process.env.BOT_TEST_PASSWORD
const supabaseUrl = process.env.BOT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.BOT_SERVICE_ROLE_KEY
if (!testPassword || !supabaseUrl || !serviceRoleKey) {
  console.error('BOT_TEST_PASSWORD, BOT_SUPABASE_URL and BOT_SERVICE_ROLE_KEY are required')
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
        if(!requestResponse.ok())throw new Error(`staff remote start request failed HTTP ${requestResponse.status()}`)
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
      await lock.click()
      await adminTs.page.waitForLoadState('networkidle',{timeout:45000})
    }finally{await adminTs.context.close()}
    const locked=await lifecycleAdmin.from('timesheets').select('status').eq('id',submitted.data.id).maybeSingle()
    if(locked.error||locked.data?.status!=='locked')throw new Error('timesheet did not reach locked state')

    console.log('PASS cross-role browser lifecycle: check-in -> approval -> work -> break/resume -> checkout -> timesheet submit/approve/lock')
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
