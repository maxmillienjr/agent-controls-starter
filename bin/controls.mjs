#!/usr/bin/env node
/**
 *   controls lint     check the catalogue, resolve every anchor, fail if the matrix is stale
 *   controls render   check the catalogue, then write the matrix
 *
 * Options:
 *   --root <dir>        the repository whose tracked files are the evidence (default: .)
 *   --catalogue <file>  the catalogue (default: <root>/controls.yaml)
 *   --matrix <file>     the rendered matrix (default: CONTROLS.md beside the catalogue)
 *
 * Exit code 0 when everything resolves, 1 on any problem. When GITHUB_STEP_SUMMARY is set,
 * the result is appended to it as Markdown.
 */
import { appendFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { lintControls } from '../src/lint.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: 'string', default: '.' },
    catalogue: { type: 'string' },
    matrix: { type: 'string' },
  },
});
const command = positionals[0] ?? 'lint';
if (!['lint', 'render'].includes(command)) {
  console.error(`unknown command \`${command}\`; use lint or render`);
  process.exit(2);
}
const root = resolve(values.root);
const cataloguePath = resolve(values.catalogue ?? join(root, 'controls.yaml'));
const matrixPath = resolve(values.matrix ?? join(dirname(cataloguePath), 'CONTROLS.md'));

const { errors, summary } = lintControls({ root, cataloguePath, matrixPath, write: command === 'render' });

const step = process.env.GITHUB_STEP_SUMMARY;
if (errors.length) {
  console.error(`\ncontrols lint failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  x ${e}`);
  console.error('');
  if (step)
    appendFileSync(
      step,
      `### Controls lint failed: ${errors.length} problem(s)\n\n` +
        errors.map((e) => `- ${e.replace(/\n/g, ' ')}`).join('\n') +
        '\n\nA green check means the evidence resolves, not that it is sufficient.\n',
    );
  process.exit(1);
}
console.log(summary);
if (step)
  appendFileSync(
    step,
    `### Controls lint passed\n\n${summary}\n\nA green check means the evidence resolves, not that it is sufficient.\n`,
  );
