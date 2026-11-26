# Senja Amphibi — Island-Hopper Seaplane

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Jclawhub/best-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Jclawhub/best-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

Entry for the [make.fun](https://make.fun/c/best-flight-game-20261126-0057) bounty **"Make the best flight game"** (best-flight-game-20261126-0057).

**Senja Amphibi** is an original 2D canvas seaplane game set over an Indonesian
archipelago at golden hour. You fly a little amphibious plane in chase view
over teal sea, green islands and a smoking volcano, with the sun low on the
horizon. The cockpit instruments are lit — artificial horizon, airspeed,
altimeter, compass, throttle and fuel — and the HUD always shows altitude,
speed, heading, fuel, throttle, score and the mission clock.

## Three missions

1. **Ring Run** — fly through 6 glowing rings over the islands, against the clock. Rings pay +100, clean streaks build a combo.
2. **Island Hop** — land the seaplane on the water at 3 lagoon docks, then take off again. A clean landing pays +150.
3. **Mail Drop** — drop supply crates on 3 village docks (press Space right over the red flag). A crate on the dock pays +120.

Each sortie is 180 seconds. Fuel burns with throttle, slow flight stalls, hard
water at speed hurts, and the islands and the volcano are solid. Land soft.

## Screenshots

Four real renders of the game's own code, taken in a headless browser via
CDP (`?shot=<name>&seed=1` freezes a deterministic scene):

1. `1-start.jpg` — takeoff on the lagoon, water runway of buoys ahead, HUD and instruments lit.
2. `2-rings.jpg` — chase view mid-flight through a glowing ring over the islands.
3. `3-landing.jpg` — water-landing approach to a marked lagoon dock.
4. `4-complete.jpg` — mission-complete screen with the score.

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Throttle up |
| S / ↓ | Throttle down |
| A / D or ← / → | Turn (banks, auto-levels) |
| Hold mouse | Climb |
| Space | Drop a supply crate (Mail Drop) |
| P | Pause |
| R | Restart the mission |
| M | Back to the mission menu |
| 1 / 2 / 3 | Pick a mission on the title screen |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Hand it in (Node 22, stdlib only):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library. It refuses to hand
in any dotfile, so a stray `.gitkeep` can never fail the entry.

## Files

- `game/index.html`, `game/style.css` — page shell
- `game/src/main.js` — game loop and state machine (title / flying / paused / complete / gameover)
- `game/src/plane.js` — flight model: throttle, turn, lift, stall, damage
- `game/src/world.js` — terrain: islands, sea, volcano, clouds, sun, rings, docks
- `game/src/hud.js` — HUD and lit instruments
- `game/src/missions.js` — the three missions, objectives, scoring, timer
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — WebAudio bleeps: engine hum, ring chime, landing thud, low-fuel alarm
- `game/src/shots.js` — deterministic staged scenes for the screenshots (`?shot=<name>&seed=<n>`)
- `game/src/rng.js` — seeded random numbers
- `main.ts` — hand-in program
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

All art, sounds and names are original — nothing copied from a commercial game.
