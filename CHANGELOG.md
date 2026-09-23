# Changelog

All notable production changes to Randomizer Arcade are recorded here.

This project uses semantic versioning from the v1.0.0 production baseline onward.

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
