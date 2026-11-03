import test from 'node:test'
import assert from 'node:assert/strict'
import {administrationCategoryForPath,administrationRoute} from '../lib/administration/navigation.ts'

test('deep administration booking and contract routes remain in planning',()=>{
 for(const path of [
  '/portals/administration/modules/artists/123',
  '/portals/administration/modules/artists/123/agreement',
  '/portals/administration/modules/artists/123/agreement/signing-check/v1'
 ])assert.equal(administrationCategoryForPath(path),'planning')
})
test('deep invoices and peppol remain in finance',()=>{
 for(const path of [
  '/portals/administration/modules/invoices/123',
  '/portals/administration/modules/invoices/123/peppol',
  '/portals/administration/sales'
 ])assert.equal(administrationCategoryForPath(path),'finance')
})
test('all administration workflow links stay inside administration portal',()=>{
 for(const slug of ['dashboard','events','artists','contracts','finance','invoices','banking','ticketing','reports','inventory','staff','rosters','ai','automations']){
  assert.ok(administrationRoute(slug).startsWith('/portals/administration'))
 }
})
