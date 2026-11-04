import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const file = path => new URL('../' + path, import.meta.url)
const read = path => readFile(file(path), 'utf8')

test('retired self-healing workflow remains absent from main', async () => {
  await assert.rejects(access(file('.github/workflows/ai-self-heal.yml')), { code: 'ENOENT' })
})

test('production deployment retains optional self-healing credential configuration', async () => {
  const deploy = await read('.github/workflows/deploy-cloudflare.yml')
  assert.match(deploy, /SELF_HEALING_GITHUB_TOKEN/)
  assert.match(deploy, /self-healing GitHub credential when available/)
  assert.match(deploy, /wrangler secret put SELF_HEALING_GITHUB_TOKEN/)
})
