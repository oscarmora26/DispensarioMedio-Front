#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const featureFile = resolve(root, 'feature-list.md');

const VALID_STATES = new Set([
  'proposed',
  'approved',
  'in_progress',
  'in_review',
  'changes_requested',
  'done',
  'blocked',
  'rejected',
]);

const REQUIRES_APPROVAL = new Set([
  'approved',
  'in_progress',
  'in_review',
  'changes_requested',
  'done',
]);

function parseFeatures() {
  const raw = readFileSync(featureFile, 'utf8').replace(/\r\n/g, '\n');
  const withoutFences = raw.replace(/```[\s\S]*?```/g, '');
  const lines = withoutFences.split('\n');
  const features = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(F-\d{3})\s+[—–-]\s+(.+?)\s*$/);
    if (heading) {
      current = {
        id: heading[1],
        title: heading[2],
        status: null,
        priority: null,
        approvedBy: null,
      };
      features.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const status = line.match(/^-\s+\*\*Estado:\*\*\s+(.+?)\s*$/);
    if (status) {
      current.status = status[1].trim();
    }

    const priority = line.match(/^-\s+\*\*Prioridad:\*\*\s*(.*?)\s*$/);
    if (priority) {
      current.priority = priority[1].trim() || '—';
    }

    const approvedBy = line.match(/^-\s+\*\*Aprobado por:\*\*\s*(.*?)\s*$/);
    if (approvedBy) {
      current.approvedBy = approvedBy[1].trim();
    }
  }

  return features;
}

function hasApprover(feature) {
  return Boolean(feature.approvedBy && feature.approvedBy !== '—' && feature.approvedBy !== '-');
}

function list(features) {
  if (features.length === 0) {
    console.log('No hay features registradas.');
    return;
  }

  console.log('ID     Estado              Prioridad   Título');
  console.log('-----  ------------------  ----------  ----------------------------------------');
  for (const feature of features) {
    const status = feature.status ?? '(sin estado)';
    const priority = feature.priority ?? '—';
    console.log(
      `${feature.id.padEnd(5)}  ${status.padEnd(18)}  ${priority.padEnd(10)}  ${feature.title}`,
    );
  }
}

function next(features) {
  const approved = features.find((feature) => feature.status === 'approved');
  if (!approved) {
    console.log('No hay features aprobadas. El humano debe aprobar una en feature-list.md.');
    process.exitCode = 1;
    return;
  }

  console.log(`${approved.id} — ${approved.title}`);
  console.log(`Estado: ${approved.status}`);
  console.log(`Prioridad: ${approved.priority ?? '—'}`);
  console.log(`Aprobado por: ${approved.approvedBy ?? '—'}`);
}

function validate(features) {
  const errors = [];
  const seenIds = new Set();
  let inProgress = 0;

  for (const feature of features) {
    if (seenIds.has(feature.id)) {
      errors.push(`${feature.id}: ID duplicado.`);
    }
    seenIds.add(feature.id);

    if (!feature.status || !VALID_STATES.has(feature.status)) {
      errors.push(`${feature.id}: estado inválido o ausente (${feature.status ?? '—'}).`);
      continue;
    }

    if (REQUIRES_APPROVAL.has(feature.status) && !hasApprover(feature)) {
      errors.push(`${feature.id}: estado "${feature.status}" requiere "Aprobado por".`);
    }

    if (feature.status === 'in_progress') {
      inProgress += 1;
    }
  }

  if (inProgress > 1) {
    errors.push(`Hay ${inProgress} features en in_progress; solo se permite una.`);
  }

  if (errors.length > 0) {
    console.error('Validación fallida:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`OK: ${features.length} feature(s) válidas.`);
}

const command = process.argv[2] ?? 'list';
const features = parseFeatures();

switch (command) {
  case 'list':
    list(features);
    break;
  case 'next':
    next(features);
    break;
  case 'validate':
    validate(features);
    break;
  default:
    console.error(`Comando desconocido: ${command}`);
    console.error('Uso: node scripts/feature-list.mjs [list|next|validate]');
    process.exitCode = 1;
}
