import type { Handler } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './read.js';

const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DigestApiError = { error: string };

export function digestApi(config: RigConfig): Handler {
  return (c) => {
    const night = c.req.param('night');
    const requestedNight = night ?? '';
    if (!NIGHT_PATTERN.test(requestedNight)) {
      return c.json<DigestApiError>({ error: `no run log for ${requestedNight}` }, 404);
    }

    const digest = readNight(config.runsDir, requestedNight);
    if (digest === null) {
      return c.json<DigestApiError>({ error: `no run log for ${requestedNight}` }, 404);
    }

    return c.json(digest);
  };
}
