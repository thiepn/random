# Randomizer Arcade — v1.1 Visual Redesign Contract

Applies to: **V2 through V10**  
Direction: **Expressive Utility Arcade**  
Functional baseline: **v1.0.0**

## 1. Scope boundary

The v1.1 redesign may change presentation, layout, responsive composition, visual assets, interaction feedback, and information hierarchy.

It must not casually change:

- randomization algorithms or probability semantics;
- Secure vs Seeded behavior;
- immutable Run semantics;
- Session Undo/Redo behavior;
- Pools/Views/constraints behavior;
- Preset/Template/Workflow semantics;
- Party privacy rules;
- portable backup format;
- IndexedDB schema;
- security trust boundaries;
- worker determinism;
- service-worker update semantics.

Any required change to those areas must be isolated, justified, regression-tested, and pass the complete production certification suite.

## 2. No phase-CSS proliferation

The legacy `phase1.css` … `phase14.css` files are historical implementation layers.

V2–V10 must **not** add `phase15.css`, `phase16.css`, `phase17.css`, or any later phase-number stylesheet.

The redesign should move toward semantic visual files/components rather than append another chronological CSS layer.

Target organization, introduced progressively from V2:

- design tokens/primitives;
- application shell/layout;
- shared components;
- tool stages;
- workbench/editor surfaces;
- motion;
- responsive/accessibility overrides.

Legacy phase styles may remain temporarily while migrated, but V10 should remove obsolete rules and duplicates.

## 3. Token-first rule

Do not add a raw color, radius, shadow, spacing value, type size, or motion duration to production UI when an appropriate semantic token exists.

If no token exists:

1. determine whether the value represents a reusable design concept;
2. add/extend the token deliberately;
3. use that token at the component site.

Tokens describe meaning, not implementation history.

## 4. Hierarchy before decoration

Before adding:

- another border;
- another card;
- a gradient;
- glow;
- blur;
- animation;
- accent color;

first test whether hierarchy can be achieved through:

- placement;
- spacing;
- typography;
- scale;
- grouping;
- surface level;
- shape.

Decorative effects are the final layer.

## 5. Container rule

A rounded bordered panel is not the default grouping mechanism.

Use a container only when it communicates one of:

- independent object;
- interaction target;
- distinct surface/elevation;
- editable group;
- transient overlay;
- semantic status.

Prefer spacing and typographic grouping for passive content.

## 6. Color contract

- Neutral surfaces carry most of the UI.
- One tool/context accent may dominate a view.
- Success, warning, danger, and informational colors remain semantic.
- Accent color must not replace text hierarchy.
- Avoid simultaneously competing purple/cyan/gold/pink/green accents on ordinary workbench screens.
- Light-theme tokens added in V9 must preserve the same semantic names.

## 7. Shape contract

Target families:

- compact controls;
- standard interactive components;
- cards/objects;
- feature surfaces;
- result/tool stages;
- pills/status chips;
- circles/physical objects.

Pill shapes are reserved for chips, statuses, compact segmented choices, and genuinely capsule-shaped controls.

## 8. Typography contract

The redesign must establish named roles for:

- display;
- page title;
- tool/result metric;
- section heading;
- body;
- supporting body;
- label;
- caption;
- code/seed/technical value.

Do not use tiny text as a substitute for hierarchy. Ordinary explanatory UI should not trend toward 8–10px text.

Typeface assets, if introduced, must work offline and must not require a runtime third-party font request.

## 9. Iconography contract

Primary navigation, categories, and built-in tool identity must converge on one SVG icon system.

Required properties:

- consistent optical size;
- consistent stroke/fill philosophy;
- consistent corner/endpoint treatment;
- aligned baseline;
- local/offline assets;
- decorative SVGs hidden from assistive technology when text labels already identify the control.

Unicode glyphs are not the long-term primary tool-icon system.

## 10. Play vs workbench modes

### Play surfaces

Home, tool stages, results, Party/Audience.

May use:

- stronger scale;
- expressive geometry;
- tool accent;
- tactile objects;
- richer motion.

### Workbench surfaces

Pools, History, Presets/Templates, Builder, Decision Studio, Settings.

Prioritize:

- density;
- legibility;
- scanability;
- stable layouts;
- restrained motion;
- stronger data grouping.

Both modes use the same tokens, type, iconography, navigation, and accessibility rules.

## 11. Responsive contract

Required viewports are defined in `visual-baseline.json`.

General intent:

- mobile: touch-first, single dominant task, bottom navigation;
- tablet: compact rail and adaptive panes where useful;
- desktop: intentional application navigation and multi-pane work areas;
- wide desktop: use space for context/density, not merely larger empty margins.

No primary workflow may require horizontal page scrolling at supported widths.

## 12. Interaction-state contract

Every redesigned interactive primitive must specify:

- default;
- hover where hover exists;
- focus-visible;
- pressed;
- selected/toggled where applicable;
- disabled;
- loading/busy where applicable;
- error where applicable.

Keyboard focus cannot depend on color alone.

## 13. Motion contract

Every animation must belong to one of:

- feedback;
- transition;
- continuity;
- anticipation;
- reveal;
- celebration.

Animations without a state/relationship purpose should be removed.

The existing reduced-motion behavior remains authoritative. No visual phase may regress it.

## 14. Accessibility contract

Preserve or improve:

- skip navigation;
- focus trapping/restoration;
- modal semantics;
- keyboard Decision Studio interactions;
- coarse-pointer target sizing;
- higher-contrast preference;
- forced-colors behavior;
- reduced-motion behavior;
- semantic status announcements.

Visual quality is not an exception to accessibility.

## 15. Performance contract

The redesign must stay within explicit performance budgets.

Avoid making the baseline dependent on:

- large raster backgrounds;
- uncontrolled backdrop blur;
- continuous animation;
- huge SVG DOM;
- external font/CDN availability;
- JavaScript layout animation for effects CSS can perform safely.

Effects that materially reduce responsiveness must have lower-cost fallbacks.

## 16. Data/privacy contract

Visual changes must not expose hidden or private state.

In particular:

- Secret Santa remains private;
- audience views receive only sanitized audience data;
- seed/random context does not become presentation content accidentally;
- internal Pool metadata does not leak into public Party/Audience presentation.

## 17. State preservation

A visual rerender must not:

- consume randomness;
- create a Run;
- advance a seeded sequence;
- change Session cursor/state;
- mutate a Pool;
- modify a Workflow/Template session;
- trigger persistence merely because styling/layout changed.

Presentation remains downstream of committed product state.

## 18. Screenshot and browser QA contract

Before v1.1.0 release, V10 must capture/verify representative screens for the surface and viewport matrix defined by V1.

Source inspection alone is insufficient for final certification.

The final visual QA must explicitly check:

- clipping/overflow;
- hierarchy;
- density;
- alignment;
- text wrapping;
- long content;
- empty/error states;
- hover/focus/pressed states;
- reduced motion;
- high contrast;
- light/dark themes once introduced;
- PWA standalone safe areas;
- Chrome/Chromium and Firefox at minimum;
- Safari/WebKit where test infrastructure permits.

## 19. Release discipline

The redesign is a planned **v1.1.0** minor release.

Do not publish intermediate V2–V9 work as `v1.1.0`.

Each phase must keep CI green. V10 performs final consolidation, browser visual QA, functional regression, performance certification, and release preparation.
