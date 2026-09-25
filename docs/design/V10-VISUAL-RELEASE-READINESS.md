# V10 — Final Visual QA, Polish & v1.1 Release Readiness

Direction: **Expressive Utility Arcade — release candidate**

## Objective

V10 closes the V1–V9 visual-redesign track. It does not add a new product system. It removes residual visual debt, verifies every visual layer together, recovers runtime budget headroom, and prepares the repository for a deliberate v1.1.0 version bump.

## Final QA matrix

The release candidate is certified across these axes:

| Surface | Dark | Light | Higher contrast | Forced colors | Reduced motion | 320px | landscape mobile | desktop | ultrawide |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| App shell/navigation | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| Home/Arcade | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool workspace | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Result stage families | ✓ | dark local stage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pools/History | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| Presets/Templates | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| Builder/Studio | ✓ | ✓ | ✓ | ✓ | n/a | ✓ | ✓ | ✓ | ✓ |
| Settings/modals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

The matrix is a code-level release contract; deployed-device spot checks remain part of the release checklist before the v1.1 version bump.

## First-paint correctness

V9 applied visual preferences after application startup. V10 removes that flash-of-wrong-theme path.

A small external `src/visual-boot.js` runs before stylesheets and applies the last mirrored local display preference immediately:

- System / Light / Dark;
- accent;
- contrast;
- control size;
- motion.

The authoritative settings remain in IndexedDB. `src/visual-preferences.js` mirrors only those display preferences into `localStorage` for first paint. Normal startup immediately reconciles the document back to the persisted settings.

The boot script is external and same-origin, preserving the CSP/no-inline-script contract and offline behavior.

## Legacy CSS removal

V10 removes the obsolete pre-V4 shell/navigation layer from `styles.css`:

- old `.layout`;
- old `.topbar`;
- old `.top-actions`;
- old mobile `.bottom-nav`;
- old `.nav-button` states.

The active shell remains solely owned by `app-shell.css`.

The core Stepper background now uses semantic surface tokens instead of a dark literal, eliminating the V9 Light-mode override. The legacy brand icon foreground likewise uses `--color-text-on-accent`.

## Controller consolidation

The app controller was too close to its Phase 13 425 KB budget after V9.

V10 moves all appearance/region controls into `src/visual-preferences.js`, leaving `src/app.js` responsible only for persistence callbacks and rendering orchestration.

This creates release headroom without increasing existing budgets.

## State completeness

V10 re-certifies the existing state system together:

- default;
- hover;
- active;
- selected/current;
- focus-visible;
- disabled;
- busy;
- invalid;
- empty;
- modal;
- offline;
- reduced motion;
- higher contrast;
- forced colors.

No visual state may depend solely on animation or custom color.

## Release boundary

V10 prepares but does **not** automatically publish v1.1.0.

The repository keeps its existing `VERSION` until a deliberate release step. A draft `RELEASE-NOTES-v1.1.0.md` is prepared now so the eventual version bump can be small and auditable.

## Automated certification

`tests/visual-release-v10.mjs` verifies:

- first-paint boot ordering;
- CSP-compatible external boot script;
- offline-shell coverage;
- preference mirroring;
- semantic Stepper/brand styling;
- removal of obsolete shell CSS;
- responsive/safe-area contracts;
- theme, contrast, Reduced Motion and Forced Colors hooks;
- dark local result-stage contract in Light mode;
- app-controller headroom;
- CSS headroom;
- v1.1 release-note readiness;
- presence of the V10 production release gate.

## Exit criteria

V10 is complete when:

- V9 certification is green after the runtime extraction;
- first paint no longer waits for IndexedDB to choose a visual theme;
- obsolete shell CSS is gone;
- core non-stage UI no longer contains the audited dark-only literals;
- `src/app.js` has meaningful space below 425 KB;
- total CSS remains meaningfully below 175 KB;
- V1–V10 production certification passes;
- GitHub Pages deploys the certified commit;
- v1.1 release notes exist;
- `VERSION` is not bumped until an explicit release action.

## After V10

The visual redesign track is complete. Further visual work should be bug fixes or deliberately scoped post-v1.1 improvements rather than another broad redesign phase.
