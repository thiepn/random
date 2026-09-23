# V9 — Themes, Responsiveness, Accessibility & Visual Resilience

Direction: **Expressive Utility Arcade — resilient everywhere**

## Objective

V9 makes the V2–V8 visual system reliable across theme, viewport, input, operating-system accessibility mode, and unusual content without changing randomization or persistence semantics.

## Theme system

Settings now exposes three persistent theme preferences:

- **System** — follows `prefers-color-scheme`;
- **Light**;
- **Dark**.

The effective theme is reflected through `data-theme` on the document root and updates the browser/PWA `theme-color`.

Light mode uses a complete semantic surface/text/stroke/shadow palette rather than inverting individual components. Tool result stages intentionally retain a dark local presentation surface in Light mode so Dice, Wheel, Cards and other theatrical stage families keep their contrast and identity.

## Accent personalization

Users can choose:

- Violet;
- Cyan;
- Blue;
- Pink;
- Red;
- Gold;
- Green;
- Orange.

Accent selection changes global primary/secondary accent roles and focus-ring identity while preserving tool-family accent colors where those colors communicate the tool's own visual family.

Theme and accent settings are stored with the existing local display preferences.

## Responsive resilience

V9 explicitly covers:

- 320 px-class narrow phones;
- ordinary mobile;
- tablet/rail layouts;
- desktop;
- 1600 px+ ultrawide layouts;
- short landscape mobile windows.

Narrow layouts reduce gutters and control chrome rather than shrinking text below useful sizes. Tool titles may wrap when space is constrained. Ultrawide layouts increase useful working width without allowing content to stretch indefinitely.

## PWA safe areas

Content and modal backdrops now respect all four `safe-area-inset-*` values. Existing top and bottom navigation safe-area handling remains intact.

This protects installed-PWA layouts around notches, rounded corners, home indicators and landscape device cutouts.

## Long labels and text zoom

High-risk layout containers receive explicit `min-width: 0` behavior and major headings/copy may wrap with `overflow-wrap:anywhere`.

The viewport continues to allow browser zoom. V9 does not introduce `user-scalable=no` or a restrictive maximum scale.

## Contrast

Light-mode primary, secondary and tertiary text are automatically certified at or above WCAG 4.5:1 against both the Light canvas and primary surface.

The existing Higher Contrast preference remains available. V9 adds a Light-specific higher-contrast override so the older dark-theme contrast tokens cannot leak into Light mode.

## Reduced motion

The existing Presentation motion preference remains the source of truth:

- System;
- Reduced;
- Full.

The effective state is reflected in `data-motion`. Reduced mode collapses CSS animation and transition duration and disables smooth scrolling globally. System preference changes are observed live.

The existing reveal engine still converts motion-heavy reveals to its reduced-motion presentation path.

## Forced colors

Forced-colors mode removes decorative shadow dependence and maps core controls, stages, cards and workbench surfaces to system `Canvas`, `CanvasText` and `Highlight` colors.

Selection and active state remain visible without relying only on custom color.

## Visual-state completeness

V9 standardizes otherwise easy-to-miss states:

- disabled controls;
- busy primary actions;
- invalid fields;
- active accent choices;
- keyboard focus;
- modal overflow;
- long labels;
- reduced motion;
- forced colors.

Existing modal focus trapping/restoration, inert backgrounds, skip navigation, segmented-control semantics and keyboard-operable workflow nodes remain unchanged.

## Runtime behavior

`src/accessibility-i18n.js` owns validation and defaults for Theme and Accent in the same normalized accessibility object as Region, Contrast and Control Size.

`src/app.js` applies the effective preferences to the document root and listens for live OS changes to:

- color scheme;
- contrast preference;
- reduced motion.

No randomness, Pool, Run, Session, workflow, backup or storage schema changes are introduced.

## Certification

`tests/themes-resilience-v9.mjs` verifies:

- theme and accent runtime hooks;
- offline inclusion;
- 320 px and ultrawide breakpoints;
- mobile landscape handling;
- safe areas;
- long-text resilience;
- forced colors;
- reduced-motion hooks;
- zoom preservation;
- Light-mode contrast;
- the existing 175 KB total CSS budget.

The V9 suite is part of Production release certification.

## Exit criteria

V9 is complete when:

- System/Light/Dark persist and react correctly;
- all eight accents are selectable and keyboard accessible;
- Light and Dark preserve readable visual hierarchy;
- result stages remain readable in both themes;
- 320 px, landscape mobile and ultrawide layouts have explicit resilience rules;
- PWA safe areas are respected;
- long labels do not force horizontal overflow;
- Light theme text passes contrast certification;
- Reduced Motion and Forced Colors remain functional;
- all existing V1–V8 and functional release gates remain green.

## Next phase

**V10 — Final Visual QA, Polish & v1.1 Release Readiness**
