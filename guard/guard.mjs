// Reference solution used by the grader tests; not shipped to learners.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/workspace';
const reply = (decision, reason) => ({hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason}});

// Resolve symlinks on the longest existing prefix, so a link to intent.md is caught.
function canonical(target) {
  let current = target;
  const rest = [];
  for (;;) {
    try { return path.join(fs.realpathSync(current), ...rest); }
    catch {
      if (current === '/') return target;
      rest.unshift(path.basename(current));
      current = path.dirname(current);
    }
  }
}

function isProtected(target, cwd) {
  const absolute = path.resolve(typeof cwd === 'string' && cwd ? cwd : ROOT, target);
  return [absolute, canonical(absolute)].some(p =>
    p === `${ROOT}/intent.md` || p === `${ROOT}/tests/instructor` || p.startsWith(`${ROOT}/tests/instructor/`));
}

const unquote = token => token.replace(/^['"]|['"]$/g, '');

// The documented vocabulary only: reads, redirects, cp, mv, tee and interpreter writes.
function shellTargets(command) {
  const targets = [];
  for (const segment of command.split(/\|\||&&|[|;]/)) {
    for (const match of segment.matchAll(/>>?\s*([^\s|;&]+)/g)) targets.push(unquote(match[1]));
    const words = segment.trim().split(/\s+/).map(unquote);
    const [name, ...args] = words;
    const files = args.filter(a => !a.startsWith('-'));
    if (name === 'tee') targets.push(...files);
    if (name === 'cp' && files.length) targets.push(files.at(-1));
    if (name === 'mv') targets.push(...files);
    if (/^(python3?|node|perl|ruby)$/.test(name)) return null;
  }
  return targets;
}

export function decide(event) {
  if (!event || typeof event !== 'object') return reply('deny', 'Malformed hook event.');
  const {tool_name: tool, tool_input: input, cwd} = event;
  if (!input || typeof input !== 'object') return reply('deny', 'Malformed tool input.');
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
    if (typeof input.file_path !== 'string' || !input.file_path) return reply('deny', 'Missing file path.');
    return isProtected(input.file_path, cwd)
      ? reply('deny', 'intent.md and tests/instructor/ are protected.')
      : reply('allow', 'Ordinary source edit.');
  }
  if (tool === 'Bash') {
    if (typeof input.command !== 'string' || !input.command.trim()) return reply('deny', 'Missing command.');
    const targets = shellTargets(input.command);
    if (targets === null) return reply('deny', 'Interpreter commands cannot be classified; denied conservatively.');
    return targets.some(t => isProtected(t, cwd))
      ? reply('deny', 'The command writes to a protected file.')
      : reply('allow', 'No protected write detected.');
  }
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') return reply('allow', 'Read-only tool.');
  return reply('deny', 'Unknown tool.');
}
