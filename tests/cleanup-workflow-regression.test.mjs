import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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

test('cleanup retains exactly one latest successful or failed run across branches', () => {
  const source = readFileSync(workflowDir + '/cleanup-actions-history.yml', 'utf8');
  assert.match(source, /workflow_run:\s*\n\s*workflows: \["CI main", "Deploy main", "CI production", "Deploy production"\]/);
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /for workflow in fast-change-validation\.yml deploy-main\.yml ci\.yml deploy-cloudflare\.yml cleanup-actions-history\.yml;/);
  assert.match(source, /actions\/workflows\/\$workflow\/runs\?per_page=100"/);
  assert.match(source, /\[ "\$id" != "\$CURRENT_RUN_ID" \] \|\| continue/);
  assert.match(source, /if \[ "\$status" != "completed" \]; then/);
  // Execute the exact planner used by the deletion step, without API calls.
  const planner = source.match(/jq -c --arg current "\$CURRENT_RUN_ID" --arg workflow "\$1" '([\s\S]*?)'\n/);
  assert.ok(planner, 'Missing actual retention planner');
  const run = (id, conclusion, head_branch = 'main', status = 'completed') =>
    ({ id, run_number: id, conclusion, head_branch, status });
  const pages = [
    { workflow_runs: [run(9, null, 'main', 'in_progress'), run(8, 'cancelled'), run(7, 'failure', 'feature'), run(5, 'success')] },
    { workflow_runs: [run(5, 'success'), run(4, null, 'main', 'queued')] },
  ];
  const plan = (workflow, history, current = '99') => JSON.parse(execFileSync('jq',
    ['-c', '--arg', 'current', current, '--arg', 'workflow', workflow, planner[1]],
    { input: JSON.stringify(history), encoding: 'utf8' }));
  assert.deepEqual(plan('fast-change-validation.yml', pages), { keep: 7, delete: [8, 5] });
  assert.deepEqual(plan('ci.yml', [{ workflow_runs: [run(10, 'success'), run(9, 'failure')] }]), { keep: 10, delete: [9] });
  assert.deepEqual(plan('deploy-main.yml', pages, '7'), { keep: 5, delete: [8] });
  assert.deepEqual(plan('cleanup-actions-history.yml', pages), { keep: null, delete: [8, 7, 5] });
  assert.deepEqual(plan('deploy-cloudflare.yml', [{ workflow_runs: [run(1, 'cancelled')] }]), { keep: null, delete: [1] });
  assert.deepEqual(plan('ci.yml', [{ workflow_runs: [] }]), { keep: null, delete: [] });
});

test('retired workflows lose completed history without touching approved or active runs', () => {
  const source = readFileSync(workflowDir + '/cleanup-actions-history.yml', 'utf8');
  assert.match(source, /actions\/workflows\/\$workflow" --jq '\.id'/);
  assert.match(source, /actions\/runs\?per_page=100/);
  const planner = source.match(/jq -c --argjson protected "\$1" --arg current "\$CURRENT_RUN_ID" '([\s\S]*?)'\n/);
  assert.ok(planner, 'Missing retired-workflow planner');
  const run = (id, workflow_id, status = 'completed') => ({ id, workflow_id, status });
  const pages = [{workflow_runs: [run(1, 11), run(2, 99), run(3, 99, 'queued'), run(4, 99, 'in_progress'), run(5, 99), run(6, 15)]},
    {workflow_runs: [run(2, 99), run(7, 12), run(8, null)]}];
  const result = JSON.parse(execFileSync('jq',
    ['-c', '--argjson', 'protected', '[11,12,13,14,15]', '--arg', 'current', '5', planner[1]],
    {input: JSON.stringify(pages), encoding: 'utf8'}));
  assert.deepEqual(result, [2]);
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
