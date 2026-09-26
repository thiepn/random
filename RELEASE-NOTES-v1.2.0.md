# Randomizer Arcade v1.2.0

**Status: Release candidate — live visual QA verified; final version metadata pending**

v1.2.0 is the **Tactile Chance Arcade** overhaul. It is backward-compatible with the v1.1.0 randomness, local data, portability, privacy, and offline contracts.

## What changed

- **Visual System 3.0** — warm Night Cabinet and Day Table environments, material/shape/depth roles, quieter secondary UI, and tactile primary hardware.
- **Cabinet composition** — a reduced-chrome application shell, Home as an arcade entrance, Quick Bay, House Machine, and machine-style Arcade discovery.
- **Tool Experience 3.0** — Rules + result chamber + action console now read as one chance machine, with progressive native Setup disclosure.
- **Authored object art** — all 25 built-in tools map to local SVG object families: Coin, Dice, Wheel, Cards, tokens, tickets, instruments, envelope, trophy, and color palette.
- **Physical motion** — cancelable WAAPI toss/throw/spin/deal/scatter/draw/readout/seal/impact/fan behavior tied to the existing committed-result presentation plan.
- **Adaptive art** — theme-aware neutral materials, genuinely light Day Table stages, Higher Contrast, Forced Colors, Reduced Motion, Large Controls, 320px/text-zoom, touch and ultrawide handling.
- **Final consolidation** — remaining ordinary feature surfaces using the old dark palette were migrated to semantic/material roles and unused pre-redesign decoration was removed.

## Compatibility

No intentional changes to:

- Random Core behavior;
- secure or seeded randomness semantics;
- Pool/Rule/Run/Session data contracts;
- backup/import formats;
- privacy boundaries;
- IndexedDB schema;
- offline architecture.

## Release-candidate validation

Source-level R1–R8 contracts, budgets, offline module coverage, visual family coverage, motion cancellation, accessibility states, and legacy-style cleanup are protected by CI.

Current R8 source baseline:

- 19 root stylesheets;
- 173,924 bytes CSS;
- 422,181-byte app controller;
- 757,042 bytes total production JavaScript.

## Required before publication

v1.2.0 must **not** be tagged until all of the following are complete:

1. exact-head full CI succeeds;
2. exact-head GitHub Pages deployment succeeds;
3. the R8 release decision is changed from `hold` to `release`.

The live Chromium matrix is complete and recorded in `docs/redesign/R8-LIVE-VISUAL-QA.md`: 39 rendered checkpoints, 25/25 built-in tool runs, Night/Day responsive states, all accents, accessibility/input states, and long-label/mobile stress.

The version/cache/tag/release update belongs to **v1.2.0 — Release & Deployment Finalization**, not R8.
