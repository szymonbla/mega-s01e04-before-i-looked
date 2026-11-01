import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const temporaryDirs: string[] = [];
function tempRuns(lines: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  temporaryDirs.push(dir);
  writeFileSync(join(dir, 'night.jsonl'), lines.join('\n'));
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('reads the real night with five sorted jobs and one bad line', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      night: '2026-10-28',
      badLines: 1,
      rows: [
        {
          job: 'digest/render', owner: null, runs: 1, retries: 0,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00',
        },
        {
          job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
        },
        {
          job: 'lane/sync', owner: 'rook', runs: 8, retries: 1,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00',
        },
        {
          job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0,
          lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00',
        },
        {
          job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0,
          lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00',
        },
      ],
    });
  });

  it('returns null for a missing night and no rows for an empty file', () => {
    const dir = tempRuns();
    expect(readNight(dir, 'missing')).toBeNull();
    expect(readNight(dir, 'night')).toEqual({ night: 'night', rows: [], badLines: 0 });
  });

  it('uses file order, not timestamp order, and preserves offsets and the latest error', () => {
    const dir = tempRuns([
      JSON.stringify({ at: '2026-10-29T02:00:00+01:00', job: 'z', status: 'retry', owner: 'rook', error: 'old' }),
      JSON.stringify({ at: '2026-10-29T00:00:00-03:00', job: 'a', status: 'ok', owner: null }),
      JSON.stringify({ at: '2026-10-28T01:00:00+02:00', job: 'z', status: 'fail', owner: null, error: 'latest' }),
      '',
    ]);
    const result = readNight(dir, 'night');
    expect(result?.badLines).toBe(0);
    expect(result?.rows.map((row) => row.job)).toEqual(['a', 'z']);
    expect(result?.rows[1]).toEqual({
      job: 'z', owner: null, runs: 2, retries: 1,
      lastStatus: 'fail', lastError: 'latest',
      firstAt: '2026-10-29T02:00:00+01:00', lastAt: '2026-10-28T01:00:00+02:00',
    });
  });

  it('counts malformed JSON and invalid fields without losing valid records', () => {
    const valid = { at: '2026-10-29T02:00:00+01:00', job: 'job', status: 'ok', owner: null };
    const invalid = [
      '{', '', 'null', '[]', '42',
      ...['at', 'job', 'status', 'owner'].map((field) => {
        const record: Record<string, unknown> = { ...valid };
        delete record[field];
        return JSON.stringify(record);
      }),
      ...[
        { at: 123 }, { at: 'not a time' }, { at: '2026-10-29T02:00:00' },
        { job: null }, { job: '' }, { status: 'unknown' }, { owner: 123 }, { error: 123 },
      ].map((fields) => JSON.stringify({ ...valid, ...fields })),
    ];
    const dir = tempRuns([JSON.stringify(valid), ...invalid, JSON.stringify(valid), '']);
    expect(readNight(dir, 'night')).toEqual({
      night: 'night', badLines: invalid.length,
      rows: [{
        job: 'job', owner: null, runs: 2, retries: 0, lastStatus: 'ok', lastError: null,
        firstAt: valid.at, lastAt: valid.at,
      }],
    });
  });
});
