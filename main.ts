// Senja Amphibi — a 3D seaplane game over an Indonesian archipelago at golden
// hour (Node 22, standard library only). The game is plain static files under
// game/ (raw WebGL, no libraries, no network) plus 4 screenshots. This program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Safety notes (learned from earlier rounds):
// - NEVER delete the output directory itself: the grader's /output is a
//   Docker volume mount and removing it fails EBUSY. Only mkdir + copy.
// - A dotfile guard on every copy: no file whose basename starts with '.'
//   (no .gitkeep, no .DS_Store) may ever reach /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is game/ plus screenshots/; refuse to hand in a half-built repo.
for (const needed of ['game', 'screenshots', 'game/index.html']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`missing ${needed} — build the game before running main.ts`);
  }
}

// Skip any entry whose basename starts with '.' — dotfiles are never part
// of the entry, however they got into the repository.
const noDotfiles = (src: string) => !basename(src).startsWith('.');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true, filter: noDotfiles });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true, filter: noDotfiles });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
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

console.log(`Senja Amphibi handed in to ${out}`);
