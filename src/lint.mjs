/**
 * Check a control catalogue against the tracked tree, and render its matrix.
 *
 * Every problem is collected before returning, so one run names all of them. The matrix is
 * compared only when the catalogue has no other problem: a stale-matrix error on top of a
 * broken catalogue would name the symptom instead of the cause.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { createRepo, resolveSymbol, resolveTest, resolveCi, resolveDoc } from './anchors.mjs';
import { STATUSES, controlProblems, statusProblems } from './catalogue.mjs';
import { render } from './render.mjs';

/** The registries this package ships, used unless a catalogue opts out. */
export const BUILT_IN_REGISTRIES = join(dirname(fileURLToPath(import.meta.url)), '..', 'registries');

function registryFiles(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => join(path, f));
}

/** Load registry files: `{ id, title, url, retrieved, unit, ids }`. */
function loadRegistries(paths, root, fail) {
  const registries = new Map();
  for (const path of paths) {
    for (const file of registryFiles(path)) {
      const name = file.startsWith(BUILT_IN_REGISTRIES)
        ? `built-in registries/${relative(BUILT_IN_REGISTRIES, file)}`
        : relative(root, file);
      let doc;
      try {
        doc = parseYaml(readFileSync(file, 'utf-8'));
      } catch (e) {
        fail(`registry ${name} does not parse: ${e.message.split('\n')[0]}`);
        continue;
      }
      const missing = ['id', 'title', 'url', 'retrieved', 'unit', 'ids'].filter((k) => !doc?.[k]);
      if (missing.length) {
        fail(`registry ${name} lacks ${missing.join(', ')}`);
        continue;
      }
      if (!Array.isArray(doc.ids) || doc.ids.length === 0) {
        fail(`registry ${name}: ids must be a non-empty list`);
        continue;
      }
      if (registries.has(doc.id)) {
        fail(`registry ${name} reuses the id \`${doc.id}\``);
        continue;
      }
      registries.set(doc.id, { ...doc, ids: doc.ids.map(String), retrieved: String(doc.retrieved), file: name });
    }
  }
  return registries;
}

function evidenceProblem(repo, e) {
  switch (e.kind) {
    case 'symbol':
      return resolveSymbol(repo, e.file, e.name);
    case 'test':
      return resolveTest(repo, e.file, e.name, { workflow: e.workflow, job: e.job, run: e.run });
    case 'ci':
      return resolveCi(repo, e.workflow, e.job, e.run).error ?? null;
    case 'doc':
      return resolveDoc(repo, e.file, e.heading);
  }
}

/** Validate the catalogue and resolve every anchor. */
export function check({ root, cataloguePath }) {
  const errors = [];
  const where = relative(process.cwd(), cataloguePath) || cataloguePath;
  const fail = (msg) => errors.push(`${where}: ${msg}`);

  if (!existsSync(cataloguePath)) {
    fail('missing');
    return { errors };
  }
  let raw;
  try {
    raw = parseYaml(readFileSync(cataloguePath, 'utf-8')) ?? {};
  } catch (e) {
    fail(`does not parse: ${e.message.split('\n')[0]}`);
    return { errors };
  }
  const extra = Object.keys(raw).filter((k) => !['registries', 'built_in_registries', 'controls'].includes(k));
  if (extra.length) fail(`top-level keys may be registries, built_in_registries, controls; found ${extra.join(', ')}`);
  const controlsRaw = raw.controls ?? [];
  if (!Array.isArray(controlsRaw)) {
    fail('`controls` must be a list');
    return { errors };
  }

  let repo;
  try {
    repo = createRepo(root);
  } catch (e) {
    fail(e.message);
    return { errors };
  }

  const registryPaths = [
    ...(raw.built_in_registries === false ? [] : [BUILT_IN_REGISTRIES]),
    ...(raw.registries ?? []).map((p) => resolve(root, p)),
  ];
  const registries = loadRegistries(registryPaths, root, fail);

  const controls = [];
  const ids = new Set();
  controlsRaw.forEach((value, i) => {
    const label = typeof value?.id === 'string' ? value.id : `controls[${i}]`;
    const shape = controlProblems(value, label);
    if (shape.length) {
      shape.forEach(fail);
      return;
    }
    const control = { evidence: [], ...value };
    if (ids.has(control.id)) fail(`${control.id}: the id is used twice`);
    ids.add(control.id);

    for (const problem of statusProblems(control)) fail(`${control.id}: ${problem}`);

    for (const { framework, ref } of control.maps) {
      const registry = registries.get(framework);
      if (!registry) fail(`${control.id}: maps to framework \`${framework}\`, which no registry file declares`);
      else if (!registry.ids.includes(String(ref)))
        fail(`${control.id}: maps to \`${ref}\`, which is not an id in the ${framework} registry (${registry.file})`);
    }

    control.evidence.forEach((evidence, j) => {
      const problem = evidenceProblem(repo, evidence);
      if (problem) fail(`${control.id}: evidence[${j}] (${evidence.kind}) does not resolve: ${problem}`);
    });
    controls.push(control);
  });

  return { errors, registries, controls, repo };
}

/** Check, then compare (or with `write`, regenerate) the matrix. */
export function lintControls({ root, cataloguePath, matrixPath, write = false }) {
  const result = check({ root, cataloguePath });
  const { errors } = result;
  const matrixName = relative(process.cwd(), matrixPath) || matrixPath;
  if (errors.length === 0) {
    const rendered = render(result, { matrixPath, cataloguePath });
    if (write) writeFileSync(matrixPath, rendered);
    else if (!existsSync(matrixPath) || readFileSync(matrixPath, 'utf-8') !== rendered)
      errors.push(`${matrixName} is stale: it differs from what the catalogue renders; run the render command`);
  }
  if (errors.length) return { errors, summary: null };
  const counts = STATUSES.map((s) => `${result.controls.filter((c) => c.status === s).length} ${s}`).join(', ');
  return {
    errors,
    summary:
      `controls lint passed: ${result.controls.length} control(s) (${counts}), every anchor resolves` +
      (write ? `; wrote ${matrixName}.` : `, ${matrixName} is current.`),
  };
}
