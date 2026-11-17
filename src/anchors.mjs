/**
 * Evidence anchors that resolve by name, not by line.
 *
 * An anchor names a thing: a declaration, a test title, a workflow job, a heading. It is
 * resolved by reading the file's text, so it keeps resolving when the lines above it move
 * and fails when the named thing is renamed, removed or skipped. A `file:NN` line anchor is
 * refused, because a line check stays green after the line stops holding what it named.
 *
 * Every resolver returns `null` when the anchor resolves and a sentence saying what was
 * looked for when it does not.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { languageOf } from './languages.mjs';

export const LINE_ANCHOR_MESSAGE = 'line anchors rot; name a symbol, a test, a job or a heading';

/** The environment for a git call that must find its repository from `cwd`. */
export function gitEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
}

/**
 * The tracked tree under `root`. Only tracked files count as evidence: a file that exists on
 * one machine and is not committed is not in the checkout a pull request runs on.
 */
export function createRepo(root) {
  let listing;
  try {
    listing = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf-8',
      env: gitEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`${root} is not inside a git work tree; anchors resolve against tracked files`);
  }
  const tracked = new Set(listing.split('\0').filter(Boolean));
  const cache = new Map();
  return {
    root,
    tracked,
    has: (path) => tracked.has(path),
    read(path) {
      if (!cache.has(path)) cache.set(path, readFileSync(join(root, path), 'utf-8'));
      return cache.get(path);
    },
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// --- symbol ----------------------------------------------------------------------------

/**
 * `name` is declared on exactly one line of `file`. `Owner.member` names a member inside
 * an owner: the owner resolves as above, and exactly one line of its body declares it.
 */
export function resolveSymbol(repo, file, name) {
  if (!repo.has(file)) return `\`${file}\` is not a tracked file`;
  const language = languageOf(file);
  if (!language)
    return `no declaration pattern for \`${file}\`; add its language to src/languages.mjs`;
  const lines = repo.read(file).split('\n');
  const [owner, memberName] = name.split('.');
  const hits = lines.flatMap((line, i) => (language.declaration(owner).test(line) ? [i] : []));
  if (hits.length !== 1)
    return `looked for a declaration of \`${owner}\` in ${file} and found ${plural(hits.length, 'line')}, not 1`;
  if (!memberName) return null;
  let end = hits[0] + 1;
  while (end < lines.length && !(lines[end].trim() && language.blockEnd.test(lines[end]))) end++;
  const members = lines
    .slice(hits[0] + 1, end)
    .filter((line) => language.member(memberName).test(line)).length;
  if (members !== 1)
    return `looked for member \`${memberName}\` of \`${owner}\` in ${file} and found ${plural(members, 'line')}, not 1`;
  return null;
}

// --- ci --------------------------------------------------------------------------------

function triggersOf(on) {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === 'object') return Object.keys(on);
  return [];
}

/**
 * `.github/workflows/<workflow>` is tracked and parses, it is triggered by `pull_request`,
 * `jobs.<job>` exists, and when `run` is given one of the job's steps has a `run:` that
 * contains it. Returns `{ error }` or `{ triggers }`.
 */
export function resolveCi(repo, workflow, job, run) {
  const path = `.github/workflows/${workflow}`;
  if (!repo.has(path)) return { error: `\`${path}\` is not a tracked workflow` };
  let doc;
  try {
    doc = parseYaml(repo.read(path)) ?? {};
  } catch (e) {
    return { error: `${path} does not parse: ${e.message.split('\n')[0]}` };
  }
  const triggers = triggersOf(doc.on);
  if (!triggers.includes('pull_request'))
    return {
      error: `${path} is not triggered by pull_request (it runs on: ${triggers.join(', ') || 'nothing'})`,
    };
  const found = doc.jobs?.[job];
  if (!found) return { error: `${path} has no job \`${job}\`` };
  if (run !== undefined) {
    const steps = found.steps ?? [];
    if (!steps.some((s) => typeof s?.run === 'string' && s.run.includes(run)))
      return { error: `job \`${job}\` in ${path} has no step whose run contains \`${run}\`` };
  }
  return { triggers };
}

// --- test ------------------------------------------------------------------------------

/**
 * Exactly one test in `file` has `name` as its title, nothing in the skip table marks it,
 * and the CI job that runs it resolves as a `ci` anchor does.
 */
export function resolveTest(repo, file, name, ci) {
  if (!repo.has(file)) return `\`${file}\` is not a tracked file`;
  const language = languageOf(file);
  if (!language) return `no test pattern for \`${file}\`; add its language to src/languages.mjs`;
  const tests = language.tests(repo.read(file)).filter((t) => t.title === name);
  if (tests.length !== 1)
    return `looked for a test titled '${name}' in ${file} and found ${plural(tests.length, 'test')}, not 1`;
  if (tests[0].skippedBy)
    return `test '${name}' in ${file} is skipped by \`${tests[0].skippedBy}\`, so it does not run`;
  return resolveCi(repo, ci.workflow, ci.job, ci.run).error ?? null;
}

// --- doc -------------------------------------------------------------------------------

/** Markdown headings outside fenced code blocks, as their literal text. */
export function headings(text) {
  const out = [];
  let fence = null;
  for (const line of text.split('\n')) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) out.push(h[1]);
  }
  return out;
}

export function resolveDoc(repo, file, heading) {
  if (!repo.has(file)) return `\`${file}\` is not a tracked file`;
  if (!headings(repo.read(file)).includes(heading))
    return `looked for the heading \`${heading}\` in ${file} and did not find it`;
  return null;
}
