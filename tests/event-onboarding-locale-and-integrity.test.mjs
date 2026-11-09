import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('event preparation keeps six mandatory operational confirmations without reintroducing a guided tour',()=>{
 const page=read('app/(app)/onboarding/page.tsx')
 const action=read('lib/actions/onboarding.ts')
 for(const name of ['briefing','safety','map','workplace','responsible','inventory'])
  assert.ok(page.includes("'"+name+"'"),name)
 assert.match(page,/completeEventOnboardingStep/)
 assert.match(page,/upt_event_onboarding_status/)
 assert.match(action,/upt_is_approved/)
 assert.match(action,/upt_complete_event_onboarding_step/)
 assert.doesNotMatch(page,/PortalGuidedTour|WorkplaceTourButton|tour=1|TourActiveEventDemo/)
})

test('preparation data failures are not treated as empty events or successful readiness',()=>{
 const page=read('app/(app)/onboarding/page.tsx')
 assert.match(page,/if\(memberError\|\|shiftError\)return shell\(t\.error\)/)
 assert.match(page,/if\(eventError\)return shell\(t\.error\)/)
 assert.match(page,/statusUnavailable/)
 assert.match(page,/role="alert"/)
 assert.match(page,/selected\.onboarding_required&&!statusUnavailable/)
 assert.match(page,/disabled=\{completed\.size!==stepKeys\.length\}/)
 assert.match(page,/aria-current=\{event\.id===selected\.id\?'page':undefined\}/)
})

test('event preparation is available in all four required locales with consistent dates',()=>{
 const page=read('app/(app)/onboarding/page.tsx')
 for(const key of ['nl:','fr:','en:','de:']) assert.ok(page.includes(key),key)
 assert.match(page,/requestUiLocale\(/)
 assert.match(page,/Europe\/Brussels/)
 assert.match(page,/t\[key\]/)
 assert.match(page,/t\.optional/)
})
