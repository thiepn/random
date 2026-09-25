# Changelog

All notable production changes to Randomizer Arcade are recorded here.

This project uses semantic versioning from the v1.0.0 production baseline onward.

## [Unreleased] — v1.1 visual redesign

### Visual release candidate

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
- draft v1.1.0 release notes and deployed-device release checklist prepared.

The v1.1.0 version bump remains intentionally separate from this readiness work.

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
