import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8')

test('reported code faults can enter the bounded autonomous repair pipeline',async()=>{
 const [ai,workflow,controller]=await Promise.all([
  read('lib/error-report-ai.ts'),
  read('.github/workflows/ai-self-heal.yml'),
  read('scripts/self-heal.mjs'),
 ])
 assert.match(ai,/dispatchSelfHealing/)
 assert.match(ai,/SELF_HEALING_GITHUB_TOKEN/)
 assert.match(ai,/ai-self-heal\.yml\/dispatches/)
 assert.match(workflow,/Autonomous repair loop/)
 assert.match(workflow,/MAX_REPAIR_ATTEMPTS/)
 assert.match(controller,/runValidation/)
 assert.match(controller,/\['npm',\['run','lint'\]\]/)
 assert.match(controller,/\['npm',\['run','typecheck'\]\]/)
 assert.match(controller,/\['npm',\['test'\]\]/)
 assert.match(controller,/build:cloudflare/)
 assert.match(controller,/repairFeedback/)
 assert.match(controller,/await releaseCheck/)
 assert.match(controller,/Gebruik confidence als diagnostische indicatie/)
 assert.match(controller,/supabase\/migrations\//)
 assert.match(controller,/CI werd niet groen/)
 assert.match(controller,/Productiedeploy werd niet bevestigd/)
 assert.match(controller,/gh.*issue.*create/s)
})

test('production deployment provisions the self-healing dispatcher secret',async()=>{
 const deploy=await read('.github/workflows/deploy-cloudflare.yml')
 assert.match(deploy,/SELF_HEALING_GITHUB_TOKEN/)
 assert.match(deploy,/self-healing GitHub credential when available/)
 assert.match(deploy,/wrangler secret put SELF_HEALING_GITHUB_TOKEN/)
})
