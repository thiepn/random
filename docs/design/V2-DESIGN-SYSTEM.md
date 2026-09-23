# V2 — Design System V2

Direction: **Expressive Utility Arcade**  
Depends on: **V1 Visual Audit + Redesign Contract**

## Objective

V2 replaces the informal v1.0 visual foundation with a semantic system that later redesign phases can use without creating more one-off colors, radii, shadows, typography values, or motion timings.

This phase is deliberately foundational. It changes the shared visual baseline but does not yet perform the Home, navigation, tool-family, workbench, or icon-system redesigns scheduled for V3–V8.

## Production source of truth

`design-system.css` owns the shared design primitives and semantic roles.

`docs/design/design-tokens-v2.json` is a machine-readable inventory used for documentation and CI checks.

The existing `styles.css` plus `phase1.css` … `phase14.css` remain temporarily for compatibility. They are now consumers of compatibility aliases rather than owners of the core theme.

## Typography

The system defines explicit roles:

| Role | Intent |
| --- | --- |
| Display | signature home/feature statements |
| Page title | screen identity |
| Result | dominant randomization output |
| Section title | structural grouping |
| Body | ordinary explanatory/content copy |
| Supporting | secondary explanatory copy |
| Label | compact control/status labeling |
| Caption | tertiary metadata |
| Mono | seeds, technical values and code-like data |

No webfont is fetched at runtime. The stack prefers variable/system UI fonts already present on the device and remains fully offline-compatible.

## Color

The palette is split into:

1. neutral reference colors;
2. contextual accent references;
3. semantic surface/text/stroke/status roles.

The visible direction is calmer than v1.0:

- darker neutral canvas;
- clearer distinction among content, interactive and raised surfaces;
- less reliance on simultaneously bright cyan/purple/gold/pink;
- semantic success/warning/danger/info roles;
- sufficiently bright tertiary text for dark-surface readability.

Tool accents remain available, but later phases decide where each accent should actually appear.

## Shape

V2 reduces free-form radius selection to named shape roles:

- control;
- component;
- card;
- feature;
- stage;
- pill;
- circle.

Legacy `--radius-sm/md/lg` aliases now resolve through these roles.

## Depth

Five elevation roles replace arbitrary shadow invention:

- level 0 — flat;
- level 1 — subtle interactive lift;
- level 2 — important raised surface;
- level 3 — hero/result emphasis;
- overlay — dialogs/transient foreground.

Depth should be used selectively. Later phases remove unnecessary borders/cards instead of combining every surface with border + shadow + gradient.

## Spacing

A shared spacing scale now covers compact control spacing through large feature-layout spacing.

Later component migrations should use this scale instead of new arbitrary gaps/padding unless a genuinely new reusable spacing concept is required.

## Motion primitives

Shared motion durations and easing curves now distinguish:

- instant feedback;
- fast control feedback;
- standard UI transition;
- slow structural transition;
- reveal timing.

Reduced-motion mode collapses these token durations without changing application state or decision semantics.

## Legacy compatibility

V2 intentionally keeps aliases for:

- `--bg`
- `--surface*`
- `--border*`
- `--text`
- `--muted`
- existing accent names
- `--radius-sm/md/lg`
- `--shadow`
- `--ease`

This lets the existing v1.0 components adopt the new foundation immediately while V3–V9 migrate them to direct semantic tokens.

The aliases are a migration bridge, not the final API.

## Accessibility

V2 preserves:

- dark `color-scheme`;
- focus-visible semantics;
- higher-contrast overrides;
- forced-colors behavior;
- reduced motion;
- coarse-pointer sizing.

The new tertiary text and accent references were selected to retain strong contrast against the dark canvas/surfaces. Final browser/device contrast verification remains part of V9/V10.

## Performance

The system uses only CSS custom properties and local/system fonts.

No:

- font CDN;
- image dependency;
- JavaScript theme engine;
- runtime token fetch;
- animation library;
- framework dependency

is added.

The global CSS performance budget now counts **all root CSS files**, including semantic redesign files, rather than only legacy phase styles.

## V2 exit criteria

V2 is complete when:

- `design-system.css` is loaded before legacy component styles;
- the service-worker offline shell precaches it;
- semantic typography/color/shape/depth/spacing/motion tokens exist;
- legacy theme variables map to semantic roles;
- foundational existing styles consume semantic tokens;
- performance accounting includes the new stylesheet;
- CI validates token completeness, offline inclusion, version safety, and the no-new-phase-CSS rule;
- all v1.0 functional/production certification remains green.

## Next phase

**V3 — Brand, Iconography & Visual Assets**

V3 replaces the mixed Unicode/symbol identity with a coherent local SVG system and establishes category/tool visual assets on top of the V2 token foundation.
