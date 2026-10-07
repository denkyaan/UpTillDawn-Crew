import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const center=readFileSync('components/training/tour-control-center.tsx','utf8')
const training=readFileSync('lib/tour-training.ts','utf8')

test('all role tours use one exact actionable element for highlight and HERE marker geometry',()=>{
  assert.match(center,/exactPrimary=container instanceof HTMLElement&&container\.matches/)
  assert.match(center,/nestedPrimary=container\?\.querySelector/)
  assert.match(center,/const found=exactPrimary\|\|nestedPrimary\|\|fallbackAction\|\|container/)
  assert.match(center,/new ResizeObserver\(\(\)=>updateRect\(found\)\)/)
  assert.match(center,/style=\{\{left:rect\.left,top:rect\.top,width:rect\.width,height:rect\.height\}\}/)
  assert.match(center,/rect\.left\+rect\.width\/2/)
})

test('blocking do-this-now instruction card is absent from every role tour',()=>{
  assert.doesNotMatch(center,/DOE DIT NU|DO THIS NOW|FAITES CECI MAINTENANT|JETZT AUSFÜHREN/)
})

test('employee responsible and admin share the same tour control center contract',()=>{
  for(const role of ['employee','responsible_lead','admin'])assert.match(training,new RegExp(role))
  assert.match(training,/mobileSelector/)
  assert.match(training,/desktopSelector/)
})
