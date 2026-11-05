import test from 'node:test'
import assert from 'node:assert/strict'
import {generateCrewBriefingDraft,unresolvedCrewBriefingFields,crewBriefingReadiness,crewBriefingReview} from '../lib/crew-briefing-template.ts'

test('generator inserts verified event and workplace data without changing unrelated instructions',()=>{
 const draft=generateCrewBriefingDraft({name:'Test Event',date:'05/11/2026',startTime:'18:00',endTime:'02:00',address:'Venue 1',workplace:'Inkom'})
 assert.equal(draft.title,'Crewbriefing – Test Event')
 for(const line of ['Evenement: Test Event','Datum: 05/11/2026','Eventuren: 18:00 – 02:00','Adres: Venue 1','Werkpost: Inkom'])assert.ok(draft.body.includes(line),line)
 assert.ok(draft.body.includes('Weeztix Scan gebruiken indien van toepassing'))
 assert.equal(draft.body.includes('Evenement: [naam]'),false)
})

test('unverified values remain unresolved and cannot be reported ready',()=>{
 const draft=generateCrewBriefingDraft({name:'   ',startTime:'   ',endTime:'02:00'})
 assert.ok(draft.body.includes('Evenement: [naam]'))
 assert.ok(draft.body.includes('Eventuren: [start – einde]'))
 assert.equal(crewBriefingReadiness(draft.body).ready,false)
 assert.equal(crewBriefingReview(draft.title,draft.body).ready,false)
})

test('review detects missing title body and distinct unresolved fields',()=>{
 assert.deepEqual(crewBriefingReview('  ','  ').issues,['title','body'])
 assert.deepEqual(unresolvedCrewBriefingFields('[contact] and [contact]'),['contact'])
 const result=crewBriefingReview('Crewbriefing','Contact: [contact]')
 assert.deepEqual(result.issues,['placeholders'])
 assert.deepEqual(result.missing,['contact'])
 assert.equal(crewBriefingReview('Crewbriefing','Contact: +32 123 45 67').ready,true)
})

test('generator strips control characters from external event values',()=>{
 const draft=generateCrewBriefingDraft({name:'Festival\nInjected',address:'Site\tA'})
 assert.ok(draft.title.includes('Festival Injected'))
 assert.ok(draft.body.includes('Adres: Site A'))
 assert.equal(draft.title.includes('\n'),false)
})

test('readiness includes unresolved event placeholders in the briefing title',()=>{
 const review=crewBriefingReview('Crewbriefing – [evenement]','Alle instructies zijn ingevuld.')
 assert.equal(review.ready,false)
 assert.deepEqual(review.issues,['placeholders'])
 assert.deepEqual(review.missing,['evenement'])
 assert.deepEqual(crewBriefingReview('Briefing [contact]','Bel [contact]').missing,['contact'])
})

test('event time fields are normalized consistently and remain incomplete without both endpoints',()=>{
 const valid=generateCrewBriefingDraft({startTime:' 18:00\t',endTime:'\n02:00 '})
 assert.ok(valid.body.includes('Eventuren: 18:00 – 02:00'))
 const incomplete=generateCrewBriefingDraft({startTime:'18:00',endTime:'  '})
 assert.ok(incomplete.body.includes('Eventuren: [start – einde]'))
})

test('overnight events show the ending calendar date to avoid ambiguous shift hours',()=>{
 const overnight=generateCrewBriefingDraft({date:'05/11/2026',endDate:'06/11/2026',startTime:'22:00',endTime:'04:00'})
 assert.ok(overnight.body.includes('Eventuren: 22:00 – 04:00 (06/11/2026)'))
 const sameDay=generateCrewBriefingDraft({date:'05/11/2026',endDate:'05/11/2026',startTime:'12:00',endTime:'18:00'})
 assert.ok(sameDay.body.includes('Eventuren: 12:00 – 18:00'))
 assert.equal(sameDay.body.includes('(05/11/2026)'),false)
})

test('review flags blank and single-character bracket placeholders',()=>{
 assert.deepEqual(unresolvedCrewBriefingFields('Contact: [] of [ ] en [x]'),['leeg invulveld','x'])
 const review=crewBriefingReview('Briefing','Contact: [ ]')
 assert.equal(review.ready,false)
 assert.deepEqual(review.missing,['leeg invulveld'])
})
