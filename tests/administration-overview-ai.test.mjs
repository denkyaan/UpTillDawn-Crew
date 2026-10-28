import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/[portal]/page.tsx','utf8')
const chat=readFileSync('components/administration/administration-ai-chat.tsx','utf8')
test('administration overview embeds usable AI chat and retains workspace link',()=>{
 const section=page.slice(page.indexOf('{!promotion && <section className="space-y-4"'),page.indexOf('{!promotion && <nav'))
 assert.match(section,/<AdministrationAiChat locale=\{locale\}/)
 assert.match(section,/href="\/portals\/administration\/modules\/ai"/)
 assert.match(chat,/fetch\("\/api\/administration\/assistant"/)
 assert.match(chat,/onSubmit=/)
 for(const label of ['Open AI-werkruimte',"Ouvrir l'espace IA",'Open AI workspace','KI-Arbeitsbereich öffnen'])assert.ok(section.includes(label),label)
})
