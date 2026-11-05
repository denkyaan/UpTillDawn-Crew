import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const template=readFileSync(new URL('../lib/crew-briefing-template.ts',import.meta.url),'utf8')
const page=readFileSync(new URL('../app/(app)/briefings/page.tsx',import.meta.url),'utf8')
const editor=readFileSync(new URL('../components/crew/briefing-analysis-fields.tsx',import.meta.url),'utf8')
test('crew briefing template covers the supplied operational briefing structure',()=>{
 for(const section of ['EVENTGEGEVENS','BELANGRIJK','ALGEMENE AFSPRAKEN','LOCATIE & BEREIKBAARHEID','AANKOMST & CHECK-IN','CONTACTPERSONEN','WERKPOSTINSTRUCTIES','MATERIAAL & CHECKLISTS','AFSLUITEN & AFTEKENEN','VRAGEN & WIJZIGINGEN'])assert.ok(template.includes(section),section)
 assert.match(template,/Weeztix Scan gebruiken indien van toepassing/)
 assert.match(editor,/button:'Gebruik crewbriefing-sjabloon'/)
 assert.match(editor,/templateLabels\[locale\]/)
 assert.match(editor,/\{t.button\}/)
 assert.match(editor,/window\.confirm/)
 assert.match(page,/BriefingAnalysisFields eventName=/)
 assert.match(editor,/generateCrewBriefingDraft\(\{\.\.\.context,/)
 assert.match(editor,/setBody\(draft\.body\)/)
})

test('draft generation supports verified event and workplace metadata',()=>{
 for(const field of ['date','startTime','endTime','address','workplace'])assert.match(template,new RegExp(field))
 assert.match(template,/safeBriefingValue/)
 assert.match(template,/return \{title:.*body\}/)
})


test('briefing editor reads the selected event and workplace rather than the initial default',()=>{
 const editor=readFileSync(new URL('../components/crew/briefing-analysis-fields.tsx',import.meta.url),'utf8')
 const page=readFileSync(new URL('../app/(app)/briefings/page.tsx',import.meta.url),'utf8')
 assert.match(editor,/new FormData\(form\)/)
 assert.match(editor,/data\?\.get\('event_id'\)/)
 assert.match(editor,/data\?\.get\('workplace_id'\)/)
 assert.match(editor,/eventContexts\.find/)
 assert.match(editor,/workplaceContexts\.find/)
 assert.match(page,/eventContexts=events\.map/)
 assert.match(page,/timeZone:timezone/)
 assert.match(page,/eventContexts=\{eventContexts\}/)
 assert.match(page,/workplaceContexts=\{workplaceContexts\}/)
})


test('draft review identifies unresolved instructions and displays localized review checklist',()=>{
 assert.match(template,/export function unresolvedCrewBriefingFields/)
 assert.match(template,/new Set\(matches\.map/)
 assert.match(template,/export function crewBriefingReadiness/)
 assert.match(editor,/crewBriefingReview\(title,body\)/)
 assert.match(editor,/review\.issues\.includes\('title'\)/)
 assert.match(editor,/role="status"/)
 assert.match(editor,/review\.ready\?t\.ready:t\.review/)
 for(const label of ['Nog in te vullen velden','Champs à vérifier','Fields requiring review','Zu prüfende Felder'])assert.ok(editor.includes(label),label)
})

test('briefing readiness checks missing title, body and unresolved markers without blocking publishing',()=>{
 assert.match(template,/export function crewBriefingReview/)
 assert.match(template,/if\(!title\.trim\(\)\)issues\.push\('title'\)/)
 assert.match(template,/if\(!body\.trim\(\)\)issues\.push\('body'\)/)
 assert.match(template,/if\(missing\.length\)issues\.push\('placeholders'\)/)
 assert.match(editor,/review\.ready\?t\.ready:t\.review/)
 for(const label of ['Titel ontbreekt','Titre manquant','Title missing','Titel fehlt'])assert.ok(editor.includes(label),label)
})

test('switching event does not silently reuse the initially selected event name',()=>{
 assert.match(editor,/name:context\?\.name\|\|\(!selectedEventId\?eventName:undefined\)/)
 assert.match(editor,/workplaceContexts\.find\(item=>item\.id===workplaceId&&\(!selectedEventId\|\|item\.event_id===selectedEventId\)\)/)
})

test('briefing review status communicates ready and incomplete states accessibly',()=>{
 assert.match(editor,/aria-live="polite"/)
 assert.match(editor,/review\.ready\?'border-emerald-500\/40 bg-emerald-500\/10':'border-amber-500\/40 bg-amber-500\/10'/)
 assert.match(editor,/review\.ready\?t\.ready:t\.review/)
})

test('briefing event formatting falls back safely for unsupported timezones',()=>{
 assert.match(page,/try\{return new Intl\.DateTimeFormat\('nl-BE',\{timeZone:timezone,\.\.\.options\}\)\.format\(date\)\}catch\{return new Intl\.DateTimeFormat\('nl-BE',\{timeZone:'Europe\/Brussels',\.\.\.options\}\)\.format\(date\)\}/)
 assert.match(page,/Number\.isNaN\(date\.getTime\(\)\)/)
})
