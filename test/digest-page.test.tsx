import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { Night } from '../src/digest/types.js';
import { createApp } from '../src/app.js';

vi.mock('../src/digest/read.js', () => ({ readNight: vi.fn() }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '/tmp/runs' };
const fixedNight: Night = {
  night: '2026-10-28',
  badLines: 1,
  rows: [
    {
      job: 'a/job', owner: null, runs: 4, retries: 3, lastStatus: 'ok', lastError: null,
      firstAt: '2026-10-29T01:00:00+01:00', lastAt: '2026-10-29T01:03:00+01:00',
    },
    {
      job: 'z/job', owner: 'rook', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota',
      firstAt: '2026-10-29T02:00:00+01:00', lastAt: '2026-10-29T02:00:00+01:00',
    },
  ],
};

const mockedReadNight = vi.mocked(readNight);

describe('digest page', () => {
  beforeEach(() => mockedReadNight.mockReset());

  it('renders rows, null values, warnings, and bad-line count', async () => {
    mockedReadNight.mockReturnValue(fixedNight);
    const response = await createApp(config).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('lane-07');
    expect(html).toContain('<th>job</th>');
    expect(html).toContain('a/job');
    expect(html).toContain('z/job');
    expect(html).toContain('1 lines did not parse');
    expect(html).toContain('—');
    expect((html.match(/<tr class="warn">/g) ?? []).length).toBe(2);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('z/job'));
    expect(mockedReadNight).toHaveBeenCalledWith('/tmp/runs', '2026-10-28');
  });

  it('renders missing logs and rejects invalid nights with 404', async () => {
    mockedReadNight.mockReturnValue(null);
    const missing = await createApp(config).request('/digest/2026-10-27');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('no run log for that night');
    const invalid = await createApp(config).request('/digest/not-a-night');
    expect(invalid.status).toBe(404);
    expect(mockedReadNight).toHaveBeenCalledTimes(1);
  });

  it('renders an empty night', async () => {
    mockedReadNight.mockReturnValue({ night: '2026-10-28', rows: [], badLines: 0 });
    const response = await createApp(config).request('/digest/2026-10-28');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });
});
