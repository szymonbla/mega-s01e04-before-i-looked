import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../app.js';

// Plan morning-digest § 3: save one rig page as one self-contained HTML file (ADR 0001, 0003).
// The banner shows LANE_MARKER when set and "no marker set" when not. The output lives under
// var/, which git ignores: previews never go into the repo.
const path = process.argv[2] ?? '/digest/2026-10-28';
const out = process.argv[3] ?? 'var/preview/index.html';

const res = await createApp().request(path);
if (res.status !== 200) throw new Error(`${path} answered ${res.status}`);
const html = await res.text();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`saved ${path} -> ${out} (${html.length} bytes, marker ${process.env.LANE_MARKER?.trim() ? 'set' : 'not set'})`);
