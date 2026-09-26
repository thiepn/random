# Production Certification — v1.2.0

This file defines the release gate for Randomizer Arcade after the feature, performance, accessibility, persistence, and security implementation phases.

## Release policy

A commit is production-certifiable only when both GitHub Actions jobs pass:

1. **certify** — syntax plus all focused engine/model/regression suites.
2. **Production release certification** — cross-feature integration, adversarial fuzzing, and repository/PWA production invariants.

A failure in either job is a release blocker. The release gate is intentionally deterministic, dependency-free, and runnable with Node 24.

## Certified surfaces

The automated gate covers:

- Random Core deterministic golden vectors and bounded random primitives.
- All built-in tool engines and constraint solving.
- stateful Sessions, Undo/Redo, Templates, Party Mode, Presets, Pools, and Decision Studio models.
- Custom Experience validation, import/export, and execution.
- portable backup/merge/restore format integrity.
- worker/main-thread deterministic equivalence.
- large-scale persistence/query regressions.
- accessibility interaction and regional-format invariants.
- security boundaries for imports, routes, worker messages, audience messages, CSP, and cache scope.
- cross-feature chains spanning Preset → Tool → immutable Run → Party audience → portable backup.
- Session Template result handoff through real tool execution.
- hostile portable envelopes, prototype-pollution keys, excessive nesting, hostile route tokens, forged private audience payloads, and unauthorized worker task types.
- PWA manifest/scope/offline-shell completeness.
- complete local ES-module dependency graph for the app and compute worker.
- absence of production Math.random, eval/new Function, document.write, innerHTML assignment, outerHTML assignment, and insertAdjacentHTML.
- absence of remote JavaScript module dependencies.
- production JavaScript, CSS, service-worker, and manifest size budgets.
- V1–V10 visual contracts plus R1–R8 Tactile Chance Arcade contracts: material system, cabinet shell/discovery, Tool Experience 3.0, authored object art, cancelable physical motion, adaptive accessibility art, live visual QA evidence, and release headroom.

## Operational release checks

For v1.2.0, the live visual/browser matrix is recorded in `docs/redesign/R8-LIVE-VISUAL-QA.md` and was completed before release authorization.

Before calling a future deployment fully released, also verify the deployed GitHub Pages build:

- app loads with no fatal startup error.
- a Coin/Dice/Picker action produces a result.
- installable PWA shell loads again after offline navigation.
- Settings opens and reports storage/PWA state.
- a JSON backup can be exported.
- a valid backup reaches the import review screen without mutation.
- malformed/oversized imports are rejected.
- Party audience mode does not reveal Secret Santa assignments.
- keyboard navigation and modal Escape/focus behavior remain usable.
- mobile layout has no blocking horizontal overflow.
- System/Light/Dark switching is spot-checked on Home, Tool, Pools, and Studio.
- 320px and short landscape-mobile layouts remain usable.
- Reduced Motion and Forced Colors remain usable on the deployed build.
- a reload/PWA relaunch starts in the expected visual theme without a blocking wrong-theme flash.

These deployment checks validate the hosting/browser layer that pure Node certification cannot reproduce.

## Known platform limits

Randomizer Arcade is a static local-first GitHub Pages application. GitHub Pages does not expose repository-configurable HTTP security headers, so the project uses an HTML meta Content Security Policy where supported. The portable FNV-1a checksum detects accidental corruption and unsynchronized tampering; it is not a cryptographic authenticity signature.

No telemetry, advertising SDK, remote account backend, or analytics transport is required for the certified build.
