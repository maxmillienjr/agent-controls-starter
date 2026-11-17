# agent-controls-starter

A control catalogue for an AI agent, mapped to framework ids, where CI fails if any control
cites a test that is missing or skipped.

**A green check means the evidence resolves, not that it is sufficient.**

You write each safeguard your agent has as a control in `controls.yaml`: what holds, which
OWASP or NIST ids it maps to, and the evidence behind it, named by a declaration, a test
title, a CI job or a heading. The linter resolves every piece of evidence against your
tracked files on each pull request, and the renderer writes `CONTROLS.md`, a matrix a reader
can check line by line.

## What a green check proves, and what it does not

It proves, for every control:

- each cited file is committed, and each cited symbol is declared in it, once;
- each cited test title appears once in its file and is not skipped;
- each cited CI job exists, in a workflow that runs on pull requests, and runs the command
  you named, when you named one;
- each cited heading is in its Markdown file;
- the status matches the kind of backing (below), and every framework id is a real id in
  that framework's registry;
- `CONTROLS.md` is what the catalogue renders today.

It does not prove:

- that a test asserts what its control claims, or that a threshold in it is right;
- that the cited job actually collects the cited test (a runner config can exclude it);
- that a control is mapped to the right framework id;
- that a framework is covered. The matrix says, per framework, how many ids have no control.

Nothing here is a claim of compliance with any framework.

## Quickstart (five minutes, on the toy agent)

You need Node 20 or later and git.

```sh
git clone <this repository> agent-controls-starter
cd agent-controls-starter
npm ci
node bin/controls.mjs lint --root examples/toy-agent
```

It prints:

```
controls lint passed: 7 control(s) (4 implemented, 1 procedural, 1 planned, 1 not-applicable), every anchor resolves, examples/toy-agent/CONTROLS.md is current.
```

Open `examples/toy-agent/CONTROLS.md` to see the matrix, and `examples/toy-agent/controls.yaml`
for what it is rendered from. The toy agent is a bike shop's service desk: a tool allowlist,
a step budget, redaction of customer contact details, a dependency audit, and one rule a
person enforces by hand.

Now break one anchor. Skip the test that control CTL-TOOL-01 cites:

```sh
perl -pi -e "s/^test\('refuses a tool/test.skip('refuses a tool/" examples/toy-agent/test/agent.test.js
node bin/controls.mjs lint --root examples/toy-agent
```

It fails with exit code 1 and says which control, which anchor and what it looked for:

```
controls lint failed with 1 problem(s):

  x examples/toy-agent/controls.yaml: CTL-TOOL-01: evidence[1] (test) does not resolve: test 'refuses a tool that is not on the allowlist' in test/agent.test.js is skipped by `test.skip`, so it does not run
```

Put it back:

```sh
git checkout examples/toy-agent/test/agent.test.js
```

`test/fixtures/` holds one broken copy of the toy catalogue per rule; `npm test` runs them all.

## Start your own catalogue

1. Copy `controls.yaml` from the root of this repository into yours. It has no controls, and
   commented examples of each status and each kind of anchor.
2. Add a control for a safeguard you already have, cite its evidence, and from your
   repository's root run `node <path to this repository>/bin/controls.mjs render` to write
   `CONTROLS.md`. `lint` instead of `render` checks without writing.
3. Commit both files. The lint resolves against tracked files only, so commit the evidence too.
4. Add the workflow in `examples/workflows/controls.yml` to `.github/workflows/`, pointing
   `uses:` at your copy of this repository. The Action installs one dependency, runs the lint,
   fails the job on any problem and writes the problems to the job summary.

The catalogue format, in full:

```yaml
registries:            # optional: directories or files of your own registries
  - governance/registries
built_in_registries: true   # optional: false to use only your own

controls:
  - id: CTL-TOOL-01    # letters, digits, dots and dashes, unique
    title: One line saying what holds
    status: implemented     # implemented | procedural | planned | not-applicable
    maps:
      - { framework: owasp-asi-2026, ref: ASI02 }
    evidence:
      - { kind: symbol, file: src/tools.js, name: checkToolCall }    # or Owner.member
      - { kind: test, file: test/agent.test.js, name: <exact title>, workflow: ci.yml, job: test }
      - { kind: ci, workflow: ci.yml, job: audit, run: npm audit }   # run is optional
      - { kind: doc, file: docs/review.md, heading: <exact heading text> }
    owner: <who delivers it>      # planned only
    rationale: <why it does not apply>   # not-applicable only, 40 characters or more
    note: <anything a reader should know>  # optional
```

| Status | Means | Needs |
| --- | --- | --- |
| `implemented` | A test or a CI job fails if the control stops holding. | At least one `test` or `ci` anchor. |
| `procedural` | A person enforces it by applying a written rule. No check does. | A `doc` anchor naming the rule, and no `test` or `ci` anchor. |
| `planned` | Not delivered yet. | An `owner`. Anchors are optional and must resolve. |
| `not-applicable` | Excluded. | A `rationale` of 40 characters or more. |

`procedural` is the column worth reading. It is where a team writes down the rules a
reviewer applies by hand, instead of letting them pass as checks.

## The rules

Each has a broken fixture in `test/fixtures/` named after it.

- `not-a-field`: a control or an anchor carries only the fields above.
- `duplicate-id`: control ids are unique.
- `implemented-without-executable-anchor`: `implemented` needs a test or a CI anchor.
- `procedural-without-doc-anchor`: `procedural` names its written rule with a doc anchor.
- `procedural-with-executable-anchor`: a control a check enforces is `implemented`, not `procedural`.
- `planned-without-owner`: `planned` names who delivers it.
- `owner-outside-planned`: only `planned` controls have an owner.
- `not-applicable-without-rationale`: `not-applicable` carries a rationale of 40 characters or more.
- `rationale-outside-not-applicable`: only `not-applicable` controls carry a rationale.
- `line-anchor`: a `file:NN` or `#L12` anchor is refused, because lines move and a line check stays green after they do.
- `path-outside-repo`: paths are relative to the repository root.
- `framework-not-in-registry`: a control maps only to a framework some registry file declares.
- `ref-not-in-registry`: each ref is an id in that framework's registry.
- `symbol-file-untracked`: a cited file is committed.
- `symbol-not-declared`: a cited symbol is declared exactly once in its file.
- `test-title-missing`: a cited test title appears exactly once in its file.
- `test-skipped`: a cited test is not skipped.
- `ci-workflow-missing`: a cited workflow is committed under `.github/workflows/`.
- `ci-job-missing`: a cited job exists in its workflow.
- `ci-run-missing`: when an anchor names a command, a step of the job runs it.
- `ci-not-on-pull-request`: a cited workflow runs on `pull_request`. A nightly job does not stop a merge.
- `doc-heading-missing`: a cited heading is in its Markdown file.
- `matrix-stale`: `CONTROLS.md` is exactly what the catalogue renders.

## Frameworks

Registries hold framework ids only: no titles and no text, which belong to their publishers.
Three ship, each with a provenance file in `registries/sources/` giving the URL, the date it
was fetched, a hash of what was fetched and the command that pulled the ids out:

| Registry id | Framework | Ids |
| --- | --- | --- |
| `owasp-llm-2025` | OWASP Top 10 for LLM Applications 2025 | 10 |
| `owasp-asi-2026` | OWASP Top 10 for Agentic Applications for 2026 | 10 |
| `nist-ai-rmf-1.0` | NIST AI 100-1, AI RMF 1.0, core subcategories | 72 |

### Add a framework

Write a registry file and list its directory under `registries:` in your catalogue:

```yaml
# governance/registries/iso-iec-42001-2023.yaml
id: iso-iec-42001-2023
title: ISO/IEC 42001:2023, Annex A
url: https://www.iso.org/standard/42001
retrieved: '2026-01-15'
unit: Annex A controls
ids:
  - A.2.2
  - A.6.2.4
```

ISO/IEC 42001 is not shipped here because its control list is in a paid standard: take the ids
from your own licensed copy. The same goes for any framework you cannot confirm on its
publisher's own pages. A new edition of a framework is a new registry id, never an edit to an
old one, so a control's mapping is not rewritten under it.

## Limits

- **Skip detection reads the line that declares a test.** For JavaScript and TypeScript it
  catches `.skip`, `.todo`, `.skipIf`, `.fixme`, `xit`, `xtest`, `xdescribe` and a node:test
  `{ skip }` or `{ todo }` option (any value, so `{ skip: false }` also counts as skipped). For
  Python it catches the `pytest.mark.skip`, `skipif` and `xfail` decorators and `unittest`'s
  `skip`, `skipIf`, `skipUnless` and `expectedFailure`, directly above the function. It does not
  see a skipped enclosing `describe`, a class-level or module-level `pytestmark`, a
  `pytest.skip()` call inside the body, `test.each` titles, titles built from variables, or a
  runner config or command-line filter that excludes the file. The table is
  `src/languages.mjs`; add a pattern or a language there.
- **A test title must be a literal string** (or, in Python, the function name), unique in its file.
- **The test's CI job is checked, not its collection.** The lint confirms the named job exists
  in a pull-request workflow, not that the job's command picks up the cited file.
- **Symbols are found by pattern, not parsed.** Declarations are matched per language in
  `src/languages.mjs` (JavaScript, TypeScript and Python today); a file in another language is
  reported as having no pattern.
- **Only GitHub Actions workflows** are understood as CI anchors.
- **A required check is not checked.** A pull-request job only blocks a merge if branch
  protection requires it; the lint cannot see repository settings.

## Where it comes from

This is extracted from the governance layer of
[agent-native-monorepo](https://github.com/maxmillienjr/agent-native-monorepo), whose
[`governance/CONTROLS.md`](https://github.com/maxmillienjr/agent-native-monorepo/blob/main/governance/CONTROLS.md)
is the full-size version of this matrix, and whose
[controls-as-code design document](https://github.com/maxmillienjr/agent-native-monorepo/blob/main/docs/prd/P4-A-controls-as-code.md)
explains why the anchors resolve by name: its evidence column cited line numbers, the old
check confirmed only that each file was long enough, and the citations had drifted while CI
stayed green.

What changed on the way out: the registries hold ids only and come from publishers' pages;
`planned` names a free-text owner instead of a planning document in the same repository; a test
anchor names the pull-request job that runs it instead of a test tier; Python is supported
beside JavaScript and TypeScript; and the matrix is plain Markdown with no formatter.

## Licence

MIT. See `LICENSE`.
