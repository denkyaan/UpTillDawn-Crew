import test from "node:test"
import assert from "node:assert/strict"
import { accessiblePortals, canOpenPortal, safeNotificationPath } from "../lib/portal-access.ts"

const account = { approved: true, blocked: false }
const grants = [
  { portal: "events", role: "event_staff", approved: true, revoked_at: null },
  { portal: "promotion", role: "promoter", approved: true, revoked_at: null },
]

test("multiple approved roles unlock only their assigned portals", () => {
  assert.deepEqual(accessiblePortals(grants, account), ["events", "promotion"])
  assert.equal(canOpenPortal("administration", grants, account), false)
})

test("blocked and unapproved accounts cannot access any portal", () => {
  assert.deepEqual(accessiblePortals(grants, { approved: true, blocked: true }), [])
  assert.deepEqual(accessiblePortals(grants, { approved: false, blocked: false }), [])
})

test("revoked, pending and mismatched role grants do not grant access", () => {
  assert.deepEqual(accessiblePortals([
    { portal: "events", role: "event_staff", approved: true, revoked_at: "2026-10-21T00:00:00Z" },
    { portal: "promotion", role: "promoter", approved: false, revoked_at: null },
    { portal: "administration", role: "promoter", approved: true, revoked_at: null },
  ], account), [])
})

test("notification destinations reject off-origin and unsafe paths", () => {
  assert.equal(safeNotificationPath("/promotion/campaigns/123"), "/promotion/campaigns/123")
  for (const path of ["//evil.example", "https://evil.example", "/\\evil", "/hello\nworld", null]) {
    assert.equal(safeNotificationPath(path), "/notifications")
  }
})
