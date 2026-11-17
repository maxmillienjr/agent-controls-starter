/**
 * The linter's tests. Each fixture in test/fixtures/ is the toy agent's catalogue with one
 * thing broken, so each run must fail with exactly one problem, and that problem must name
 * the control and the rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from '../src/anchors.mjs';
import { languageOf } from '../src/languages.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const cli = join(repoRoot, 'bin', 'controls.mjs');
const example = join(repoRoot, 'examples', 'toy-agent');
const fixtures = join(here, 'fixtures');

function lint(args, env = {}) {
  const run = spawnSync(process.execPath, [cli, 'lint', ...args], {
    encoding: 'utf-8',
    cwd: repoRoot,
    env: { ...process.env, GITHUB_STEP_SUMMARY: '', ...env },
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

const problems = (stderr) =>
  stderr
    .split('\n')
    .filter((line) => line.startsWith('  x '))
    .map((line) => line.trim());

test('the blank catalogue passes, and its matrix is current', () => {
  const run = lint([]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /0 control\(s\).*CONTROLS\.md is current/);
});

test('the toy agent passes, and its matrix is current', () => {
  const run = lint(['--root', example]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /7 control\(s\) \(4 implemented, 1 procedural, 1 planned, 1 not-applicable\)/);
});

test('the matrix opens with the count line and the green-check sentence', () => {
  const lines = readFileSync(join(example, 'CONTROLS.md'), 'utf-8').split('\n').filter((l) => l.trim());
  assert.equal(lines[1], '# Controls');
  assert.match(lines[2], /^7 controls: /);
  assert.equal(lines[3], '**A green check means the evidence resolves, not that it is sufficient.**');
});

// [fixture, control it must name, the rule's message]
const RULES = [
  ['not-a-field', 'CTL-NET-01', /`color` is not a field here/],
  ['duplicate-id', 'CTL-TOOL-01', /the id is used twice/],
  ['implemented-without-executable-anchor', 'CTL-REVIEW-01', /is implemented with no test or ci anchor/],
  ['procedural-without-doc-anchor', 'CTL-REVIEW-01', /is procedural with no doc anchor/],
  ['procedural-with-executable-anchor', 'CTL-REVIEW-01', /is procedural but has a test or ci anchor/],
  ['planned-without-owner', 'CTL-MEM-01', /is planned with no owner/],
  ['owner-outside-planned', 'CTL-NET-01', /has an owner but is `not-applicable`/],
  ['not-applicable-without-rationale', 'CTL-NET-01', /without a rationale of at least 40 characters/],
  ['rationale-outside-not-applicable', 'CTL-SUPPLY-01', /has a rationale but is `implemented`/],
  ['line-anchor', 'CTL-TOOL-01', /evidence\[0\]\.file: line anchors rot/],
  ['path-outside-repo', 'CTL-TOOL-01', /evidence\[0\]\.file: must be relative to the repository root/],
  ['framework-not-in-registry', 'CTL-NET-01', /framework `iso-iec-42001-2023`, which no registry file declares/],
  ['ref-not-in-registry', 'CTL-NET-01', /maps to `ASI11`, which is not an id in the owasp-asi-2026 registry/],
  ['symbol-file-untracked', 'CTL-DATA-01', /`src\/scrub\.js` is not a tracked file/],
  ['symbol-not-declared', 'CTL-TOOL-01', /declaration of `checkToolCalls` in src\/tools\.js and found 0 lines/],
  ['test-title-missing', 'CTL-COST-01', /a test titled 'stops when the budget is spent' .* found 0 tests/],
  ['test-skipped', 'CTL-COST-01', /is skipped by `test\.skip`, so it does not run/],
  ['ci-workflow-missing', 'CTL-SUPPLY-01', /`\.github\/workflows\/security\.yml` is not a tracked workflow/],
  ['ci-job-missing', 'CTL-SUPPLY-01', /agent\.yml has no job `licences`/],
  ['ci-run-missing', 'CTL-SUPPLY-01', /has no step whose run contains `npm run check-licences`/],
  ['ci-not-on-pull-request', 'CTL-SUPPLY-01', /nightly\.yml is not triggered by pull_request/],
  ['doc-heading-missing', 'CTL-REVIEW-01', /heading `New tools need two reviewers` in docs\/review\.md/],
  ['matrix-stale', 'CONTROLS.md', /CONTROLS\.md is stale/],
];

for (const [name, control, cause] of RULES) {
  test(`fixture ${name} fails with its own rule, naming ${control}`, () => {
    const run = lint([
      '--root', example,
      '--catalogue', join(fixtures, `${name}.yaml`),
      '--matrix', join(example, 'CONTROLS.md'),
    ]);
    assert.equal(run.status, 1, `expected exit 1, got ${run.status}:\n${run.stdout}`);
    const found = problems(run.stderr);
    assert.equal(found.length, 1, `expected exactly one problem, got:\n${found.join('\n')}`);
    assert.ok(found[0].includes(control), `the problem does not name ${control}: ${found[0]}`);
    assert.match(found[0], cause);
  });
}

test('every fixture on disk is in the rule table', () => {
  const onDisk = execFileSync('ls', [fixtures], { encoding: 'utf-8' })
    .split('\n')
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort();
  assert.deepEqual(onDisk, RULES.map(([n]) => n).sort());
});

test('a failing run writes its problems to the job summary', () => {
  const dir = mkdtempSync(join(tmpdir(), 'controls-summary-'));
  try {
    const summary = join(dir, 'summary.md');
    writeFileSync(summary, '');
    const run = lint(
      ['--root', example, '--catalogue', join(fixtures, 'test-skipped.yaml'), '--matrix', join(example, 'CONTROLS.md')],
      { GITHUB_STEP_SUMMARY: summary },
    );
    assert.equal(run.status, 1);
    const text = readFileSync(summary, 'utf-8');
    assert.match(text, /Controls lint failed: 1 problem/);
    assert.match(text, /CTL-COST-01: .* is skipped by `test\.skip`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * An anchor keeps resolving when the lines above it move, and stops resolving when the
 * thing it names is renamed. Runs on a copy of the example in its own git repository,
 * because resolution reads `git ls-files`.
 */
test('an anchor survives twenty inserted lines and fails on a rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'controls-anchor-'));
  try {
    cpSync(example, dir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: dir, env: gitEnv() });
    execFileSync('git', ['add', '-A'], { cwd: dir, env: gitEnv() });
    const source = join(dir, 'src', 'tools.js');
    const original = readFileSync(source, 'utf-8');

    writeFileSync(source, '// padding\n'.repeat(20) + original);
    const moved = lint(['--root', dir]);
    assert.equal(moved.status, 0, moved.stderr);

    writeFileSync(source, original.replace('function checkToolCall(', 'function checkCall('));
    const renamed = lint(['--root', dir]);
    assert.equal(renamed.status, 1);
    const found = problems(renamed.stderr);
    assert.equal(found.length, 1, found.join('\n'));
    assert.match(found[0], /CTL-TOOL-01: evidence\[0\] \(symbol\) does not resolve/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a file that exists but is not committed is not evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'controls-untracked-'));
  try {
    cpSync(example, dir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: dir, env: gitEnv() });
    execFileSync('git', ['add', '-A'], { cwd: dir, env: gitEnv() });
    execFileSync('git', ['rm', '-q', '--cached', 'docs/review.md'], { cwd: dir, env: gitEnv() });
    const run = lint(['--root', dir]);
    assert.equal(run.status, 1);
    assert.match(problems(run.stderr)[0], /CTL-REVIEW-01: .* `docs\/review\.md` is not a tracked file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- The skip table, one case per form -----------------------------------------------

const skipped = (file, text, title) => {
  const found = languageOf(file).tests(text).filter((t) => t.title === title);
  assert.equal(found.length, 1, `expected one test titled ${title}`);
  return found[0].skippedBy;
};

const JS_SKIPPED = [
  ["it.skip('t', () => {})", 'it.skip'],
  ["test.skip('t', () => {})", 'test.skip'],
  ["describe.skip('t', () => {})", 'describe.skip'],
  ["test.todo('t')", 'test.todo'],
  ["it.skipIf(process.env.CI)('t', () => {})", 'it.skipIf'],
  ["test.fixme('t', () => {})", 'test.fixme'],
  ["xit('t', () => {})", 'xit'],
  ["xtest('t', () => {})", 'xtest'],
  ["xdescribe('t', () => {})", 'xdescribe'],
  ["test('t', { skip: true }, () => {})", 'skip/todo'],
  ["test('t', { todo: 'later' }, () => {})", 'skip/todo'],
];

for (const [source, marker] of JS_SKIPPED) {
  test(`JavaScript: ${source} is skipped`, () => {
    assert.ok(skipped('a.test.ts', source, 't')?.includes(marker));
  });
}

for (const source of ["it('t', () => {})", "test('t', async () => {})", "test.only('t', () => {})", 'it(`t`, () => {})', "it.runIf(true)('t', () => {})"]) {
  test(`JavaScript: ${source} runs`, () => {
    assert.equal(skipped('a.test.js', source, 't'), null);
  });
}

const PY_SKIPPED = [
  '@pytest.mark.skip(reason="later")',
  '@pytest.mark.skipif(sys.platform == "win32", reason="posix")',
  '@pytest.mark.xfail',
  '@unittest.skip("later")',
  '@unittest.skipIf(True, "no")',
  '@unittest.skipUnless(False, "no")',
  '@unittest.expectedFailure',
];

for (const decorator of PY_SKIPPED) {
  test(`Python: ${decorator} skips the test below it`, () => {
    const text = `${decorator}\n@pytest.mark.slow\ndef test_refuses_unknown_tool():\n    assert True\n`;
    assert.ok(skipped('test_tools.py', text, 'test_refuses_unknown_tool'));
  });
}

test('Python: an undecorated test, or one with an unrelated mark, runs', () => {
  const text = '@pytest.mark.slow\ndef test_a():\n    pass\n\nclass TestB:\n    def test_b(self):\n        pass\n';
  assert.equal(skipped('test_x.py', text, 'test_a'), null);
  assert.equal(skipped('test_x.py', text, 'test_b'), null);
});

test('Python: a symbol and a class member resolve by name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'controls-py-'));
  try {
    mkdirSync(join(dir, 'agent'));
    writeFileSync(
      join(dir, 'agent', 'tools.py'),
      'ALLOWED = {"lookup"}\n\n\nclass Gate:\n    limit: int = 6\n\n    def check(self, call):\n        return call in ALLOWED\n\n\ndef run():\n    pass\n',
    );
    execFileSync('git', ['init', '-q'], { cwd: dir, env: gitEnv() });
    execFileSync('git', ['add', '-A'], { cwd: dir, env: gitEnv() });
    const catalogue = join(dir, 'controls.yaml');
    const write = (name) =>
      writeFileSync(
        catalogue,
        `controls:\n  - id: C-1\n    title: t\n    status: planned\n    owner: me\n    maps: [{ framework: owasp-llm-2025, ref: 'LLM06:2025' }]\n    evidence:\n      - { kind: symbol, file: agent/tools.py, name: ${name} }\n`,
      );
    for (const name of ['ALLOWED', 'Gate', 'Gate.check', 'Gate.limit', 'run']) {
      write(name);
      const run = lint(['--root', dir, '--catalogue', catalogue, '--matrix', join(dir, 'M.md')]);
      // Everything resolves, so the only problem is that the matrix was never rendered.
      assert.deepEqual(problems(run.stderr).map((p) => /stale/.test(p)), [true], `${name}: ${run.stderr}`);
    }
    write('Gate.missing');
    const run = lint(['--root', dir, '--catalogue', catalogue, '--matrix', join(dir, 'M.md')]);
    assert.match(problems(run.stderr)[0], /member `missing` of `Gate`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
