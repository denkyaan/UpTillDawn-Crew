import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('CI proves database can be rebuilt from repository migrations', async () => {
  const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')
  assert.match(workflow,/jobs:\s*\n\s*build:/)
  assert.doesNotMatch(workflow,/\n  fresh-install:/)
  assert.match(workflow,/supabase@2\.117\.0 init/)
  assert.match(workflow,/supabase@2\.117\.0 start/)
  assert.match(workflow,/db reset --local --no-seed/)
  assert.match(workflow,/tests\/sql\/\*\.sql/)
  assert.match(workflow,/psql "\$PGURL" -v ON_ERROR_STOP=1/)
  assert.match(workflow,/gen types typescript --local --schema public/)
  assert.match(workflow,/expected-crew-database\.ts/)
  assert.match(workflow,/actual-crew-database\.ts/)
  assert.match(workflow,/__InternalSupabase/)
  assert.match(workflow,/diff -u \/tmp\/expected-crew-database\.ts \/tmp\/actual-crew-database\.ts/)
  assert.match(workflow,/Fresh-install database proof/)
  assert.match(workflow,/Reset isolated database for browser fixtures/)
  assert.equal((workflow.match(/runs-on:/g)||[]).length,1,'CI release validation must stay on one hosted runner')
  assert.match(workflow,/if: always\(\)/)
  assert.match(workflow,/stop --no-backup/)
})
