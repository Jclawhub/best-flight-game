// Senja Amphibi — hand-in program for best-flight-game-20261126-0057.
// Node 22, standard library only. The game is this directory's game/ folder
// (plain static files a desktop browser loads offline) and the program hands
// it in: it copies game/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json with the vendored make.fun library.
//
// The grader rejects output names that do not start with a letter, digit or
// "_", so this program refuses to hand in any dotfile (.gitkeep, .DS_Store
// and friends) instead of copying it and failing the whole entry. Run it
// locally with:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Walk a directory and throw on the first dotfile found. A dotfile in a
// folder this program copies would land in /output and fail the gate.
function assertNoDotfiles(dir, label) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) {
      throw new Error(`refusing to hand in dotfile ${label}/${entry}: output names must start with a letter, digit or "_"`);
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) assertNoDotfiles(full, `${label}/${entry}`);
  }
}

mkdirSync(out, { recursive: true });
assertNoDotfiles(join(here, 'game'), 'game');
if (existsSync(join(here, 'screenshots'))) {
  assertNoDotfiles(join(here, 'screenshots'), 'screenshots');
}

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Print the hand-in manifest: every file that just landed in /output, with
// its size, so a bad file (a dotfile, a stray asset) is spotted at once.
function listFiles(dir, base = '') {
  const rows = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) rows.push(...listFiles(full, rel));
    else rows.push([rel, statSync(full).size]);
  }
  return rows;
}

const manifest = listFiles(out);
let totalBytes = 0;
for (const [rel, size] of manifest) {
  totalBytes += size;
  console.log(`  ${rel}  ${size} bytes`);
}
console.log(`hand-in: ${manifest.length} files, ${totalBytes} bytes -> ${out}`);
