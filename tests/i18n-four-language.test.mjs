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
