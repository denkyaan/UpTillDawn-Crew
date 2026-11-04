import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const template=readFileSync(new URL('../lib/crew-briefing-template.ts',import.meta.url),'utf8')
const editor=readFileSync(new URL('../components/crew/briefing-analysis-fields.tsx',import.meta.url),'utf8')
test('crew briefing template covers the supplied operational briefing structure',()=>{
 for(const section of ['EVENTGEGEVENS','BELANGRIJK','ALGEMENE AFSPRAKEN','LOCATIE & BEREIKBAARHEID','AANKOMST & CHECK-IN','CONTACTPERSONEN','WERKPOSTINSTRUCTIES','MATERIAAL & CHECKLISTS','AFSLUITEN & AFTEKENEN','VRAGEN & WIJZIGINGEN'])assert.ok(template.includes(section),section)
 assert.match(template,/Weeztix Scan gebruiken indien van toepassing/)
 assert.match(editor,/Gebruik crewbriefing-sjabloon/)
 assert.match(editor,/window\.confirm/)
 assert.match(editor,/setTitle\(CREW_BRIEFING_TEMPLATE_TITLE\)/)
 assert.match(editor,/setBody\(CREW_BRIEFING_TEMPLATE_BODY\)/)
})
