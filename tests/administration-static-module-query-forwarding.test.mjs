import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=slug=>readFile(new URL(`../app/(app)/portals/administration/modules/${slug}/page.tsx`,import.meta.url),'utf8')

for(const slug of ['inventory','invoices']){
 test(`administration ${slug} preserves query filters and pagination`,async()=>{
  const source=await read(slug)
  assert.match(source,/searchParams:Promise<ModuleSearchParams>/)
  assert.match(source,/AdministrationModulePage\(\{params:Promise\.resolve\(\{slug:"(?:inventory|invoices)"\}\),searchParams\}\)/)
  for(const key of ['event','page','invoiceKind','invoiceStatus','invoicePage','invoiceNumber','invoiceFrom','invoiceTo','invoiceOverdue','invoiceSort']){
   assert.match(source,new RegExp(`\\b${key}\\?: string`))
  }
 })
}
