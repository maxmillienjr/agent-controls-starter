/**
 * The catalogue's shape, checked by hand so the linter needs no schema library.
 *
 * A control:
 *
 *   id          letters, digits, dots and dashes, unique (CTL-TOOL-01 is the convention)
 *   title       one line saying what holds
 *   status      implemented | procedural | planned | not-applicable
 *   maps        at least one { framework, ref }, each ref an id in that framework's registry
 *   evidence    anchors: symbol, test, ci, doc (below)
 *   owner       planned only: who delivers it
 *   rationale   not-applicable only: why it does not apply, 40 characters or more
 *   note        optional, printed in the matrix
 *
 * An anchor:
 *
 *   { kind: symbol, file, name }                 a declaration; `Owner.member` for a member
 *   { kind: test, file, name, workflow, job, run? }  a test title, and the PR job that runs it
 *   { kind: ci, workflow, job, run? }            a job in a workflow that runs on pull requests
 *   { kind: doc, file, heading }                 a heading in a Markdown file
 */
import { LINE_ANCHOR_MESSAGE } from './anchors.mjs';

export const STATUSES = ['implemented', 'procedural', 'planned', 'not-applicable'];
export const EXECUTABLE = new Set(['test', 'ci']);

const FIELDS = {
  control: {
    required: ['id', 'title', 'status', 'maps'],
    optional: ['evidence', 'owner', 'rationale', 'note'],
  },
  symbol: { required: ['kind', 'file', 'name'], optional: [] },
  test: { required: ['kind', 'file', 'name', 'workflow', 'job'], optional: ['run'] },
  ci: { required: ['kind', 'workflow', 'job'], optional: ['run'] },
  doc: { required: ['kind', 'file', 'heading'], optional: [] },
};

const isString = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function fields(value, spec, at, out) {
  for (const key of spec.required)
    if (!(key in value)) out.push(`${at}: \`${key}\` is required`);
  for (const key of Object.keys(value))
    if (!spec.required.includes(key) && !spec.optional.includes(key))
      out.push(`${at}: \`${key}\` is not a field here`);
  for (const key of [...spec.required, ...spec.optional])
    if (key in value && key !== 'maps' && key !== 'evidence' && !isString(value[key]))
      out.push(`${at}.${key}: must be a non-empty string`);
}

function repoPath(path, at, out) {
  if (!isString(path)) return;
  if (/:\d+/.test(path) || /#L\d+/.test(path)) out.push(`${at}: ${LINE_ANCHOR_MESSAGE}`);
  else if (path.startsWith('/') || path.split('/').includes('..'))
    out.push(`${at}: must be relative to the repository root`);
}

function anchorProblems(anchor, at) {
  const out = [];
  if (!isObject(anchor) || !(anchor.kind in FIELDS) || anchor.kind === 'control') {
    out.push(`${at}: kind must be one of symbol, test, ci, doc`);
    return out;
  }
  fields(anchor, FIELDS[anchor.kind], at, out);
  if ('file' in anchor) repoPath(anchor.file, `${at}.file`, out);
  if ('workflow' in anchor && isString(anchor.workflow) && !/^[\w.-]+\.ya?ml$/.test(anchor.workflow))
    out.push(`${at}.workflow: name a file in .github/workflows, like ci.yml`);
  if (anchor.kind === 'symbol' && isString(anchor.name) && !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/.test(anchor.name))
    out.push(`${at}.name: a symbol is an identifier, or Owner.member`);
  if (anchor.kind === 'doc' && isString(anchor.file) && !anchor.file.endsWith('.md'))
    out.push(`${at}.file: a doc anchor names a Markdown file`);
  return out;
}

/** Shape problems for one control, each prefixed with the control's id or position. */
export function controlProblems(control, label) {
  const out = [];
  if (!isObject(control)) return [`${label}: a control is a mapping`];
  fields(control, FIELDS.control, label, out);
  if (isString(control.id) && !/^[A-Za-z][\w.-]*$/.test(control.id))
    out.push(`${label}.id: letters, digits, dots and dashes, like CTL-TOOL-01`);
  if (isString(control.status) && !STATUSES.includes(control.status))
    out.push(`${label}.status: must be one of ${STATUSES.join(', ')}`);
  if ('maps' in control) {
    if (!Array.isArray(control.maps) || control.maps.length === 0)
      out.push(`${label}.maps: at least one { framework, ref }`);
    else
      control.maps.forEach((m, i) => {
        if (!isObject(m) || !isString(m.framework) || !isString(String(m.ref ?? '')) || Object.keys(m).length !== 2)
          out.push(`${label}.maps[${i}]: must be exactly { framework, ref }`);
      });
  }
  if ('evidence' in control) {
    if (!Array.isArray(control.evidence)) out.push(`${label}.evidence: must be a list`);
    else control.evidence.forEach((a, i) => out.push(...anchorProblems(a, `${label}.evidence[${i}]`)));
  }
  return out;
}

/** The status rules: each status names the kind of backing it needs. */
export function statusProblems(control) {
  const out = [];
  const kinds = (control.evidence ?? []).map((e) => e.kind);
  const executable = kinds.some((k) => EXECUTABLE.has(k));
  if (control.status !== 'planned' && control.owner)
    out.push(`has an owner but is \`${control.status}\`; only planned controls have one`);
  if (control.status !== 'not-applicable' && control.rationale)
    out.push(`has a rationale but is \`${control.status}\`; only not-applicable controls carry one`);
  switch (control.status) {
    case 'implemented':
      if (!executable)
        out.push('is implemented with no test or ci anchor; a symbol or a doc does not fail when the control stops holding');
      break;
    case 'procedural':
      if (!kinds.includes('doc')) out.push('is procedural with no doc anchor naming the written rule');
      if (executable)
        out.push('is procedural but has a test or ci anchor; if a check enforces it, it is implemented');
      break;
    case 'planned':
      if (!control.owner) out.push('is planned with no owner; name who delivers it');
      break;
    case 'not-applicable':
      if ((control.rationale ?? '').trim().length < 40)
        out.push('is not-applicable without a rationale of at least 40 characters');
      break;
  }
  return out;
}
