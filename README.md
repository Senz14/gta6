# gta6
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Senz14/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Senz14/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** — an original open-world crime game in the spirit of GTA 6, playable offline in a desktop browser from static files. No Rockstar Games content: the city, characters, vehicles, names and story are all invented here.

You are **Rico Vega**, fresh out and looking for work in the sun-soaked streets of Solmar City. **Donna Marisol** has jobs; the **Barracudas** want the city for themselves; the **Solmar PD** wants you. Steal cars, lose the heat, run six story missions, and own the city.

## What is in the game

- **A living city** — a 2600×2600 procedurally built city with six districts (Old Port, Downtown, Neon Strip, Palm Heights, Sunset Beach, Marina Bay), a harbour, a beach, parks, and landmarks like Solmar Tower and the Neon Strip.
- **On foot and by car** — walk, run, and drive with real car handling (acceleration, braking, handbrake, collisions). Any traffic car can be stolen — yank the driver out and go.
- **Traffic and pedestrians** — cars cruise the road grid and turn at intersections; pedestrians stroll the sidewalks and flee from gunfire.
- **Wanted level and police** — 5 stars of heat. Steal cars, shoot, or run people over and the cops come: patrol cars ram you, officers chase you on foot. Outrun them, or lay low at the Safehouse until the heat fades.
- **Missions and a story** — six missions with briefings, objective markers, timers, and payouts: steal your first wheels, run a package, lose a pursuit, settle a score with the Barracudas, drive a getaway, and pull the final job.
- **Combat** — pistol with mouse aim, reloads, ammo pickups, health packs, street cash, and rival gang members who shoot back.
- **HUD with minimap** — cash, health, ammo, wanted stars, clock, district name, mission tracker, speedometer, and a live circular minimap with mission, police, and player markers.
- **Start and save** — title screen with New Game / Continue, autosave after every mission and on pause, and Busted / Wasted screens with a Safehouse respawn.
- **Polish** — synthesised sound (engine, sirens, gunshots, music bassline — no audio files), screen shake, particles, a golden-hour look, and toasts that guide you.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Shift | Run |
| E | Steal / enter / exit a car |
| Mouse + click / F | Aim and shoot |
| Space | Punch on foot / handbrake in a car |
| R | Reload |
| M | Start the next mission |
| Esc / P | Pause (autosaves) |
| N | Mute |

## Run it

No build step, no network. Serve the `game/` folder with any static server and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from disk. The game runs entirely from its own files.

## Files

- `game/index.html` — the page; `game/src/` — the game, split by job: `config.js`, `world.js` (city generation), `entities.js` (cars, pedestrians, bullets), `missions.js` (story), `render.js`, `hud.js`, `audio.js`, `input.js`, `save.js`, `main.js`, `shots.js` (screenshot presets).
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — real renders of the game: title, driving, police chase, mission complete.

<sub>Entered on [make.fun](https://make.fun/?ref=jkmc4mts&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
