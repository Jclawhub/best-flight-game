// Senja Amphibi — hand-in program (Node 22, standard library only).
// Copies game/ and screenshots/ into the output directory, refuses any
// dotfile in a copied directory, and writes dossier.json with the kit's
// buildDossier so the gate can compare it byte for byte.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const repoDir = new URL('.', import.meta.url).pathname;

function assertNoDotfiles(dir, rel) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) {
      throw new Error(`dotfile in hand-in: ${rel}/${entry}`);
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) assertNoDotfiles(full, `${rel}/${entry}`);
  }
}

const gameDir = join(repoDir, 'game');
const shotsDir = join(repoDir, 'screenshots');
assertNoDotfiles(gameDir, 'game');
assertNoDotfiles(shotsDir, 'screenshots');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
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
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    n += statSync(full).isDirectory() ? countFiles(full) : 1;
  }
  return n;
}
console.log(`wrote ${outDir}: ${countFiles(join(outDir, 'game'))} game files, ${countFiles(join(outDir, 'screenshots'))} screenshots, dossier.json`);
