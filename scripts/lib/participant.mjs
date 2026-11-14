// 참가자 기록(submissions/<id>/participant.json). Node 내장 모듈만 사용한다.
import path from 'node:path';
import { REPO_ROOT, readJson, writeJson } from './env.mjs';

export const LIMIT_MINUTES = { nomcp: 30, mcp: 20 };

export function participantPath(id, repoRoot = REPO_ROOT) {
  return path.join(repoRoot, 'submissions', id, 'participant.json');
}

export function loadParticipant(id, repoRoot = REPO_ROOT) {
  const data = readJson(participantPath(id, repoRoot), null);
  if (!data || typeof data !== 'object' || data.__invalid) return null;
  return data;
}

export function saveParticipant(id, data, repoRoot = REPO_ROOT) {
  writeJson(participantPath(id, repoRoot), data);
}

export function recordSetup(p, s) {
  const prev = p && typeof p === 'object' ? p : {};
  const runs = { ...(prev.runs || {}) };
  const old = runs[s.test] || {};
  runs[s.test] = {
    ...old,
    tool: s.tool,
    setupAt: old.submittedAt && old.setupAt ? old.setupAt : s.now.toISOString(),
    limitMinutes: LIMIT_MINUTES[s.test],
    warnings: [...(s.warnings || [])],
  };
  return {
    ...prev,
    id: s.id,
    tool: s.tool,
    model: s.model,
    platform: s.platform,
    versions: { ...(s.versions || {}) },
    runs,
  };
}

export function recordSubmit(p, s) {
  const runs = { ...(p.runs || {}) };
  const run = { ...(runs[s.test] || {}) };
  const start = run.setupAt ? Date.parse(run.setupAt) : NaN;
  const elapsed = Number.isNaN(start) ? null : Math.round(((s.now.getTime() - start) / 60000) * 10) / 10;
  run.submittedAt = s.now.toISOString();
  run.elapsedMinutes = elapsed;
  run.overLimit = elapsed !== null && elapsed > run.limitMinutes;
  runs[s.test] = run;
  return { ...p, runs };
}

export function lastSetupTest(p) {
  let best = null;
  let bestAt = -Infinity;
  for (const [test, run] of Object.entries((p && p.runs) || {})) {
    const at = run && run.setupAt ? Date.parse(run.setupAt) : NaN;
    if (!Number.isNaN(at) && at > bestAt) {
      best = test;
      bestAt = at;
    }
  }
  return best;
}
