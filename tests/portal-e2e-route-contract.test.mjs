import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { expectedPortalDestination } from '../scripts/portal-e2e-route-contract.mjs'

test('Administration overview and legacy Contacts URLs resolve to their reviewed canonical pages', () => {
  assert.equal(expectedPortalDestination('/portals/administration/overview'), '/portals/administration')
  assert.equal(expectedPortalDestination('/portals/administration/contacts'), '/portals/administration/counterparties')
  assert.equal(expectedPortalDestination('/portals/administration/modules/contacts'), '/portals/administration/counterparties')
})

test('Authorized Administration Sales and all unrelated routes remain exact', () => {
  for (const route of [
    '/portals/administration/sales',
    '/portals/administration/finance',
    '/portals/administration/counterparties',
    '/portals/administration/modules/invoices',
    '/portals/administration/modules/banking',
    '/portals/promotion/tasks',
    '/portals/switch/administration',
    '/login',
  ]) {
    assert.equal(expectedPortalDestination(route), route)
  }
})
