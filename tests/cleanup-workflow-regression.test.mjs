import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const workflowDir = '.github/workflows';
const approved = [
  'ci.yml',
  'cleanup-actions-history.yml',
  'deploy-cloudflare.yml',
  'deploy-main.yml',
  'fast-change-validation.yml',
].sort();

test('only five approved GitHub Actions workflows exist', () => {
  assert.deepEqual(readdirSync(workflowDir).filter(name => /\.ya?ml$/.test(name)).sort(), approved);
});

test('cleanup preserves only the latest actual success and actual failure', () => {
  const source = readFileSync(workflowDir + '/cleanup-actions-history.yml', 'utf8');
  assert.match(source, /\[ "\$conclusion" = "success" \]/);
  assert.match(source, /\[ "\$conclusion" = "failure" \]/);
  assert.doesNotMatch(source, /\[ "\$conclusion" != "success" \]/);
  assert.match(source, /\[ "\$id" = "\$CURRENT_RUN_ID" \] && continue/);
  assert.match(source, /status=completed/);
});

test('full CI retains isolated database replay and authenticated browser gates', () => {
  const source = readFileSync(workflowDir + '/ci.yml', 'utf8');
  for (const gate of [
    'Replay every migration from zero',
    'Run SQL regression suites',
    'Run 15 concurrent authenticated browser bots',
    'Full authenticated Administration browser E2E',
    'Verify authenticated E2E interaction inventory',
  ]) assert.ok(source.includes(gate), 'Missing full CI gate: ' + gate);
});

test('main CI does not deploy production and deploy main requires validated CI', () => {
  const fast = readFileSync(workflowDir + '/fast-change-validation.yml', 'utf8');
  const deploy = readFileSync(workflowDir + '/deploy-main.yml', 'utf8');
  assert.doesNotMatch(fast, /wrangler deploy|deploy:cloudflare/);
  assert.match(deploy, /workflow_run:/);
  assert.match(deploy, /CI main/);
  assert.match(deploy, /SOURCE_RESULT/);
});
