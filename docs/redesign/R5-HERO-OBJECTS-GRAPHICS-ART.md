# R5 — Hero Objects, Graphics & Art

Status: **implemented**  
Direction: **Tactile Chance Arcade**  
Target: **v1.2.0**

## Objective

R5 replaces the “CSS demo” ceiling of the v1.1 object visuals with an authored local vector-art system.

R2 defined materials. R3 created the cabinet. R4 created the machine. R5 gives those machines recognizable chance objects.

The rule is:

> the object carries identity; the stage supports it.

No remote art, stock illustration, runtime image CDN, or raster dependency is introduced.

## Art architecture

R5 introduces `src/hero-art.js`.

The module creates SVG using DOM APIs and local geometry only.

It does not use:

- `innerHTML`;
- remote URLs;
- runtime fetches;
- `Math.random`;
- external icon/image libraries;
- remote fonts.

SVG gradients are used only to describe object material such as metal, enamel, paper, and glass—not as generic page decoration.

## Authored material families

### Minted metal — Coin

The Coin now has:

- ridged edge marks;
- outer metal rim;
- inner minted ring;
- specular highlight;
- engraved H/T/? face;
- physical contact shadow.

The existing flip container remains so R6 can improve physical motion without replacing the art.

### Enamel — Dice

Dice now use authored SVG faces:

- beveled enamel body;
- edge highlight;
- lower material shading;
- actual D6 pip layouts;
- numeric face for non-D6 dice.

The existing `.die`, `.die-pips`, pip class, and rolling hooks remain compatible with V6/V7.

### Mechanical hardware — Wheel

The live Wheel keeps its dynamic data-driven segment disc.

R5 adds a separate mechanical hardware layer:

- outer rim;
- inner ring;
- bolts;
- physical hub.

The dynamic pointer remains the single pointer so existing tick/feel animation continues to work.

Home/Arcade thumbnails use a complete authored static wheel illustration.

### Paper + felt language — Cards

The CSS-painted deck/card face is replaced by SVG artwork:

- layered deck;
- paper edge;
- purple printed card back;
- central Random Spark motif;
- authored playing-card paper;
- rank/suit corners;
- large center suit;
- red/black ink behavior.

The pre-draw placeholder is now an authored card face instead of an old text-only question mark.

### Tokens / chips

Picker, Sampler, Teams, Groups, and Pairs use stacked physical tokens:

- hardware rim;
- accent enamel center;
- inner label plate;
- overlapping object depth.

### Tickets / slips

Shuffle, Assignments, and Lottery use layered tickets:

- warm paper;
- notched sides;
- perforation;
- print treatment;
- overlapping physical slips.

### Instrument panels

Number, Chance, Date, Time, Coordinates, Direction, and Letter use a compact instrument:

- hardware casing;
- glass display;
- accent readout;
- three physical controls.

Structured results are normalized to a short usable display value rather than stringifying objects.

### Private envelope

Secret Santa uses a paper envelope:

- warm paper body;
- folded flap geometry;
- diagonal folds;
- wax seal;
- Random Spark seal mark.

This reinforces privacy without requiring explanatory decoration.

### Competition object

Elimination, Tournament, Ladder, and Rock Paper Scissors use a trophy/chance-cup visual:

- metal cup;
- handles;
- pedestal;
- star mark.

### Color palette

Color uses an authored fan of physical swatch cards rather than a plain square.

## Complete built-in coverage

Every one of the 25 built-in tools maps to an R5 art family.

Custom tools remain compatible: they fall back to their existing local SVG icon when no authored R5 art family exists.

## Home and Arcade

R5 upgrades the R3 machine windows without changing their composition.

`toolCard()` now prefers authored R5 art over the generic tool icon.

Therefore Arcade machines show:

- actual Coin;
- die;
- wheel;
- card deck;
- chips;
- tickets;
- instruments;
- envelope;
- trophy;
- palette.

The Home House Machine also uses authored Wheel art.

## Live tool stage

R5 integrates artwork in three ways.

### Dedicated hero tools

Coin, Dice, Wheel, Cards, and Color use dedicated live object renderers.

### Generic families

Other built-in tools receive their mapped stage object automatically before the textual/result content.

### Existing result semantics

Result text remains actual DOM text.

The artwork is supplemental and never becomes the only carrier of the random result.

This preserves accessibility, copying, History semantics, and screen-reader output.

## CSS simplification

R5 removes substantial CSS-painted object detail.

Removed from CSS responsibilities:

- Coin metal gradients/rims;
- Dice enamel gradients/shadows;
- Card paper/card-back painting;
- much of Wheel frame hardware;
- plain Color swatch object.

CSS now owns:

- sizing;
- positioning;
- animation containers;
- responsive scale;
- z-order;
- motion hooks.

SVG owns the object.

This reduced `tool-experience.css` by roughly 1.6 KB even after adding R5 layout rules.

## Theme behavior

Art uses a combination of:

- authored physical material colors;
- `--machine-accent`;
- R2 material variables;
- current text/material colors.

The object remains recognizable in both Night Cabinet and Day Table.

Forced Colors still falls back through the surrounding semantic UI. The graphic remains supplemental; labels/results are never removed.

## Motion readiness

R5 deliberately preserves:

- `.stage-orb`;
- `.die`;
- `.wheel`;
- `.wheel-pointer`;
- `.card-deck`;
- `.playing-card`;
- all V7 reveal classes.

R6 can therefore improve object-specific physics without another rendering rewrite.

## Offline and security

`src/hero-art.js` is:

- part of the ES-module graph;
- syntax-checked in CI;
- included in the service-worker shell;
- local-only;
- free of unsafe HTML injection;
- free of random execution.

## Historical certification repair

R4 exposed a stale Design System V2 check that required active code to consume the exact old `radius-stage` and `shadow-level-*` spellings.

The current design system intentionally uses their R2 successors:

- `shape-stage`;
- `shadow-contact`;
- `shadow-inset`;
- material surface roles.

R5 updates that historical test to certify semantic surface/type/shape/depth usage rather than obsolete literal token names.

## Budget

After R5:

- root stylesheet count remains 19;
- `tool-experience.css` is materially smaller than R4;
- total CSS has regained meaningful headroom;
- hero-art JS remains a small local module;
- total production JavaScript remains below 1 MiB;
- `src/app.js` remains below 425 KB.

## Functional boundary

R5 changes no randomization or data semantics.

It does not change:

- RNG behavior;
- result data;
- Session state;
- History;
- Pool schemas;
- Presets/Templates;
- storage;
- portability;
- privacy/security.

## Exit criteria

R5 is complete when:

- all 25 built-in tools map to authored art;
- Coin/Dice/Wheel/Cards have dedicated hero artwork;
- tokens/tickets/instruments/private/competition/palette families exist;
- Home/Arcade use authored machine artwork;
- the live stage uses authored artwork;
- result text remains semantic DOM;
- old CSS-painted object detail is removed;
- object animation hooks remain compatible;
- hero art is offline-cached and syntax-certified;
- no remote art dependency exists;
- budgets remain green.

## Next

**R6 — Physical Motion & Microinteractions**
