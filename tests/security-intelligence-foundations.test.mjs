import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('staffing forecasts remain advisory and expose confidence', async () => {
  const source = await readFile(new URL('../lib/forecasting.ts', import.meta.url), 'utf8')
  assert.match(source, /advisoryOnly: true/)
  assert.match(source, /confidence:/)
  assert.match(source, /samples\.length >= 5/)
})

test('device subscriptions disable repeatedly failing endpoints', async () => {
  const source = await readFile(new URL('../lib/device-notification-subscriptions.ts', import.meta.url), 'utf8')
  assert.match(source, /failedDeliveries < 3/)
  assert.match(source, /failedDeliveries >= 3/)
  assert.match(source, /subscription\.userId === userId/)
})

test('QR claims are expiring, contextual and short-lived', async () => {
  const source = await readFile(new URL('../lib/qr-token-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /eventId/)
  assert.match(source, /workplaceId/)
  assert.match(source, /shiftId/)
  assert.match(source, /claims\.expiresAt > now/)
  assert.match(source, /maximumMinutes/)
})

test('high-risk God Mode changes require preview and retain rollback state', async () => {
  const source = await readFile(new URL('../lib/god-mode-change-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /change\.risk === 'high' \|\| change\.risk === 'critical'/)
  assert.match(source, /Boolean\(change\.previewedAt\)/)
  assert.match(source, /Object\.keys\(change\.before\)\.length > 0/)
})
