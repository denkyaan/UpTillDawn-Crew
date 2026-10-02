import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('client mutation surfaces humanize backend errors instead of rendering raw messages',async()=>{
 const files=[
  'components/crew/qr-shift-request.tsx',
  'components/crew/guestlist-entrance-client.tsx',
  'components/crew/sales-register-client.tsx',
 ]
 for(const file of files){
  const source=await read(file)
  assert.match(source,/humanizeAppError/)
  assert.doesNotMatch(source,/set(?:Error|Message)\(\s*(?:response\.)?error\.message\s*\)/)
 }
})

test('error humanizer blocks technical HTTP database and RPC details',async()=>{
 const source=await read('lib/client-error-message.ts')
 assert.match(source,/HTTP\\s\*\\d\{3\}/)
 assert.match(source,/PGRST/)
 assert.match(source,/SQLSTATE/)
 assert.match(source,/rest\\\/v1/)
 assert.match(source,/rpc\\\//)
 assert.match(source,/Deze actie is pas beschikbaar vanaf de start van het evenement\./)
 assert.match(source,/Er ging iets mis\. Probeer opnieuw\./)
})

test('human-facing error fallbacks are covered by the four-language runtime translator',async()=>{
 const source=await read('lib/client-error-message.ts')
 for(const message of [
  'Deze actie is pas beschikbaar vanaf de start van het evenement.',
  'Deze actie is niet meer beschikbaar omdat het evenement is afgelopen.',
  'Je hebt geen toegang tot deze actie.',
  'Je sessie is verlopen. Meld je opnieuw aan.',
  'Je bent momenteel offline. Controleer je internetverbinding en probeer opnieuw.',
  'De server reageert momenteel niet. Probeer over enkele ogenblikken opnieuw.',
  'Er ging iets mis. Probeer opnieuw. Blijft dit gebeuren, meld de fout via de app.',
 ])assert.ok(source.includes(message))
 assert.match(source,/translateRuntimeUi\(message,locale\)/)
})
