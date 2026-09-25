# R7 — Themes, Personalization & Accessibility Art Pass

Status: **implemented**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Objective

R7 makes the R2–R6 visual system behave as one product across theme, personalization, accessibility, device size, zoom, input mode, and PWA surfaces.

R7 does not introduce a third theme family or decorative theme presets. It strengthens the two authored environments already selected:

- **Night Cabinet**
- **Day Table**

System theme remains supported and resolves to one of those two environments.

## 1. Adaptive authored-object materials

R5 object artwork originally contained many fixed material colors. R7 moves the physical neutral materials into semantic art tokens.

New authored material roles include:

- metal highlight / mid / low / deep / ink / ridge;
- enamel highlight / mid / low / stroke / ink;
- paper highlight / paper / mid / low / stroke / ink / red ink;
- card back / deep / mark;
- hardware stroke / dark;
- glass highlight / glass;
- wax / deep / mark;
- trophy / deep / mid / mark.

The SVG renderer now consumes these tokens directly.

### Stable physical colors

Not every physical material should change when the environment changes.

Saturated authored objects such as:

- gold Coin metal;
- purple card back;
- red wax;
- trophy brass;

retain their recognizable material identity between Night Cabinet and Day Table.

### Environment-sensitive neutrals

Neutral materials receive Day Table tuning:

- paper becomes warmer/brighter;
- enamel becomes slightly lighter;
- neutral strokes become darker and cleaner;
- hardware lines become darker;
- instrument glass becomes lighter than Night Cabinet glass.

This preserves object identity without making Day Table look like a dark stage placed inside a light app.

## 2. Day Table is genuinely light

The old compatibility rule forced Light-theme Tool stages back to a dark local palette.

R7 removes that inversion.

Light tool stages now inherit:

- `--material-tray`;
- light material rims;
- light inset depth;
- light-theme object tokens.

The explicit `html[data-theme="light"] .tool-stage-v2` rule remains only to add the authored light-stage contact highlight.

## 3. Accent behavior

The user-selected accent continues to personalize:

- focus;
- selected controls;
- application hardware;
- generic fallback art.

Tool identity remains separate.

Authored tool objects prefer:

1. explicit `--machine-accent`;
2. tool `--accent`;
3. user `--color-accent-primary`.

This prevents choosing a global accent from recoloring every Coin, Card, Envelope, or Trophy into the same color.

## 4. Higher Contrast

Higher Contrast keeps the semantic contrast overrides from V9/R2 and now also applies a restrained contrast increase to authored art.

The goal is stronger object edges without changing the meaning or geometry of the object.

## 5. Forced Colors

Authored art is decorative, so Forced Colors prioritizes semantic text and controls.

R7 maps SVG geometry directly to system colors:

- object fills → `Canvas`;
- object strokes → `CanvasText`;
- object text → `CanvasText`;
- transparent geometry remains transparent;
- decorative object shadows are hidden.

Result text remains normal semantic DOM and therefore remains the authoritative result.

## 6. Reduced Motion

R6 already prevents WAAPI physical motion when Reduced Motion is active.

R7 completes the visual side:

- authored objects cannot retain hover transforms;
- authored objects cannot retain hover filters;
- static object composition remains visible;
- V7 opacity-only reveal remains available.

## 7. Large Controls

Large Controls now applies not only to generic form controls, but also to the actual randomizer hardware:

- primary randomize action → at least 68px;
- Setup disclosure → at least 64px;
- Arcade category hardware → at least 56px;
- Home Quick Bay controls → at least 56px.

## 8. 320px / text-zoom resilience

R7 adds an explicit 320px visual contract.

At extreme effective viewport widths:

- Home hero actions become one column;
- Quick Bay becomes one column;
- Arcade categories become a horizontally scrollable one-row hardware rail;
- category controls keep a minimum readable width;
- Tool stage minimum height reduces;
- Tool art scales down;
- Setup and Action Console padding tighten safely.

This also improves behavior when browser text zoom reduces the effective CSS viewport.

Browser zoom remains enabled.

## 9. Ultrawide art scaling

At >=1600px:

- stage art may scale modestly up to 12.5rem;
- featured art may scale up to 13rem;
- the existing R3/R4 workspace width rules remain authoritative.

Objects do not scale indefinitely with viewport width.

## 10. Touch and hover

R6 object hover physics only apply to fine-pointer hover devices.

R7 explicitly neutralizes authored-object hover transforms on `hover:none` devices.

Touch users receive press feedback through the underlying button/control system instead of sticky simulated hover.

## 11. PWA and browser surfaces

The static install/launch surface now uses the Night Cabinet baseline:

- manifest background: `#11110e`;
- manifest theme color: `#11110e`.

Runtime theme switching still updates the document `theme-color`:

- Day Table → `#f3efe6`;
- Night Cabinet → `#11110e`.

The document also declares:

`<meta name="color-scheme" content="dark light">`

so native browser UI knows both schemes are supported.

The install icon and reusable Random Spark brand mark now use the same final default identity:

- Night Cabinet background;
- Violet primary spark;
- Gold hardware accent;
- warm neutral secondary dot;
- no legacy violet/cyan tech gradient.

## 12. Visual simplification and budget recovery

R7 initially exceeded the CSS ceiling after adding adaptive material tokens.

The production ceiling was not raised.

Instead R7 removed decorations that became redundant after R5:

- Tool-card aura circle;
- extra Home Wheel ring.

The authored object now carries its own depth and silhouette.

R7 also avoids duplicating saturated material overrides between themes and avoids duplicating art-token remapping in Forced Colors because Forced Colors maps the SVG geometry directly.

## Architecture

R7 adds no stylesheet.

Ownership remains:

- `design-system.css` — authored material tokens and theme values;
- `src/hero-art.js` — SVG geometry consuming those tokens;
- `tool-experience.css` — responsive art sizing and stage behavior;
- `home-arcade.css` — discovery layout and extreme-width behavior;
- `phase14.css` — Higher Contrast, Large Controls, Reduced Motion and Forced Colors;
- `src/visual-preferences.js` / `src/visual-boot.js` — preference application and first paint.

## Functional boundary

R7 changes no:

- RNG behavior;
- result semantics;
- presentation timing;
- Session/History state;
- persistence;
- security;
- portability.

## Exit criteria

R7 is complete when:

- authored neutral materials are tokenized;
- Day Table stages are genuinely light;
- saturated object identities remain recognizable;
- tool accent and user accent responsibilities remain distinct;
- Higher Contrast includes authored-art treatment;
- Forced Colors reduces art to system-color geometry;
- Reduced Motion leaves static authored art;
- Large Controls includes machine hardware;
- 320px/text-zoom behavior is explicit;
- ultrawide object scaling is bounded;
- touch does not receive sticky hover transforms;
- browser zoom remains enabled;
- PWA launch/runtime theme surfaces match the environment system;
- no new stylesheet is introduced;
- production budgets remain green.

## Next

**R8 — Full Visual QA, Consolidation & v1.2 Release Readiness**
