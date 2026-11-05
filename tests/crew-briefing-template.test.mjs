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

test('empty imported briefing text is rejected before replacing existing draft',()=>{
 const guard=editor.indexOf("if(!result.title?.trim()&&!result.instructions?.trim())throw new Error")
 const titleWrite=editor.indexOf('if(result.title?.trim())setTitle(result.title)')
 const bodyWrite=editor.indexOf('if(result.instructions?.trim())setBody(result.instructions)')
 assert.ok(guard>0&&titleWrite>guard&&bodyWrite>guard)
 assert.match(editor,/throw new Error\(t\.importEmpty\)/)
})

test('partial imported briefing content preserves any existing field not extracted',()=>{
 assert.match(editor,/if\(result\.title\?\.trim\(\)\)setTitle\(result\.title\)/)
 assert.match(editor,/if\(result\.instructions\?\.trim\(\)\)setBody\(result\.instructions\)/)
})

test('import confirmation reports extracted fields using four-language labels',()=>{
 assert.match(editor,/result\.title\?\.trim\(\)\?t\.importTitle:null/)
 assert.match(editor,/result\.instructions\?\.trim\(\)\?t\.importBody:null/)
 assert.match(editor,/\.join\(t\.importJoin\)/)
 assert.match(editor,/t\.importDone/)
 assert.match(editor,/t\.importImages/)
 for(const locale of ['nl','fr','en','de'])assert.match(editor,new RegExp(`${locale}:\\{[^\\n]+importTitle:.*importBody:.*importJoin:.*importDone:.*importImages:`))
})

test('briefing import progress and error states are localized',()=>{
 assert.match(editor,/setMessage\(t\.importReading\)/)
 assert.match(editor,/result\.error\|\|t\.importFailed/)
 for(const locale of ['nl','fr','en','de'])assert.match(editor,new RegExp(`${locale}:\\{[^\\n]+importEmpty:.*importReading:.*importFailed:`))
})

test('briefing import panel labels are translated across all supported locales',()=>{
 for(const key of ['importHeading','importDescription','importFormats','titlePlaceholder']){
  for(const locale of ['nl','fr','en','de'])assert.match(editor,new RegExp(`${locale}:\\{[^\\n]+${key}:`))
  assert.match(editor,new RegExp(`\\{t\\.${key}\\}`))
 }
})

test('briefing analysis API allows partial extraction and rejects empty content',()=>{
 const api=readFileSync(new URL('../app/api/briefing-analyze/route.ts',import.meta.url),'utf8')
 assert.match(api,/if\(!title&&!instructions\)return NextResponse\.json/)
 assert.match(api,/return NextResponse\.json\(\{title,instructions\}\)/)
 assert.doesNotMatch(api,/if\(!title\|\|!instructions\)/)
 assert.match(editor,/if\(result\.title\?\.trim\(\)\)setTitle\(result\.title\)/)
 assert.match(editor,/if\(result\.instructions\?\.trim\(\)\)setBody\(result\.instructions\)/)
})

test('briefing document endpoints validate signatures and unsafe filenames before parsing',()=>{
 for(const endpoint of ['briefing-analyze','briefing-extract-media']){
  const source=readFileSync(new URL(`../app/api/${endpoint}/route.ts`,import.meta.url),'utf8')
  assert.match(source,/import \{ validateUploadSecurity \} from '@\/lib\/upload-security'/)
  assert.match(source,/await validateUploadSecurity\(file\)/)
  assert.match(source,/status:400/)
 }
})

test('assignment scope rejects cross-event workplace defaults and filters workplaces for selected event',()=>{
 const scope=readFileSync(new URL('../components/crew/assignment-scope-fields.tsx',import.meta.url),'utf8')
 assert.match(scope,/workplace\.event_id === defaultEventId/)
 assert.match(scope,/events\.some\(event => event\.id === workplace\.event_id\)/)
 assert.match(scope,/eventId\s*\? workplaces\.filter\(workplace => workplace\.event_id === eventId\)/)
 assert.match(scope,/visibleWorkplaces\.find\(workplace => workplace\.id === workplaceId\)/)
 assert.match(scope,/setWorkplaceId\(""\)/)
 assert.match(scope,/setPersonId\(""\)/)
})

test('full browser E2E accepts canonical administration overview redirect for clicked links',()=>{
 const browser=readFileSync(new URL('../scripts/administration-full-browser-e2e.mjs',import.meta.url),'utf8')
 assert.match(browser,/target==='\/portals\/administration\/overview'\?'\/portals\/administration':target/)
 assert.match(browser,/new URL\(expectedClickedPath,base\)\.pathname/)
})
