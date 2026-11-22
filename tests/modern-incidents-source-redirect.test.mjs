import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {transform} from 'esbuild'

const decisionSource=readFileSync('modern/src/original/incident-access-decision.ts','utf8')
const compiled=await transform(decisionSource,{loader:'ts',format:'esm',target:'es2022'})
const {incidentDestination}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'))

test('original non-admin incident access: no active events always redirects, even with stale work hints',()=>{
 assert.equal(incidentDestination(false,[],[],false),'/events')
 assert.equal(incidentDestination(false,[],['former-event'],true),'/events')
})
test('responsible/staff without a current work context AND valid active shift redirect to events',()=>{
 assert.equal(incidentDestination(false,['live'],[],false),'/events')
 assert.equal(incidentDestination(false,['live'],['another-event'],false),'/events')
 assert.equal(incidentDestination(false,['live'],['archived'],false),'/events')
})
test('current signed shift OR current signed work context preserves original incident screen',()=>{
 assert.equal(incidentDestination(false,['live'],['live'],false),null)
 assert.equal(incidentDestination(false,['live'],[],true),null)
 assert.equal(incidentDestination(false,['live'],['other'],true),null)
})
test('admin with original role authority remains on incident screen regardless of active events',()=>{
 assert.equal(incidentDestination(true,[],[],false),null)
 assert.equal(incidentDestination(true,['live'],[],false),null)
})
test('candidate incident checks original signed filters before suspended Main layout, without weakening RLS',()=>{
 const source=readFileSync('app/(app)/incidents/page.tsx','utf8')
 const guard=readFileSync('modern/src/original/incident-access-redirect.tsx','utf8')
 const screen=readFileSync('modern/src/screens/original-application.tsx','utf8')
 assert.match(source,/if\(!isAdmin&&!activeShifts\.length&&!currentContext\)redirect\('\/events'\)/)
 assert.match(source,/if\(!isAdmin\)redirect\('\/events'\)/)
 for(const query of [
  "db.from('events').select('id').lte('start_at',now).gte('end_at',now).neq('status','archived')",
  "db.from('shifts').select('event_id').eq('user_id',userId)",
  ".neq('status','cancelled').neq('response_status','declined')",
  ".lte('scheduled_start',now).gte('scheduled_end',now)",
  "db.rpc('upt_current_work_context')"
 ])assert.ok(guard.includes(query),'Original signed incident data source omitted: '+query)
 assert.ok(guard.includes('if(events.error||shifts.error||context.error){setState(\'allow\');return}'),
  'Unknown RLS/read state must not be treated as proof of absent work context')
 assert.ok(guard.includes('<Navigate to="/events" replace/>'))
 assert.ok(screen.includes("if(location.pathname==='/incidents'&&auth.user&&auth.profile)"))
 assert.ok(screen.includes("isAdmin={auth.roleMode==='admin'}"))
 assert.ok(screen.indexOf("if(location.pathname==='/incidents'&&auth.user&&auth.profile)")<
  screen.lastIndexOf('return original'),'Must redirect at the outer authenticated router boundary')
 assert.ok(screen.includes('<OriginalRequest key={identityKey}'), 'Keep the authoritative Main layout and authorization')
 assert.ok(!guard.includes('localStorage'))
 assert.ok(!guard.includes('service_role'))
})
