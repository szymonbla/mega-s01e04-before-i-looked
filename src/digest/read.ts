import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, RunStatus } from './types.js';

type Run = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function isRun(value: unknown): value is Run {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.at === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(run.at) &&
    Number.isFinite(Date.parse(run.at)) &&
    typeof run.job === 'string' && run.job.trim().length > 0 &&
    (run.status === 'ok' || run.status === 'retry' || run.status === 'fail') &&
    (typeof run.owner === 'string' || run.owner === null) &&
    (run.error === undefined || typeof run.error === 'string')
  );
}

export function readNight(runsDir: string, night: string): Night | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  const lines = text === '' ? [] : text.split('\n');
  // A final newline terminates a record; an interior blank line is a bad record.
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    let run: unknown;
    try {
      run = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!isRun(run)) {
      badLines++;
      continue;
    }

    const previous = rows.get(run.job);
    rows.set(run.job, {
      job: run.job,
      owner: run.owner,
      runs: (previous?.runs ?? 0) + 1,
      retries: (previous?.retries ?? 0) + Number(run.status === 'retry'),
      lastStatus: run.status,
      lastError: run.error ?? null,
      firstAt: previous?.firstAt ?? run.at,
      lastAt: run.at,
    });
  }
  return {
    night,
    rows: [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0),
    badLines,
  };
}
