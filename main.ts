// Senja Amphibi — hand-in program (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with the kit's buildDossier, so the gate can compare it
// byte for byte.
//
// HARD RULE, learned from the round 2 rejection: NEVER delete the output
// directory itself. The grader mounts /output as a Docker volume, and
// removing a mount point fails (EBUSY) — the throw is uncaught and the
// program exits 1, which fails run_completes. So this program only ever
// creates the output directory (mkdirSync, recursive) and copies into it.
//
// The grader also rejects output names that do not start with a letter,
// digit or "_", so this program refuses to hand in any dotfile (.gitkeep,
// .DS_Store and friends) instead of copying it and failing the entry.
// Run it locally with:  MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// fileURLToPath decodes the URL (a raw .pathname would keep %20-style
// escapes and point at a directory that does not exist).
const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

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

// Count the files under a directory, recursively.
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    n += statSync(full).isDirectory() ? countFiles(full) : 1;
  }
  return n;
}

// Create the output directory if needed. Never remove it first: on the
// grader it is a mounted volume, and deleting a mount point throws.
mkdirSync(outDir, { recursive: true });

const gameDir = join(repoDir, 'game');
const shotsDir = join(repoDir, 'screenshots');
assertNoDotfiles(gameDir, 'game');
if (existsSync(shotsDir)) {
  assertNoDotfiles(shotsDir, 'screenshots');
}

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// Verify the copy landed whole before the dossier is written: a silent
// short copy must fail loudly here instead of handing in a partial game.
const gameFiles = countFiles(gameDir);
const shotFiles = existsSync(shotsDir) ? countFiles(shotsDir) : 0;
const copiedGame = countFiles(join(outDir, 'game'));
const copiedShots = countFiles(join(outDir, 'screenshots'));
if (copiedGame !== gameFiles || copiedShots !== shotFiles) {
  throw new Error(`short copy: expected ${gameFiles} game files and ${shotFiles} screenshots, got ${copiedGame} and ${copiedShots}`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Sanity count of what was handed in, so a silent short copy is visible.
console.log(`wrote ${outDir}: ${countFiles(join(outDir, 'game'))} game files, ${countFiles(join(outDir, 'screenshots'))} screenshots, dossier.json`);
