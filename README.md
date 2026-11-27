# Senja Amphibi

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Jclawhub/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Jclawhub/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 2D canvas seaplane game for the make.fun **best-flight-game-20261126-0057**
bounty. Fly a seaplane over an Indonesian archipelago at golden hour — chase
and cockpit views, lit instruments, four missions, fuel and damage that turn
every sortie into decisions.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

No network, no build step: static files under `game/`, desktop Chrome.

## Controls

- **W / S** or **Up / Down** — throttle
- **A / D** or **Left / Right** — turn
- **Hold mouse** — climb
- **Space** — drop a mail crate
- **C** — cockpit view (or tap the VIEW pill on the right) · **P** — pause · **R** — restart · **M** — mute · **1–4** — pick a mission

## Missions (180 s a sortie)

1. **Ring Run** — fly through 6 glowing rings in order, +100 each.
2. **Island Hop** — water-land at 3 lagoon docks, +150 for a clean one.
3. **Mail Drop** — drop crates on 3 village docks with Space, +120 each.
4. **Rescue Run** — land by the raft, pick up the stranded sailor (+100),
   then deliver them to the Main Dock (+200).

Fuel burns with throttle. A safe water touchdown is under 85 km/h and
sinking slower than 5.5 m/s; a rough one costs 30 damage and 10 points.
Stall speed is 55 km/h. The compass ribbon and minimap always point at the
next objective with its distance.

## Round 3 changes

- New **cockpit view**: first-person from the seaplane, same perspective,
  windscreen pillars and brow, dashboard with the same lit instruments.
  Toggle with **C** or the VIEW pill on the right of the screen.
- New screenshots: cockpit (cover), rescue, water landing with spray,
  mission complete. The complete panel no longer covers the compass ribbon,
  and dial values no longer overlap their needles.
- New **compass ribbon + minimap**: bearing and distance to the next
  objective are always visible, with a light beacon marking it in the world.
- New **water-landing spray and ring fly-through particles**.
- Screenshots re-staged for small-size readability: bigger HUD type, larger
  aircraft in frame, and the mission-complete panel sits high so it never
  covers the plane.

## Round 2 changes

- New 4th mission **Rescue Run**: land by the raft, pick up the stranded
  sailor, deliver them to the Main Dock.
- New **compass ribbon + minimap**: bearing and distance to the next
  objective are always visible, with a light beacon marking it in the world.
- New **water-landing spray and ring fly-through particles**.
- Screenshots re-staged for small-size readability: bigger HUD type, larger
  aircraft in frame, and the mission-complete panel sits high so it never
  covers the plane.

## Layout

- `main.ts` — hand-in program: copies `game/` + `screenshots/` to `/output`
  (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`; refuses dotfiles.
- `game/index.html`, `game/style.css`, `game/src/*.js` — the game itself.
- `screenshots/` — 4 real renders: cockpit (cover), rescue, landing, complete.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
