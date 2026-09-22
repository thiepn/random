# Randomizer Arcade

A vibrant, local-first randomizer and decision toolbox built as an installable PWA.

## Current foundation

- Secure Web Crypto randomness with unbiased bounded integers
- Weighted selection with per-entry probabilities, exclusions, zero-weight entries, and repeat/no-repeat sampling
- Runtime Fairness panels explaining effective probabilities and Secure vs Seeded semantics
- Advanced Dice expression engine with keep/drop, rerolls, exploding dice, arithmetic, advantage/disadvantage presets, and structured breakdowns
- Advanced Number engine with integer/decimal grids, multiple draws, and unique sampling
- Seeded deterministic mode for reproducible sequences
- Arcade-style responsive UI
- Pools 2.0 stored in IndexedDB: revisioned editing, active/inactive items, tags, structured fields, default weights, weight profiles, saved Views, WorkingSets, archive-first lifecycle, and CSV/TSV import
- Constraint solver with required/preferred together/apart/fixed/capacity/tag rules, numeric balancing, recent-pair avoidance, bounded Fast/Automatic/Thorough search, and explicit impossible-vs-search-limit handling
- Immutable Runs and persistent Sessions with exact Undo/Redo, crash recovery, Replay vs Rerun, grouped/pinned History, and stateful Cards/Elimination persistence
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
- `src/dice-engine.js` — safe dice-expression tokenizer, parser, AST, evaluator, and roll limits
- `src/number-engine.js` — uniform integer/decimal grid generator and unique range sampling
- `src/pool-model.js` — Pool schema v2, WorkingSets, Views, filters, CSV import, duplicate detection, and compatibility normalization
- `src/rule-model.js` — typed constraint rules, compatibility matrix, validation, summaries, and contradiction checks
- `src/constraint-engine.js` — bounded grouping/assignment and Secret Santa solvers with hard constraints and soft optimization
- `src/session-model.js` — immutable Run records, stateful Session timelines, branching Undo/Redo, completion/abandonment, and History grouping
- `src/storage.js` — IndexedDB persistence
- `src/registry.js` — declarative tool catalog
- `src/app.js` — application controller and tool experiences
- `styles.css` — visual system and responsive layout
- `sw.js` — offline shell

## Pool data compatibility

Legacy Pool records are normalized to schema v2 when loaded and are only persisted in the new shape when edited. Pool edits use revisions to prevent silent stale overwrites. Tools copy active Pool/View items into a WorkingSet, so editing a run does not mutate the source Pool.

## Run and Session persistence

IndexedDB schema v3 adds `runs`, `sessions`, `sessionEvents`, and `historyPins`. New random results commit as immutable Runs. Cards and Elimination automatically create persistent Sessions; Undo/Redo changes the Session cursor and restores stored snapshots rather than mutating Runs or consuming randomness. Seeded sequence advancement is committed in the same transaction as each Run.
