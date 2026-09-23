# Randomizer Arcade

A vibrant, local-first randomizer and decision toolbox built as an installable PWA.

**Stable release: v1.0.0** — production-certified on 2026-09-23. See [CHANGELOG.md](./CHANGELOG.md), [RELEASE-NOTES-v1.0.0.md](./RELEASE-NOTES-v1.0.0.md), [PRODUCTION-CERTIFICATION.md](./PRODUCTION-CERTIFICATION.md), and [MAINTENANCE.md](./MAINTENANCE.md).

The v1.0.0 baseline freezes the initial architecture. Default follow-up work is targeted maintenance and patch releases; broad feature expansion should be deliberately scoped as a later minor release.

## v1.1 visual redesign track

A deliberate visual-overhaul track is now scoped for **v1.1.0**. V1 does not change product behavior; it freezes the visual problem definition and redesign rules before production styling begins.

- [V1 Visual Audit](./docs/design/V1-VISUAL-AUDIT.md)
- [Visual Redesign Contract](./docs/design/REDESIGN-CONTRACT.md)
- [Machine-readable Visual Baseline](./docs/design/visual-baseline.json)
- [V2 Design System](./docs/design/V2-DESIGN-SYSTEM.md)
- [V2 Token Inventory](./docs/design/design-tokens-v2.json)
- [V3 Brand & Iconography](./docs/design/V3-BRAND-ICONOGRAPHY.md)
- [V3 Icon Catalog](./docs/design/icon-catalog-v3.json)

Selected direction: **Expressive Utility Arcade** — tactile, precise, playful, tool-specific, high-hierarchy, and restrained in its use of depth/effects.

**V2 foundation:** semantic typography, color, spacing, shape, elevation, and motion roles now live in `design-system.css`. Legacy phase styles consume compatibility aliases while later redesign phases progressively replace them.

**V3 identity:** Random Spark is the application mark, and all built-in navigation/categories/tools now have a coherent local SVG identity. Legacy glyph fields remain only as compatibility/user-content fallbacks.

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
- Instant/Normal/Showtime presentation engine with tool-specific reveal choreography, Web Audio cues, optional haptics, deterministic particles, Wheel ticks, reduced-motion alternatives, skip-safe reveals, and automatic low-device effect fallback
- Reusable Presets with live Pool/View bindings, frozen inputs, prompt inputs, favorites, and saved Rule Set integration
- Linear Session Templates with previous-result handoff, persistent Template Sessions, step locking, dependency invalidation, and Rerun From Here
- Fullscreen Party mode with persistent Party Sessions, Fast/Standard/Dramatic reveals, configurable countdowns, Host Lock, Wake Lock, pass-the-phone private reveals, TV/projector layouts, and an optional sanitized audience window
- Safe declarative Custom Builder with user-created Wheels, Pickers, Dice, Deck draws, weighted tables, Number generators, bounded compound generators, drafts, Test Mode, validation, import/export, and My Creations
- Decision Studio workflow graphs with runtime/fixed Input nodes, saved-Preset Randomizer nodes, True/False Branch nodes, terminal Outcomes, automatic or step execution, resumable workflow sessions, and bounded acyclic automation
- Versioned, checksummed full backups with atomic merge/restore, automatic pre-restore recovery backups, and bounded import validation
- Cross-device library transfer through ordinary JSON files or the platform Share sheet, using deterministic record merge semantics instead of requiring an account
- Per-device local identity, storage-quota/durability visibility, PWA install controls, offline awareness, and explicit in-app service-worker update activation
- Background module-worker execution for heavy constrained/list randomization and large backup parsing/merge/serialization, with deterministic seeded equivalence and safe main-thread fallback
- IndexedDB v11 recent/tool/group indexes, paged History loading, active/latest Session hydration, lazy historical Run loading, bounded Pool editor rendering, and capped result/Fairness DOM previews
- Accessibility hardening with skip navigation, deterministic modal focus trapping/restoration, inert modal backgrounds, keyboard-operable graph nodes, 44px coarse-pointer targets, higher-contrast controls, and persistent display preferences
- Regional-format internationalization architecture for locale-aware dates, numbers, and storage sizes across system, US English, German, French, and Korean formats while accurately keeping the current UI language English
- History and favorites
- Offline service worker + hardened web app manifest
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
- `src/presentation-engine.js` — presentation plans, reduced-motion/effect fallback, Web Audio cues, haptic patterns, and reveal-mode semantics
- `src/preset-model.js` — Presets, live/frozen/prompt input bindings, favorites, Rule Sets, and source-scope compatibility
- `src/session-template-model.js` — linear Session Templates, runtime Template Sessions, locking, invalidation, built-ins, and result handoff contracts
- `src/party-model.js` — Party Session progression, pace/countdown options, privacy rules, and sanitized audience-state construction
- `src/custom-experience-model.js` — safe Custom Experience schema, allowlisted primitives, appearance/input rules, validation, import/export, and custom tool identities
- `src/custom-engine.js` — bounded execution of approved Custom Experience primitives using the same Random Core, Dice engine, and Number engine
- `src/workflow-model.js` — Decision Studio graph schema, validation, branching conditions, workflow sessions, and bounded execution-state transitions
- `src/data-portability.js` — portable backup schema, checksum/integrity validation, library/full scopes, deterministic cross-device merges, and safe replacement planning
- `src/performance-model.js` — centralized paging, rendering, workload, and worker-offload thresholds
- `src/compute-tasks.js` — deterministic pure task dispatcher shared by worker execution and CI equivalence tests
- `src/worker-client.js` / `src/compute-worker.js` — lazy module-worker lifecycle, bounded task timeouts, error propagation, and background execution
- `src/accessibility-i18n.js` — normalized accessibility preferences, regional locale resolution, locale-aware date/number/byte formatting, contrast resolution, and focus-navigation primitives
- `src/security.js` — trust-boundary validation for imported/persisted data, route tokens, audience/worker protocols, download names, and adversarial size/depth/key limits
- `src/storage.js` — IndexedDB persistence, v11 recent/status/tool/group indexes, cursor pagination, bounded Session hydration, targeted batch reads, atomic restore, storage durability/usage status, and local device identity
- `src/registry.js` — declarative tool catalog
- `src/app.js` — application controller and tool experiences
- `styles.css` — visual system and responsive layout
- `sw.js` — offline shell

## Pool data compatibility

Legacy Pool records are normalized to schema v2 when loaded and are only persisted in the new shape when edited. Pool edits use revisions to prevent silent stale overwrites. Tools copy active Pool/View items into a WorkingSet, so editing a run does not mutate the source Pool.

## Run and Session persistence

IndexedDB schema v3 adds `runs`, `sessions`, `sessionEvents`, and `historyPins`. New random results commit as immutable Runs. Cards and Elimination automatically create persistent Sessions; Undo/Redo changes the Session cursor and restores stored snapshots rather than mutating Runs or consuming randomness. Seeded sequence advancement is committed in the same transaction as each Run.

## Game feel and correctness

Presentation is deliberately downstream of correctness: a Run is committed before its reveal starts. Instant, Normal, and Showtime therefore change only animation/audio/haptics/particles. Skip, backgrounding, navigation, Undo, and Redo can cancel presentation without changing the committed result or consuming new randomness.

## Presets and multi-step Sessions

IndexedDB schema v4 adds `ruleSets`, `sessionTemplates`, and `templateSessions`. Presets may bind to the latest live Pool/View, freeze a copied input snapshot, or request fresh input. Session Templates remain deliberately linear: steps may use a Preset input or the output of an earlier step. Branching belongs to Decision Studio; workflow graph cycles are intentionally rejected so automatic execution always terminates. Completing a Template step is committed atomically with the Run that produced it.

## Decision Studio workflows

IndexedDB schema v7 adds `workflows` and `workflowSessions`. Workflow definitions are revisioned separately from their runtime sessions. Randomizer nodes reference saved Presets and execute through the same tool engine and immutable Run transaction path as normal play, so secure/seeded randomness, Pool bindings, constraints, fairness metadata, and History remain consistent. Each committed Run records its `workflowSessionId` and `workflowNodeId`, and the workflow session advances atomically with that Run. Auto mode is bounded by a per-workflow step limit and the validator rejects graph cycles; Step mode advances exactly one graph node per action.

## Persistence, backup, transfer, and PWA lifecycle

IndexedDB schema v8 added a local `deviceMeta` record while keeping device identity outside portable backups. Schema v9 added compound recent-record indexes for Runs/legacy History and recent/status indexes for runtime Sessions. Schema v10 added tool-specific recent-history indexes for exact history-aware rule lookbacks. Schema v11 adds latest-per-template/workflow compound indexes so startup keeps only active plus latest runtime Sessions in memory instead of loading lifetime Session history. A **full backup** contains every portable collection, including immutable Runs, History, and active Session records. A **library transfer** intentionally excludes runtime history and carries reusable Pools, Views, Presets, Rule Sets, Session Templates, Custom Experiences, Workflows, favorites, and settings.

Portable files use a versioned `randomizer-arcade-portable` envelope with a deterministic integrity checksum, record/depth/size limits, and unsafe-key rejection. **Merge** unions unique records, prefers higher revisions and newer timestamps, and refuses to silently overwrite divergent immutable Runs. **Restore/Replace** is atomic across the affected IndexedDB stores and automatically downloads a complete pre-restore safety backup first.

The cross-device layer is transport-independent: today the app can move a library package through a downloaded file or the browser/OS Share sheet, then merge it on another device. No cloud account is required, and the portable format is the compatibility boundary for a future optional remote sync transport.

The PWA shell exposes install availability, online/offline state, storage durability, quota usage, and pending updates in Settings. New service workers wait until the user chooses **Apply update**, then activate through `skipWaiting` and reload under the new controller. The manifest has a stable app ID, launch handling, display fallbacks, and shortcuts for Decision Studio and Pools.

## Performance, workers, and large-scale data

Phase 13 moves expensive pure work away from interaction rendering without changing decision semantics. Constrained tools with sufficiently large inputs, very large list operations, and large compound Custom Experiences are dispatched to a lazily-created **module Web Worker**. The worker reconstructs the same Secure or Seeded RNG from a serializable random specification and calls the same Tool/Custom engines; seeded worker/main-thread equivalence is certified in CI. A global in-flight compute lock prevents overlapping seeded commits or Settings mutations from racing the sequence position.

Large portable backup parsing, merging, and serialization also use the same worker infrastructure above size/record thresholds. Unsupported Worker environments and worker creation/post/crash failures fall back to the same main-thread engine. Worker timeouts and actual task errors still propagate instead of silently retrying expensive or invalid work.

IndexedDB no longer loads the full `runs`, legacy `history`, stateful `sessions`, Party Sessions, or lifetime Workflow/Template Session stores during startup. The app reads recent Run/History pages through compound `[timestamp,id]` indexes, loads active stateful/Party Sessions through status indexes, and keeps only active plus latest-per-definition Template/Workflow Sessions through v11 compound indexes. Historical Runs and deep-linked older Sessions are batch-hydrated on demand. Tool-specific `[toolId,timestamp]` indexes preserve the full configured lookback semantics of history-aware constraints without loading unrelated Runs. Standalone-history deletion still scans the complete store transactionally, so pagination does not leave hidden old records behind.

Rendering is similarly bounded: History groups and Pool editor rows grow progressively, large result lists/Fairness probability tables render capped previews while preserving the complete immutable data, and library cards use CSS `content-visibility` containment for off-screen work. Settings exposes the current compute path, loaded History cache, and last compute duration for diagnostics.

## Accessibility, internationalization, and interaction hardening

Phase 14 adds a stable accessibility contract without changing randomization semantics. Every ordinary view exposes a `main` landmark targeted by a keyboard **Skip to main content** link, the announcement region uses `role="status"`, segmented controls expose pressed state, and long-running randomization marks the app as busy. Dialogs derive accessible names/descriptions from their visible headings/copy, trap Tab/Shift+Tab inside the modal, mark the background app inert, preserve focus through modal rerenders, and restore focus to the control that opened the dialog when it closes.

Decision Studio graph cards are now keyboard-selectable with Enter/Space instead of relying on pointer clicks. Coarse-pointer environments enforce minimum touch targets, an optional **Large controls** preference increases interactive sizes further, and a **Higher contrast** preference strengthens borders/muted text while respecting live `prefers-contrast` changes. Existing Reduced Motion behavior remains authoritative for animations and now also controls programmatic navigation scrolling.

The current product language remains English; Phase 14 does not falsely mark English interface text as translated. Instead, Settings exposes a **Regional format** preference—System, `en-US`, `de-DE`, `fr-FR`, or `ko-KR`—which consistently controls displayed dates, numbers, and storage sizes through the shared internationalization model. The manifest/document continue declaring English/LTR until full message translation is implemented.

## Security, privacy, integrity, and adversarial hardening

Phase 15 treats every external or cross-context boundary as untrusted even though the app remains local-first. Portable JSON is size-checked **before** the browser reads it into memory, then passes strict envelope/store validation, unsafe-key/depth/node limits, canonical store requirements, checksum verification, and a second storage-record preflight before an atomic restore starts. URL route identifiers are bounded to the app's identifier alphabet, and generated download filenames are normalized so user-created names cannot inject path/control characters.

Module-worker messages now use an allowlisted protocol with bounded structured-data validation on both request and response paths. Party `BroadcastChannel` requests are schema-checked, audience updates are reduced to a strict receive-side schema, and Secret Santa is forced private again on the receiving side even if another same-origin tab attempts to forge an audience payload. Invalid worker protocol messages fail closed instead of being silently retried.

The document ships a restrictive meta Content Security Policy because GitHub Pages does not provide repository-controlled response headers: scripts, workers, connections, manifests, and assets are limited to the app origin, `eval` remains forbidden by CI, and referrers are disabled. Inline style permission is retained because the existing UI uses safe CSSOM style assignments. The service worker now caches only the explicit same-origin application shell and will not turn arbitrary GET requests into an unbounded runtime cache.

Randomizer Arcade does not add telemetry, advertising, remote accounts, or analytics in this phase. User data remains in browser storage unless the user explicitly exports or shares it. Portable-file `fnv1a32` is a deterministic **corruption/tamper-detection checksum, not an authenticity signature**: anyone who can edit a file can also recompute it, so imported files should still be treated as untrusted data. CI now certifies the trust-boundary validators, CSP presence, privacy invariants, worker protocol, and cache isolation.

## Comprehensive QA and production certification

Phase 16 freezes feature expansion and adds the final release gate. CI now uses two levels: the existing **certify** job runs syntax checks and all focused engine/model/regression suites, then a separate **Production release certification** job runs only after that foundation passes. Stale CI runs are cancelled, both jobs have bounded timeouts, and the workflow can also be triggered manually for explicit release checks.

The release layer adds cross-feature tests that execute real chains across Custom Experiences, Presets, Tool execution, immutable Runs, Party audience state, Session Templates, and full portable backup/merge round trips. A separate adversarial suite exercises malformed portable envelopes, missing/extra stores, unsafe prototype keys, excessive nesting, hostile route tokens, forged Secret Santa audience results, and unauthorized worker task types.

The final repository audit walks the complete local ES-module graph from the app and compute-worker entry points, verifies that every reachable module exists and is in the offline shell, validates manifest scope/local assets, preserves CSP/no-inline-script constraints, forbids unsafe execution/HTML sinks and `Math.random` in production code, rejects remote module dependencies, and enforces JavaScript/CSS/service-worker/manifest size budgets. The exact automated and deployed-browser release criteria are recorded in [PRODUCTION-CERTIFICATION.md](./PRODUCTION-CERTIFICATION.md).

## Party mode and audience privacy

IndexedDB schema v5 adds `partySessions`. Party Runs append to their Party Session in the same transaction as the immutable Run and seeded-position update. Fast/Standard/Dramatic only override presentation. Secret Santa uses a pass-the-phone privacy gate, and the audience window receives a strict sanitized `AudienceState` over `BroadcastChannel`; it starts in a minimal mode and does not load the host's Pools, History, Presets, or other IndexedDB data. The audience window is opened with `noopener` so it cannot inspect the host window.

## Custom Builder safety and interoperability

IndexedDB schema v6 adds `customExperiences`. User-created definitions are declarative JSON data only: the validator rejects custom JavaScript, HTML, CSS, event-handler keys, cyclic definitions, forward/cyclic compound dependencies, oversized definitions, invalid Dice notation, and unbounded numeric/list settings. Published creations resolve as `custom:<id>` tool identities without modifying the built-in registry, so they can create immutable Runs, enter Party Mode, be saved in Presets, and participate in linear Session Templates. Builder Test Mode uses a dedicated deterministic seed and creates no Run or app-seed advancement.
