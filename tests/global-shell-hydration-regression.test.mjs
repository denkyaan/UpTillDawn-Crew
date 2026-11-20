import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')

test('global shell first render is independent of browser-only state',async()=>{
  const [app,mobile,queue,admin]=await Promise.all([
    read('components/layout/app-layout.tsx'),
    read('components/layout/mobile-nav.tsx'),
    read('components/crew/queue-status.tsx'),
    read('lib/admin-selection-context.tsx'),
  ])
  assert.ok(app.includes('useState<SupportedUiLocale>("nl")'))
  assert.ok(mobile.includes('useState<SupportedUiLocale>("nl")'))
  assert.ok(queue.includes("useState<SupportedUiLocale>('nl')"))
  assert.ok(queue.includes('useState(true)'))
  assert.ok(admin.includes('useState<AdminSelection>(EMPTY)'))
  for(const source of [app,mobile,queue,admin]){
    assert.doesNotMatch(source,/useState[^\n]*typeof window[^\n]*(activeUiLocale|localStorage|sessionStorage)/)
    assert.doesNotMatch(source,/useState[^\n]*typeof navigator[^\n]*navigator\.onLine/)
  }
})
