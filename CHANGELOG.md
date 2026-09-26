# Changelog

All notable production changes to Randomizer Arcade are recorded here.

This project uses semantic versioning from the v1.0.0 production baseline onward.

## [1.2.0] — 2026-09-26

### Tactile Chance Arcade

- R1–R8 full visual/experience overhaul: material system, quiet cabinet shell, machine discovery, Tool Experience 3.0, authored object art, physical motion, and adaptive accessibility art.
- final legacy ordinary-surface cleanup removes pre-redesign dark-only styling from Tool errors/ladder/brackets, Dice/Number advanced controls, constraint/rule-builder surfaces, and Settings data/backup surfaces.
- release-candidate source budgets remain within production limits and draft v1.2.0 release notes are prepared.
- live visual QA verified from the exact Pages artifact in Chromium: 39 rendered checkpoints, 25/25 built-in tool runs, all accents across both themes, accessibility/input states, and long-label/mobile stress.
- live QA found and fixed optional nullish DOM-child rendering and string-result subtitle inheritance defects, both now regression-tested.
- evidence-recording exact-head CI, Production release certification, and Pages deployment passed before the final version/tag/publication commit.

## [1.1.0] — 2026-09-25

### Visual redesign

- semantic Design System V2, Random Spark identity, and local SVG icon system.
- adaptive mobile/tablet/desktop shell and rebuilt Home/Arcade discovery.
- result-first Tool Experience V2 with distinct tool visual families.
- unified reveal motion, reduced-motion alternatives, and presentation polish.
- professional workbench redesign for Pools, History, Presets/Templates, Builder, and Decision Studio.
- persistent System/Light/Dark themes with eight accent choices.
- Higher Contrast, Forced Colors, safe-area, text-zoom, 320px, landscape-mobile, and ultrawide resilience.
- first-paint visual preference boot to prevent theme flash before application startup.
- final removal of obsolete shell CSS and extraction of display controls from the app controller.
- V10 release certification with explicit controller/CSS headroom requirements.
- v1.1.0 release notes, production certification, and deployment verification completed.

This release is backward-compatible with the v1.0.0 local data and portability contracts.

## [1.0.0] — 2026-09-23

### Production baseline

- 25 local-first randomizer and decision tools backed by secure Web Crypto randomness.
- deterministic seeded mode for reproducible decisions and regression testing.
- weighted selection, probability explanations, advanced Dice and Number engines.
- Pools, Views, WorkingSets, constraints, balancing rules, Presets, Rule Sets, immutable Runs, Sessions, Undo/Redo, History, and replay/rerun semantics.
- Session Templates, Party Mode, sanitized audience presentation, Custom Experiences, and Decision Studio workflows.
- IndexedDB persistence with paged/lazy large-data access and atomic multi-store operations.
- full backup, deterministic merge/restore, library transfer, and pre-restore recovery backups.
- installable offline PWA with explicit update activation and bounded same-origin shell caching.
- worker offload for heavy deterministic computation with main-thread equivalence.
- keyboard, focus, contrast, reduced-motion, touch-target, and regional-format accessibility hardening.
- strict import, worker, route, audience, storage, CSP, and cache trust boundaries.
- comprehensive Phase 16 certification covering all focused tests, cross-feature regressions, adversarial inputs, PWA/module-graph invariants, and production size budgets.

### Release policy

v1.0.0 freezes the initial product architecture. Subsequent v1.0.x releases are maintenance releases unless a deliberately scoped minor release is opened.
