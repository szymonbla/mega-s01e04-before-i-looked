import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';

vi.mock('../src/digest/read.js', () => ({
  readNight: vi.fn(),
}));

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '/tmp/test-runs',
};

const digest: Night = {
  night: '2026-10-28',
  rows: [
    {
      job: 'zeta',
      owner: null,
      runs: 2,
      retries: 1,
      lastStatus: 'retry',
      lastError: 'still running',
      firstAt: '2026-10-28T08:00:00+01:00',
      lastAt: '2026-10-28T08:05:00+01:00',
    },
    {
      job: 'alpha',
      owner: 'Ada',
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T07:00:00+01:00',
      lastAt: '2026-10-28T07:00:00+01:00',
    },
  ],
  badLines: 1,
};

describe('digest API', () => {
  it('returns the reader result without changing row order', async () => {
    vi.mocked(readNight).mockReturnValueOnce(digest);

    const response = await createApp(config).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(digest);
    expect(readNight).toHaveBeenCalledWith(config.runsDir, '2026-10-28');
  });

  it('returns 404 when the reader has no log', async () => {
    vi.mocked(readNight).mockReturnValueOnce(null);

    const response = await createApp(config).request('/api/digest/2026-10-28');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no run log for 2026-10-28' });
  });

  it('returns 404 for an invalid night without reading', async () => {
    vi.mocked(readNight).mockClear();

    const response = await createApp(config).request('/api/digest/not-a-night');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no run log for not-a-night' });
    expect(readNight).not.toHaveBeenCalled();
  });
});
