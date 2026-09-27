import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Cloudflare Worker Previews are explicitly configured', async () => {
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  assert.match(wrangler, /"previews"\s*:\s*\{[\s\S]*?"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"\s*\}[\s\S]*?\}/)
  assert.match(wrangler, /"main"\s*:\s*"\.open-next\/worker\.js"/)

  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const [major, minor] = String(pkg.devDependencies?.wrangler ?? '0.0.0')
    .replace(/^[^0-9]*/, '')
    .split('.')
    .map(Number)

  assert.ok(major > 4 || (major === 4 && minor >= 135), 'Worker Previews require Wrangler 4.135.0+')
  assert.match(pkg.scripts?.build ?? '', /opennextjs-cloudflare build/)
  assert.match(pkg.scripts?.['build:next'] ?? '', /next build/)
  assert.match(pkg.scripts?.['build:cloudflare'] ?? '', /npm run build/)
})
