import { readNight } from './read.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

export function readNightCounts(runsDir: string, night: string): NightCounts | null {
  try {
    const result = readNight(runsDir, night);
    if (result === null) return null;

    const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
    for (const row of result.rows) counts[row.lastStatus]++;
    return counts;
  } catch {
    return null;
  }
}
