import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const center=readFileSync('components/training/tour-control-center.tsx','utf8')
const training=readFileSync('lib/tour-training.ts','utf8')

test('all role tours use one exact actionable element with non-blocking highlight geometry',()=>{
  assert.match(center,/exactPrimary=container instanceof HTMLElement&&container\.matches/)
  assert.match(center,/nestedPrimary=container\?\.querySelector/)
  assert.match(center,/const found=exactPrimary\|\|nestedPrimary\|\|fallbackAction\|\|container/)
  assert.match(center,/new ResizeObserver\(\(\)=>updateRect\(found\)\)/)
  const css=readFileSync('app/globals.css','utf8')
  assert.doesNotMatch(center,/style=\\{\\{left:rect/)
  assert.match(css,/data-upt-training-next-tab/)
  assert.match(css,/data-tour-demo="primary-action"/)
  assert.match(css,/animation: none/)
  assert.doesNotMatch(css,/0 0 0 9999px/)
  assert.doesNotMatch(center,/shadow-\[0_0_0_9999px/)
  assert.doesNotMatch(center,/↓|HIER|HERE|ICI/)
})

test('blocking do-this-now instruction card is absent from every role tour',()=>{
  assert.doesNotMatch(center,/DOE DIT NU|DO THIS NOW|FAITES CECI MAINTENANT|JETZT AUSFÜHREN/)
})

test('employee responsible and admin share the same tour control center contract',()=>{
  for(const role of ['employee','responsible_lead','admin'])assert.match(training,new RegExp(role))
  assert.match(training,/mobileSelector/)
  assert.match(training,/desktopSelector/)
})
