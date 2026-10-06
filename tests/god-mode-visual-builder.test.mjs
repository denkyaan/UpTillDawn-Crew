import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('god mode opens in visual builder with all three role previews', async () => {
  const studio = await readFile(new URL('../components/god-mode/god-studio.tsx', import.meta.url), 'utf8')
  const builder = await readFile(new URL('../components/god-mode/god-visual-builder.tsx', import.meta.url), 'utf8')
  const route = await readFile(new URL('../app/api/god/preview-role/route.ts', import.meta.url), 'utf8')

  assert.ok(studio.includes("useState<Tab>('builder')"))
  assert.ok(studio.includes("['builder','Live Builder']"))
  assert.ok(studio.includes("['automations','Automaties']"))
  for (const role of ['staff','responsible_lead','admin']) assert.ok(builder.includes(role))
  assert.ok(builder.includes('Preview toepassen'))
  assert.ok(builder.includes('AI-codevoorstel maken'))
  assert.ok(builder.includes('Thema & kleuren'))
  assert.ok(builder.includes('Functie / knop toevoegen'))
  assert.ok(route.includes("upt_set_admin_role_mode"))
  assert.ok(route.includes("upt_current_is_owner"))
})

test('god mode includes automation builder', async () => {
  const automation = await readFile(new URL('../components/god-mode/god-automation-builder.tsx', import.meta.url), 'utf8')
  assert.ok(automation.includes('Automaties maken en bewerken'))
  assert.ok(automation.includes('Automation Builder'))
  assert.ok(automation.includes('AI-implementatievoorstel maken'))
  assert.ok(automation.includes('lib/automation-engine.ts'))
})

test('god mode role previews mirror the consolidated production surfaces',async()=>{
  const builder=await readFile(new URL('../components/god-mode/god-visual-builder.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(builder,/label:'Shifts',path:'\/shifts'/)
  for(const entry of [
    "label:'Werkplaatsen & shifts',path:'/workplaces'",
    "label:'Inventaris',path:'/inventory'",
    "label:'Inkom & Guestlist',path:'/guestlist'",
  ])assert.ok(builder.includes(entry),entry)
})
