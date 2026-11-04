import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const deploy = readFileSync('.github/workflows/deploy-cloudflare.yml', 'utf8')
const security = readFileSync('tests/sql/security-definer-surface.sql', 'utf8')

test('production deploy requires explicit release approval on main after full CI', () => {
  assert.match(deploy, /workflow_dispatch:/)
  assert.doesNotMatch(deploy, /workflow_run:/)
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/)
  assert.match(deploy, /environment: production/)
  assert.match(deploy, /Require successful full CI for exact release commit/)
  assert.match(deploy, /actions\/workflows\/ci\.yml\/runs\?head_sha=\$\{GITHUB_SHA\}/)
  assert.match(deploy, /\.conclusion == "success"/)
})

test('security cleanup baseline keeps anonymous SECURITY DEFINER access closed', () => {
  assert.match(security, /PUBLIC and anonymous execute are forbidden/)
  assert.match(security, /retired anonymous admin lockout RPC remains executable/)
  assert.match(security, /unexpected SECURITY DEFINER function\(s\) are executable by anon/)
})
