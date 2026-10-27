import test from 'node:test';
import assert from 'node:assert/strict';
import {decide} from '../../../guard/guard.mjs';

const decision = event => decide(event).hookSpecificOutput.permissionDecision;

test('protected writes are denied', () => {
  assert.equal(decision({tool_name: 'Write', tool_input: {file_path: '/workspace/intent.md', content: 'x'}, cwd: '/workspace'}), 'deny');
  assert.equal(decision({tool_name: 'Bash', tool_input: {command: 'printf x > intent.md'}, cwd: '/workspace'}), 'deny');
});

test('source edits and reads are allowed', () => {
  assert.equal(decision({tool_name: 'Edit', tool_input: {file_path: '/workspace/src/app.mjs'}, cwd: '/workspace'}), 'allow');
  assert.equal(decision({tool_name: 'Bash', tool_input: {command: 'cat intent.md'}, cwd: '/workspace'}), 'allow');
});
