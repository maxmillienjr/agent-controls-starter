/**
 * How a symbol is declared, how a test is found and how a skipped test looks, per language.
 *
 * This is the table to extend. Each entry matches files by extension and supplies:
 *
 * - `declaration(name)`: a regex that matches the one line declaring a top-level `name`;
 * - `member(name)`: a regex for a member line inside an owner's body (`Owner.member` anchors);
 * - `blockEnd`: a regex for the first line after the owner's body;
 * - `tests(text)`: every test in the file as `{ title, skippedBy }`, where `skippedBy` is the
 *   marker that stops it running, or `null`.
 *
 * What is not covered is listed in the README under "Limits". The short version: a test is
 * judged by the line that declares it and the decorators or options attached to it, not by
 * an enclosing block, a runner config file or a command-line filter.
 */

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- JavaScript and TypeScript (node:test, Jest, Vitest, Mocha, Jasmine) ----------------

/** Modifiers after `it`/`test`/`describe` that stop the test running. */
export const JS_SKIP_MODIFIERS = [/\.skip\b/, /\.todo\b/, /\.skipIf\b/, /\.fixme\b/];

/** Function names that are a skipped test on their own (Jest and Jasmine). */
export const JS_SKIP_FUNCTIONS = ['xit', 'xtest', 'xdescribe'];

/** An options object between the title and the body (node:test): `{ skip: true }`. */
export const JS_SKIP_OPTIONS = [/^\s*,\s*\{[^}]*\b(?:skip|todo)\s*:/];

const JS_TEST_CALL =
  /\b(x?it|x?test|x?describe)((?:\.(?:only|skip|todo|fixme|concurrent|sequential|fails|skipIf\([^)]*\)|runIf\([^)]*\)))*)\s*\(\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;

function jsTests(text) {
  return [...text.matchAll(JS_TEST_CALL)].map((m) => {
    const [whole, fn, modifiers, , raw] = m;
    const after = text.slice(m.index + whole.length, m.index + whole.length + 200);
    let skippedBy = null;
    if (JS_SKIP_FUNCTIONS.includes(fn)) skippedBy = fn;
    for (const re of JS_SKIP_MODIFIERS) if (!skippedBy && re.test(modifiers)) skippedBy = `${fn}${modifiers}`;
    for (const re of JS_SKIP_OPTIONS) if (!skippedBy && re.test(after)) skippedBy = `${fn}(..., { skip/todo })`;
    return { title: raw.replace(/\\(.)/g, '$1'), skippedBy };
  });
}

const javascript = {
  name: 'JavaScript/TypeScript',
  extensions: /\.[cm]?[jt]sx?$/,
  declaration: (name) =>
    new RegExp(
      '^\\s*(?:export\\s+)?(?:default\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+)?' +
        `(?:function\\*?|class|const|let|var|interface|type|enum)\\s+${escape(name)}(?![\\w$])`,
    ),
  member: (name) =>
    new RegExp(
      '^\\s+(?:(?:public|private|protected|static|readonly|async|override|abstract|declare|get|set)\\s+)*' +
        `\\*?${escape(name)}\\s*\\??\\s*[(<:=]`,
    ),
  blockEnd: /^[})\]]/,
  tests: jsTests,
};

// --- Python (pytest, unittest) ---------------------------------------------------------

/** Decorators directly above a test function that stop it running or failing. */
export const PY_SKIP_DECORATORS = [
  /^@pytest\.mark\.skip\b/,
  /^@pytest\.mark\.skipif\b/,
  /^@pytest\.mark\.xfail\b/,
  /^@unittest\.skip\b/,
  /^@unittest\.skipIf\b/,
  /^@unittest\.skipUnless\b/,
  /^@unittest\.expectedFailure\b/,
];

function pyTests(text) {
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const m = /^\s*(?:async\s+)?def\s+(test\w*)\s*\(/.exec(line);
    if (!m) return;
    let skippedBy = null;
    for (let j = i - 1; j >= 0 && /^\s*@/.test(lines[j]); j--) {
      const decorator = lines[j].trim();
      if (PY_SKIP_DECORATORS.some((re) => re.test(decorator))) skippedBy = decorator;
    }
    out.push({ title: m[1], skippedBy });
  });
  return out;
}

const python = {
  name: 'Python',
  extensions: /\.py$/,
  declaration: (name) =>
    new RegExp(
      `^(?:(?:async\\s+)?def\\s+${escape(name)}\\s*\\(|class\\s+${escape(name)}\\b|${escape(name)}\\s*(?::[^=]+)?=(?!=))`,
    ),
  member: (name) =>
    new RegExp(`^\\s+(?:(?:async\\s+)?def\\s+${escape(name)}\\s*\\(|${escape(name)}\\s*(?::[^=]+)?=(?!=))`),
  blockEnd: /^\S/,
  tests: pyTests,
};

export const LANGUAGES = [javascript, python];

export const languageOf = (file) => LANGUAGES.find((l) => l.extensions.test(file)) ?? null;
