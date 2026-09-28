import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('runtime supports all four product locales', async () => {
  const sync = await readFile(new URL('../components/locale-sync.tsx', import.meta.url), 'utf8')
  assert.match(sync, /\["nl", "fr", "en", "de"\]/)
  assert.match(sync, /translateCompleteUi/)
  assert.match(sync, /MutationObserver/)
  for (const attribute of ['placeholder', 'aria-label', 'title']) assert.ok(sync.includes(`"${attribute}"`))
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

test('device language is the default and manual language remains synchronized', async () => {
  const [sync, switcher, prefs] = await Promise.all([
    readFile(new URL('../components/locale-sync.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/language-switcher.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../lib/locale-preferences.ts', import.meta.url), 'utf8'),
  ])
  assert.match(sync, /initialUiLocale\(\)/)
  assert.match(sync, /storedUiLocaleSource\(\)===['"]manual['"]/)
  assert.match(sync, /deviceUiLocale\(\)/)
  assert.match(prefs, /storedUiLocaleSource\(\)===['"]manual['"]&&stored/)
  assert.match(switcher, /LANGUAGE_APPLIED_EVENT/)
  assert.match(switcher, /requestUiLocale\(next\)/)
})


test('login UI hides maker alias and count labels are translated dynamically', async () => {
  const login = await readFile(new URL('../components/auth/login-form.tsx', import.meta.url), 'utf8')
  const sync = await readFile(new URL('../components/locale-sync.tsx', import.meta.url), 'utf8')
  const complete = await readFile(new URL('../lib/ui-translation-complete.ts', import.meta.url), 'utf8')

  assert.ok(login.includes('placeholder="naam@email.com"'))
  assert.ok(!login.includes('placeholder="naam@email.com of maker@uptilldawn"'))
  assert.match(sync, /value\.match\(\/\^\(\\d\+\)\\s\+\(\.\+\)\$\//)
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
