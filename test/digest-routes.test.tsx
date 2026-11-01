import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const temporaryDirs: string[] = [];
const configFor = (runsDir: string): RigConfig => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

function tempRuns(night: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  temporaryDirs.push(dir);
  writeFileSync(join(dir, `${night}.jsonl`), contents);
  return dir;
}

function run(at: string, job: string, status: 'ok' | 'retry' | 'fail', owner: string | null) {
  return JSON.stringify({ at, job, status, owner });
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('returns the same sorted jobs from the page and JSON routes', async () => {
    const night = '2026-10-30';
    const runsDir = tempRuns(night, [
      run('2026-10-30T02:00:00+01:00', 'zeta/job', 'ok', 'rook'),
      run('2026-10-30T01:00:00+01:00', 'alpha/job', 'ok', null),
    ].join('\n'));
    const app = createApp(configFor(runsDir));

    const page = await app.request(`/digest/${night}`);
    const json = await app.request(`/api/digest/${night}`);
    const html = await page.text();
    const body = await json.json() as { rows: Array<{ job: string }> };

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(body.rows.map((row) => row.job)).toEqual(['alpha/job', 'zeta/job']);
    expect(html).toContain('alpha/job');
    expect(html).toContain('zeta/job');
    expect(html.indexOf('alpha/job')).toBeLessThan(html.indexOf('zeta/job'));
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
    temporaryDirs.push(runsDir);
    const app = createApp(configFor(runsDir));

    const page = await app.request('/digest/2026-10-30');
    const json = await app.request('/api/digest/2026-10-30');

    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('renders an empty night and returns no JSON rows', async () => {
    const night = '2026-10-30';
    const runsDir = tempRuns(night, '');
    const app = createApp(configFor(runsDir));

    const page = await app.request(`/digest/${night}`);
    const json = await app.request(`/api/digest/${night}`);
    const body = await json.json() as { rows: unknown[] };

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('keeps both routes successful and reports one bad line', async () => {
    const night = '2026-10-30';
    const runsDir = tempRuns(night, [
      run('2026-10-30T02:00:00+01:00', 'valid/job', 'ok', 'rook'),
      '{not json}',
    ].join('\n'));
    const app = createApp(configFor(runsDir));

    const page = await app.request(`/digest/${night}`);
    const json = await app.request(`/api/digest/${night}`);
    const body = await json.json() as { badLines: number; rows: Array<{ job: string }> };

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('valid/job');
    expect(json.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual(['valid/job']);
  });
});
