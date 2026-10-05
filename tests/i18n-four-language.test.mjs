import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('runtime supports all four product locales', async () => {
  const [sync,preferences,runtime] = await Promise.all([
    readFile(new URL('../components/locale-sync.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/locale-preferences.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/ui-translation-runtime.ts', import.meta.url), 'utf8'),
  ])
  assert.match(preferences, /\['nl','fr','en','de'\]/)
  assert.match(sync, /translateRuntimeUi/)
  assert.match(runtime, /translateCompleteUi/)
  assert.match(sync, /useEffect/)
  assert.doesNotMatch(sync, /useLayoutEffect/)
  assert.match(sync, /setTimeout\(\(\)\s*=>\s*\{/)
  assert.match(sync, /document\.readyState===['"]complete['"]/)
  assert.match(sync, /addEventListener\(['"]load['"],startRuntimeTranslation/)
  assert.match(sync, /MutationObserver/)
  for (const attribute of ['placeholder', 'aria-label', 'aria-description', 'title', 'alt']) assert.ok(sync.includes(`"${attribute}"`))
})

test('complete fallback rows contain French, English and German', async () => {
  const source = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')
  const rows = [...source.matchAll(/^\s{2}'[^']+'\s*:\s*\{([^\n]+)\},?$/gm)]
  assert.ok(rows.length >= 50, 'expected broad supplemental translation coverage')
  for (const [, row] of rows) {
    assert.match(row, /fr:\s*'[^']+'/)
    assert.match(row, /en:\s*'[^']+'/)
    assert.match(row, /de:\s*'[^']+'/)
  }
})

test('critical navigation and operational labels have German coverage', async () => {
  const extension = await readFile(new URL('../lib/ui-translation-extensions.ts', import.meta.url), 'utf8')
  const complete = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')
  const all = extension + complete
  for (const label of ['Overzicht','Evenementen','Werkuren','Werkplekken','Taken','Briefing','Personeel','Instellingen','Meldingen','Profiel','Uitloggen','Actief personeel','Actie vereist','Open incidenten','Synchronisatie']) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(all, new RegExp(`['"]${escaped}['"]\\s*:\\s*\\{[^\\n]*de\\s*:`), `${label} must have German coverage`)
  }
})

test('admin and responsible login denial is consistent and fully translated', async () => {
  const auth = await readFile(new URL('../lib/actions/auth.ts', import.meta.url), 'utf8')
  const login = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const complete = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')
  const message = 'Foute logingegevens of u heeft geen toegang tot deze rol.'
  assert.ok(auth.includes("requestedPortal === 'admin' || requestedPortal === 'responsible'"))
  assert.ok(auth.includes(message))
  assert.ok(login.includes('portal === "admin" || portal === "responsible"'))
  assert.ok(login.includes(message))
  const row = complete.split('\n').find(line => line.includes(message)) || ''
  assert.match(row, /fr:\s*'[^']+'/)
  assert.match(row, /en:\s*'[^']+'/)
  assert.match(row, /de:\s*'[^']+'/)
})

test('device language is reapplied on startup and manual language remains synchronized during the session', async () => {
  const [sync, switcher, prefs] = await Promise.all([
    readFile(new URL('../components/locale-sync.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/language-switcher.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/locale-preferences.ts', import.meta.url), 'utf8'),
  ])
  assert.match(sync, /initialUiLocale\(\)/)
  assert.match(sync, /storedUiLocaleSource\(\)===['"]manual['"]/)
  assert.match(sync, /deviceUiLocale\(\)/)
  assert.match(prefs, /initialUiLocale[\s\S]*return deviceUiLocale\(\)/)
  assert.doesNotMatch(prefs, /storedUiLocaleSource\\(\\)===['"]manual['"]&&stored/)
  assert.match(switcher, /LANGUAGE_APPLIED_EVENT/)
  assert.match(switcher, /requestUiLocale\(next\)/)
})


test('login UI hides maker alias and count labels are translated dynamically', async () => {
  const login = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const runtime = await readFile(new URL('../lib/ui-translation-runtime.ts', import.meta.url), 'utf8')
  const complete = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')

  assert.ok(login.includes('placeholder="naam@email.com"'))
  assert.ok(!login.includes('placeholder="naam@email.com of maker@uptilldawn"'))
  assert.match(runtime, /value\.match\(\/\^\(\\d\+\)\\s\+\(\.\+\)\$\//)
  for (const label of ['Actieve evenementen','Aan het werk','Wachtende goedkeuringen','Open help oproepen','Lopende diensten & pauzes','niet gearchiveerd','op pauze','actief','lopend']) {
    assert.ok(complete.includes(`'${label}'`), `${label} must have complete translation coverage`)
  }
})


test('language picker follows the locale applied by LocaleSync', async () => {
  const switcher = await readFile(new URL('../components/language-switcher.tsx', import.meta.url), 'utf8')
  assert.match(switcher, /document\.documentElement\.lang/)
  assert.match(switcher, /LANGUAGE_APPLIED_EVENT/)
  assert.match(switcher, /requestUiLocale\(next\)/)
  for (const nativeLabel of ['Nederlands','Français','English','Deutsch']) assert.ok(switcher.includes(nativeLabel))
})


test('chat messages can use optional live browser translation without mutating originals', async () => {
  const [chat,translator]=await Promise.all([
    readFile(new URL('../components/crew/chat-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/browser-live-translation.ts', import.meta.url), 'utf8'),
  ])
  assert.match(chat,/liveTranslateText/)
  assert.match(chat,/data-no-translate/)
  assert.match(chat,/Vertaal/)
  assert.match(chat,/Origineel/)
  assert.match(translator,/LanguageDetector/)
  assert.match(translator,/Translator/)
})


test('server metadata and manifest use the same locale source', async () => {
  const [serverLocale,root,auth,manifest]=await Promise.all([
    readFile(new URL('../lib/server-locale.ts',import.meta.url),'utf8'),
    readFile(new URL('../app/layout.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/(auth)/layout.tsx',import.meta.url),'utf8'),
    readFile(new URL('../app/manifest.ts',import.meta.url),'utf8'),
  ])
  assert.match(serverLocale,/requestUiLocale/)
  assert.match(serverLocale,/headerLocale\\|\\|cookieLocale\\|\\|['"]nl['"]/)
  assert.doesNotMatch(serverLocale,/localeSource===['"]manual['"]/)
  for(const locale of ['nl','fr','en','de']) assert.match(serverLocale,new RegExp(`\\b${locale}:\\{`))
  assert.match(root,/await requestUiLocale\(\)/)
  assert.match(root,/generateMetadata/)
  assert.match(auth,/await requestUiLocale\(\)/)
  assert.match(auth,/generateMetadata/)
  assert.match(manifest,/await requestUiLocale\(\)/)
  assert.match(manifest,/copy\.manifestName/)
})


test('language preference stays synchronized across tabs', async () => {
  const sync=await readFile(new URL('../components/locale-sync.tsx',import.meta.url),'utf8')
  assert.match(sync,/addEventListener\(["']storage["']/)
  assert.match(sync,/event\.key!==['"]uptilldawn-language['"]/)
  assert.match(sync,/removeEventListener\(["']storage["']/)
})


test('runtime translator consumes every four-language catalog', async () => {
  const runtime = await readFile(new URL('../lib/ui-translation-runtime.ts', import.meta.url), 'utf8')
  for (const translator of [
    'translateCompleteUi',
    'translateUiExtension',
    'translateAppUi',
    'translateAppExtraUi',
    'translateCrewUi',
    'translateCrewExtraUi',
    'translateGodUi',
    'translateActionUi',
  ]) assert.ok(runtime.includes(translator), `${translator} must be active at runtime`)
  assert.match(runtime,/translateCatalogFragments/)
})

test('new visible UI copy is guarded by static four-language coverage tests', async () => {
  const [staticCoverage,coverage] = await Promise.all([
    readFile(new URL('./i18n-static-ui-coverage.test.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./ui-translation-coverage.test.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(staticCoverage, /every static user-facing UI string has NL\/FR\/EN\/DE coverage/)
  assert.match(coverage, /every static UI string has NL\/FR\/EN\/DE translation coverage/)
  assert.match(coverage, /server action user messages also require four-language coverage/)
})


test('database-driven workplace and notification copy is localized in all four product languages', async () => {
  const [complete,runtime,push]=await Promise.all([
    readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/ui-translation-runtime.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/push-notification/i18n.ts', import.meta.url), 'utf8'),
  ])

  for(const label of [
    'Backstage Management',
    'Allrounder',
    'Vervoer van artiesten, crew en andere toegewezen personen van en naar het evenement.',
    'Pauzetegoed bijna op',
    'Dienst gestart',
    'No-show gedetecteerd',
    'Werkplek onderbezet',
    'HELP ESCALATIE',
    'Nieuwe accountgoedkeuring',
    'Account goedgekeurd',
    'Shift binnen 24 uur',
    'Vertrek voor ophaling',
    'Driver · artiest aangekomen',
    'Backstage opvolging vereist',
  ]){
    assert.ok(complete.includes(`'${label}': { fr:`), `${label} must have FR/EN/DE catalog coverage`)
  }

  for(const translator of [
    'translateShiftReminder',
    'translateUnderstaffing',
    'translateAccountApproval',
    'translateEventReportReady',
    'translateInventoryQuantity',
    'translateDriverDeparture',
    'translateDriverArrival',
    'translateAdminLockout',
  ]) assert.ok(runtime.includes(translator), `${translator} must be active in the runtime translator`)

  for(const marker of [
    'Pauzetegoed bijna op',
    'No-show gedetecteerd',
    'Nieuwe accountgoedkeuring',
    'Shift binnen 24 uur',
    'Vertrek voor ophaling',
    'Driver · artiest aangekomen',
    'start binnen',
    'Actieve bezetting op',
    'Nieuw account wacht op goedkeuring',
    'rit ±',
    'Driver is aangekomen op het evenement met artiest',
    'mislukte admin-loginpogingen',
  ]) assert.ok(push.includes(marker), `${marker} must be covered by push localization`)
})


test('database-backed standard workplace labels and descriptions have four-language coverage', async () => {
  const complete = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')
  const expected = [
    'Backstage Management',
    'Allrounder',
    'Vervoer van artiesten, crew en andere toegewezen personen van en naar het evenement.',
    'Inkom',
    'Ticket scan',
    'Guest list',
    'Artists',
  ]
  for (const value of expected) {
    const line=complete.split('\n').find(row=>row.includes("'"+value+"'")||row.includes('"'+value+'"'))||''
    assert.match(line,/fr:\s*['"][^'"]+['"]/,value+' missing FR runtime coverage')
    assert.match(line,/en:\s*['"][^'"]+['"]/,value+' missing EN runtime coverage')
    assert.match(line,/de:\s*['"][^'"]+['"]/,value+' missing DE runtime coverage')
  }
})

test('dynamic notification shells are localized while event person and address data stay intact', async () => {
  const runtime = await readFile(new URL('../lib/ui-translation-runtime.ts', import.meta.url), 'utf8')
  for (const helper of ['translateRequestDecision','translateAccountApproval','translateDriverDeparture','translateAdminLockout']) {
    assert.ok(runtime.includes(helper),helper+' must be active in runtime translation')
  }
  assert.match(runtime,/Ophalen\|Afzetten/)
  assert.match(runtime,/Nieuw account wacht op goedkeuring/)
  assert.match(runtime,/mislukte admin-loginpogingen/)
})
