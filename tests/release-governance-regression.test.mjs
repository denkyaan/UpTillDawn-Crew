import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const deploy = readFileSync('.github/workflows/deploy-cloudflare.yml', 'utf8')
const security = readFileSync('tests/sql/security-definer-surface.sql', 'utf8')

test('production deploy is reachable only from a successful main CI workflow run', () => {
  assert.match(deploy, /workflow_run:/)
  assert.match(deploy, /workflows: \["CI"\]/)
  assert.match(deploy, /branches: \[main\]/)
  assert.match(deploy, /github\.event\.workflow_run\.conclusion == 'success'/)
  assert.match(deploy, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
  assert.doesNotMatch(deploy, /workflow_dispatch:/)
})

test('security cleanup baseline keeps anonymous SECURITY DEFINER access closed', () => {
  assert.match(security, /PUBLIC and anonymous execute are forbidden/)
  assert.match(security, /retired anonymous admin lockout RPC remains executable/)
  assert.match(security, /unexpected SECURITY DEFINER function\(s\) are executable by anon/)
})
