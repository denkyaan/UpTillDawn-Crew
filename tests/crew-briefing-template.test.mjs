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
 assert.match(editor,/generateCrewBriefingDraft\(\{name:eventName\}\)/)
 assert.match(editor,/setBody\(draft\.body\)/)
})

test('draft generation supports verified event and workplace metadata',()=>{
 for(const field of ['date','startTime','endTime','address','workplace'])assert.match(template,new RegExp(field))
 assert.match(template,/safeBriefingValue/)
 assert.match(template,/return \{title:.*body\}/)
})
