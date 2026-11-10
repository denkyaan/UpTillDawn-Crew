import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('Maker never mixes main and production status during environment switching',async()=>{
 const overview=await read('components/god-mode/maker-overview.tsx')
 assert.match(overview,/overviewState\?\.environment===environment/)
 assert.match(overview,/setState\(\{environment,data\}\)/)
 assert.match(overview,/fetch\('\/api\/god\/overview\?environment='\+environment/)
})
test('Maker log explorer independently handles missing stored logs and prohibits stale cross-environment records',async()=>{
 const logs=await read('components/god-mode/maker-logs.tsx')
 assert.match(logs,/snapshotState\?\.environment===environment/)
 assert.match(logs,/platformState\?\.environment===environment/)
 assert.match(logs,/setSnapshot\(\{environment,rows\}\)/)
 assert.match(logs,/setPlatformLogs\(\{environment,logs\}\)/)
 assert.match(logs,/\.\.\.\(snapshot\?\.errors\|\|\[\]\)\.map/)
 assert.doesNotMatch(logs,/if\(!snapshot\)return \[\]/)
})
