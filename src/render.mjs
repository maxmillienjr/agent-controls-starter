/**
 * The matrix: CONTROLS.md, rendered from the catalogue. Deterministic plain Markdown, so a
 * rendered file is byte-for-byte what the same catalogue renders on any machine.
 */
import { relative, dirname, posix } from 'node:path';
import { STATUSES } from './catalogue.mjs';
import { resolveCi } from './anchors.mjs';

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const code = (s) => (String(s).includes('`') ? `\`\` ${s} \`\`` : `\`${s}\``);
const toPosix = (p) => p.split('\\').join('/');

export const GREEN_CHECK = 'A green check means the evidence resolves, not that it is sufficient.';

function evidenceCell(e, repo, link) {
  const job = (workflow, j, run) => {
    const { triggers = [] } = resolveCi(repo, workflow, j, run);
    const r = run ? `, runs ${code(run)}` : '';
    return `[${code(workflow)}](${link(`.github/workflows/${workflow}`)}) job ${code(j)}${r}, on ${triggers.join(', ')}`;
  };
  switch (e.kind) {
    case 'symbol':
      return `[${code(e.name)}](${link(e.file)})`;
    case 'test':
      return `test [${code(e.name)}](${link(e.file)}) in ${job(e.workflow, e.job, e.run)}`;
    case 'ci':
      return job(e.workflow, e.job, e.run);
    case 'doc':
      return `[${code(e.file)}](${link(e.file)}), section "${e.heading}"`;
  }
}

export function render({ registries, controls, repo }, { matrixPath, cataloguePath }) {
  const matrixDir = toPosix(relative(repo.root, dirname(matrixPath))) || '.';
  const link = (path) => posix.relative(matrixDir, path) || path;
  const catalogueName = toPosix(relative(dirname(matrixPath), cataloguePath));
  const count = (status) => controls.filter((c) => c.status === status).length;

  const out = [
    `<!-- Generated from ${catalogueName}. Do not edit by hand: the controls lint fails when this file differs from what the catalogue renders. -->`,
    '',
    '# Controls',
    '',
    `${controls.length} controls: ${STATUSES.map((s) => `${count(s)} \`${s}\``).join(', ')}.`,
    '',
    `**${GREEN_CHECK}**`,
    '',
    'The lint proves that each anchor below exists in the tracked tree: the symbol is declared, ' +
      'the test title is present and not skipped, the workflow job exists and its workflow runs on ' +
      'pull requests. It does not prove that a test asserts what its control claims, that the job ' +
      'actually collects the cited test, or that a mapping to a framework id is the right one. ' +
      'Those are judgements, and each sits beside its evidence so a reader can disagree with it.',
    '',
    '**Coverage is not claimed.** The lint asserts that every catalogued control has evidence, not ' +
      'that every id of a framework has a control. Each framework section below says how many of its ' +
      'ids no control here maps.',
    '',
    '| Status | Means |',
    '| --- | --- |',
    '| `implemented` | A test or a CI job fails if the control stops holding. |',
    '| `procedural` | A person enforces it by applying a written rule. No check does. |',
    '| `planned` | Not delivered yet. The owner is who delivers it. |',
    '| `not-applicable` | Excluded, with a written rationale. |',
    '',
    '## Catalogue',
    '',
  ];
  if (controls.length === 0) {
    out.push('No controls yet.', '');
  } else {
    out.push(
      '| Id | Control | Status | Maps to | Evidence, owner or rationale |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const c of controls) {
      const maps = c.maps.map((m) => `${m.framework} ${m.ref}`).join('; ');
      const parts = [];
      if (c.status === 'planned') parts.push(`Owner: ${c.owner}`);
      if (c.status === 'not-applicable') parts.push(`Rationale: ${c.rationale}`);
      for (const e of c.evidence) parts.push(evidenceCell(e, repo, link));
      if (c.note) parts.push(c.note);
      out.push(`| ${cell(c.id)} | ${cell(c.title)} | \`${c.status}\` | ${cell(maps)} | ${cell(parts.join('; '))} |`);
    }
    out.push('');
  }
  out.push('## Frameworks', '');
  for (const [id, reg] of registries) {
    const mapped = reg.ids.filter((ref) =>
      controls.some((c) => c.maps.some((m) => m.framework === id && String(m.ref) === ref)),
    );
    out.push(
      `### ${reg.title}`,
      '',
      `Registry \`${id}\`, ids from <${reg.url}>, retrieved ${reg.retrieved}.`,
      '',
      `**${mapped.length} of ${reg.ids.length} ${reg.unit} have a control here; ${reg.ids.length - mapped.length} have none.** ` +
        'Coverage of this framework is not claimed.',
      '',
    );
    if (mapped.length) {
      out.push('| Id | Controls |', '| --- | --- |');
      for (const ref of mapped) {
        const users = controls
          .filter((c) => c.maps.some((m) => m.framework === id && String(m.ref) === ref))
          .map((c) => c.id);
        out.push(`| ${cell(ref)} | ${users.join(', ')} |`);
      }
      out.push('');
    }
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}
