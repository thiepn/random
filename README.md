# Randomizer Arcade

A vibrant, local-first randomizer and decision toolbox built as an installable PWA.

## Current foundation

- Secure Web Crypto randomness with unbiased bounded integers
- Seeded deterministic mode for reproducible sequences
- Arcade-style responsive UI
- Reusable Pools stored in IndexedDB
- History and favorites
- Offline service worker + web app manifest
- 25 registered tools, including coin, dice, wheel, picker, multi-winner sampling, shuffle, teams, groups, pairs, assignments, elimination, ladder, Secret Santa, cards, tournament draws, chance, lottery, color, date/time, coordinates, direction, letters, and RPS

No build step is required. The repository can be served directly through GitHub Pages.

## Local development

Serve the repository over HTTP, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Architecture

- `src/random-core.js` — decision randomness and deterministic seeded RNG
- `src/storage.js` — IndexedDB persistence
- `src/registry.js` — declarative tool catalog
- `src/app.js` — application controller and tool experiences
- `styles.css` — visual system and responsive layout
- `sw.js` — offline shell
