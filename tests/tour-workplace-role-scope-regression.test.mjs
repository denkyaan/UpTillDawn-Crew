import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tourProgressKey,tourWorkplaceKey} from '../lib/tour-training.ts'

test('tour progress is isolated by user role and workplace',()=>{
  assert.notEqual(tourProgressKey('u','employee','Bar / Toog'),tourProgressKey('u','employee','Driver'))
  assert.notEqual(tourProgressKey('u','employee','Bar / Toog'),tourProgressKey('u','responsible_lead','Bar / Toog'))
  assert.equal(tourWorkplaceKey('Bar / Toog'),'bar-toog')
})

test('first unseen role-workplace combination is automatically offered and can be restarted manually',()=>{
  const roleTour=readFileSync('components/role-app-tour.tsx','utf8')
  const index=readFileSync('components/training/tour-help-index.tsx','utf8')
  assert.match(roleTour,/tourProgressKey\(user\.id,scopedRole,preferredName\)/)
  assert.match(roleTour,/scopedChapters\.some\(chapter=>!completed\.has\(chapter\.key\)\)/)
  assert.match(index,/uptilldawn-restart-tour/)
  assert.match(index,/workplace/)
})

test('tour has no blocking explanation panel and shows feedback only after a guided action',()=>{
  const center=readFileSync('components/training/tour-control-center.tsx','utf8')
  assert.doesNotMatch(center,/DO THIS NOW|DOE DIT NU/)
  assert.match(center,/setActionFeedback\(current\.description\[locale\]\)/)
  assert.match(center,/actionFeedback&&/)
})
