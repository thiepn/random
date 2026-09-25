# Randomizer Arcade v1.1.0 — Visual Redesign

> Release-readiness draft. The repository remains on its current VERSION until an explicit v1.1 release step.

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

## Release checklist

Before changing `VERSION` to `1.1.0`:

- [ ] V1–V10 visual certification passes.
- [ ] Full functional production certification passes.
- [ ] GitHub Pages deploy succeeds.
- [ ] Dark and Light are spot-checked on deployed Home, Tool, Pools and Studio surfaces.
- [ ] 320px mobile and landscape mobile are spot-checked.
- [ ] Reduced Motion and Forced Colors are spot-checked.
- [ ] Settings persistence survives reload and PWA relaunch.
- [ ] No new horizontal overflow is found.
- [ ] Release notes are reviewed.
- [ ] `CHANGELOG.md` receives the final v1.1.0 entry.
- [ ] `VERSION`, document version metadata and service-worker cache generation are bumped together.
