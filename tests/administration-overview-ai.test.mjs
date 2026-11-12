import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const home=readFileSync('app/(app)/portals/[portal]/page.tsx','utf8')
const aiPage=readFileSync('app/(app)/portals/administration/modules/ai/page.tsx','utf8')
const chat=readFileSync('components/administration/administration-ai-chat.tsx','utf8')
const navigation=readFileSync('lib/administration/navigation.ts','utf8')

test('AI stays available in its canonical Administration subtab without duplicate home entry',()=>{
 assert.match(home,/return <AdministrationOverviewDashboard locale=\{locale\}/)
 assert.doesNotMatch(home,/<AdministrationAiChat/)
 assert.doesNotMatch(home,/href="\/portals\/administration\/modules\/ai"/)
 assert.match(navigation,/slugs:\["notifications","automations","ai"/)
 assert.match(aiPage,/<AdministrationAiChat locale=\{locale\}/)
 assert.match(chat,/fetch\("\/api\/administration\/assistant"/)
 assert.match(chat,/onSubmit=/)
})
