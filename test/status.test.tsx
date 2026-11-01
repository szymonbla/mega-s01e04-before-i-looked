import { describe, expect, beforeEach, it, vi } from 'vitest';
import type { Night } from '../src/digest/types.js';

vi.mock('../src/digest/read.js', () => ({ readNight: vi.fn() }));

import { readNight } from '../src/digest/read.js';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const night: Night = {
  night: 'mocked',
  badLines: 0,
  rows: [
    { job: 'ok-job', owner: 'owner', runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T08:00:00+01:00', lastAt: '2026-10-28T08:00:00+01:00' },
    { job: 'retry-job', owner: 'owner', runs: 1, retries: 1, lastStatus: 'retry', lastError: null, firstAt: '2026-10-28T08:00:00+01:00', lastAt: '2026-10-28T08:00:00+01:00' },
    { job: 'fail-job', owner: 'owner', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'failed', firstAt: '2026-10-28T08:00:00+01:00', lastAt: '2026-10-28T08:00:00+01:00' },
  ],
};

const mockedReadNight = vi.mocked(readNight);

describe('status board', () => {
  beforeEach(() => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    mockedReadNight.mockReset();
    mockedReadNight.mockReturnValue(night);
  });

  it('shows the lane banner, links both nights, and shows status counts', async () => {
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('ok 1 · retry 1 · fail 1');
  });

  it('shows missing counts when the reader returns null or throws', async () => {
    mockedReadNight.mockReturnValueOnce(null).mockImplementationOnce(() => {
      throw new Error('reader failed');
    });
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('ok — · retry — · fail —');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
