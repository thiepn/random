# Randomizer Arcade v1.1.0 — Visual Redesign

v1.1.0 completes the V1–V10 visual redesign track while preserving the local-first randomization architecture and existing product semantics.

## Highlights

- New semantic Design System V2 for typography, color, spacing, elevation, shape and motion.
- Random Spark brand identity and coherent local SVG iconography.
- Adaptive mobile bottom navigation, tablet rail and full desktop application sidebar.
- Rebuilt Home and Arcade discovery surfaces.
- Result-first Tool Experience V2 with distinct visual families for Coin, Dice, Wheel, Cards, Color, list, people, competition, private and generator tools.
- Unified reveal choreography with reduced-motion alternatives and presentation-safe result semantics.
- Professional workbench surfaces for Pools, History, Presets, Templates, Builder and Decision Studio.
- Persistent System, Light and Dark themes.
- Eight user-selectable accent palettes.
- Higher Contrast, Forced Colors, Reduced Motion, text-zoom and safe-area resilience.
- Explicit 320px, landscape-mobile, desktop and ultrawide handling.
- First-paint visual preference boot to avoid theme flash before IndexedDB startup.
- Final legacy CSS cleanup and controller/CSS budget recovery.

## Accessibility

The visual redesign retains or improves:

- skip navigation;
- semantic main landmarks;
- modal focus trapping and restoration;
- inert modal backgrounds;
- keyboard-operable workflow nodes;
- visible focus rings;
- 44px coarse-pointer targets;
- large-control preference;
- Higher Contrast preference;
- Reduced Motion;
- Forced Colors;
- browser zoom;
- long-label wrapping and narrow-screen resilience.

## Compatibility

v1.1.0 does not intentionally change:

- randomization algorithms;
- Secure or Seeded randomness semantics;
- Pool schemas;
- Run immutability;
- Session behavior;
- Preset/Template behavior;
- Party privacy rules;
- Custom Experience execution;
- Decision Studio workflow semantics;
- backup/restore format;
- IndexedDB schema.

Existing local data should continue to load without migration.

## Certification

v1.1.0 is published only after the complete repository gate succeeds:

1. focused syntax/model/engine/regression certification;
2. accessibility, security, persistence, worker, offline, and performance checks;
3. V1–V10 visual certification;
4. cross-feature release regression and adversarial fuzzing;
5. final production repository/PWA certification.

The release workflow tags the exact certified main-branch commit. GitHub Pages deployment is verified against the same release commit.

## Compatibility

No IndexedDB or portable-backup schema migration is required for v1.1.0. Existing local data remains compatible with the v1.0.0 production baseline.
