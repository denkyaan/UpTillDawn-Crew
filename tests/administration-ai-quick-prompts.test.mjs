import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const chat=readFileSync("components/administration/administration-ai-chat.tsx","utf8")
const catalog=readFileSync("lib/ui-translation-extensions.ts","utf8")
test("administration AI offers actionable quick prompts for each supported locale",()=>{
 for(const locale of ["nl","fr","en","de"])assert.match(chat,new RegExp("\\b"+locale+":\\["))
 assert.match(chat,/suggestions\[locale\]\.map/)
 assert.match(chat,/onClick=\{\(\)=>setMessage\(prompt\)\}/)
 assert.match(chat,/disabled=\{busy\}/)
})
test("quick prompt copy is registered in translation catalog",()=>{
 for(const prompt of ["Welke administratie vraagt aandacht?","Which artists need follow-up?","Y a-t-il des heures en attente ?","Gibt es eingereichte Arbeitszeiten?"])assert.ok(catalog.includes(JSON.stringify(prompt)),prompt)
})
