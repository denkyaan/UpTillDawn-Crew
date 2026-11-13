/**
 * Browser E2E routing contract. Only known, intentional legacy aliases are
 * accepted; an unexpected role switch or redirect must still fail the test.
 */
const canonicalAliases = new Map([
  ['/portals/administration/overview', '/portals/administration'],
  ['/portals/administration/contacts', '/portals/administration/counterparties'],
  ['/portals/administration/modules/contacts', '/portals/administration/counterparties'],
])

export function expectedPortalDestination(path) {
  return canonicalAliases.get(path) ?? path
}
