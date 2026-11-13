import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { expectedPortalDestination, browserDestination } from '../scripts/portal-e2e-route-contract.mjs'

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

test('Clicked browser destinations preserve query and fragment in addition to the canonical path', () => {
  const direct = '/portals/administration/modules/events?create=1#administration-event-draft'
  const url = new URL('http://127.0.0.1:3000' + direct)
  assert.equal(browserDestination(url), direct)
  assert.equal(browserDestination(url.toString()), direct)
  assert.equal(browserDestination(new URL('https://example.com/portals/administration/modules/invoices?status=draft')), '/portals/administration/modules/invoices?status=draft')
  assert.notEqual(url.pathname + url.search, direct, 'fragment-dropping match must not be used')
})
