import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('God Mode API failures use the same human-facing error boundary as the ordinary app',async()=>{
 for(const file of ['components/god-mode/god-studio.tsx','components/god-mode/god-mode-editor.tsx']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8')
  assert.match(source,/humanizeAppError/)
  assert.doesNotMatch(source,/throw new Error\(data\.error\|\|/)
  assert.doesNotMatch(source,/set(?:Message|AiError)\(payload\?\.error\|\|/)
 }
})

test('God Mode retains three role editor and safe source rollback workflow',async()=>{
 const [editor,studio]=await Promise.all([
  readFile(new URL('../components/god-mode/god-mode-editor.tsx',import.meta.url),'utf8'),
  readFile(new URL('../components/god-mode/god-studio.tsx',import.meta.url),'utf8'),
 ])
 for(const role of ['admin','staff','responsible_lead'])assert.ok(editor.includes(`value:"${role}"`))
 assert.match(studio,/Herstelvoorstel/)
 assert.match(studio,/action:'restore'/)
 assert.match(studio,/Geteste versie publiceren/)
 assert.match(studio,/tests uit/)
})

test('God Mode inspection supports mobile tablet and desktop previews',async()=>{
 const studio=await readFile(new URL('../components/god-mode/god-studio.tsx',import.meta.url),'utf8')
 for(const width of ['390px','768px','100%'])assert.ok(studio.includes(`value="${width}"`))
 assert.match(studio,/iframe title="App onderdelen selecteren"/)
})
